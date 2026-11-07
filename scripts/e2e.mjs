#!/usr/bin/env node
/**
 * End-to-end verification against the REAL database and the REAL API.
 *
 * Everything here goes over HTTP to a running server, so it exercises the same
 * path a browser does: tRPC envelope, superjson, session cookie, zod validation,
 * and the actual SQL. Nothing is mocked.
 *
 * Run:  node scripts/e2e.mjs
 */
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3001";

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

function section(t) {
  console.log(`\n\u2500\u2500 ${t} ${"\u2500".repeat(Math.max(0, 60 - t.length))}`);
}

/** tRPC v11 over HTTP with superjson: GET for queries, POST for mutations.
 *  Both directions are wrapped in `{ json: ... }` — that is the superjson
 *  envelope this server is configured with, and sending a bare object is
 *  rejected as "expected object, received undefined". */
async function trpc(path, { input, method = "GET", cookie } = {}) {
  const url = new URL(`/trpc/${path}`, BASE);
  const headers = {};
  if (cookie) headers.cookie = cookie;

  let res;
  if (method === "GET") {
    if (input !== undefined) url.searchParams.set("input", JSON.stringify({ json: input }));
    res = await fetch(url, { headers });
  } else {
    headers["content-type"] = "application/json";
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ json: input ?? {} }) });
  }

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { status: res.status, raw: text, json: null, setCookie: res.headers.get("set-cookie") };
  }
  return { status: res.status, json: body, setCookie: res.headers.get("set-cookie") };
}

/** Unwrap a tRPC success envelope (superjson-wrapped), or return the error. */
function unwrap(r) {
  if (r.json?.error) return { error: r.json.error };
  return { data: r.json?.result?.data?.json };
}

/** The tRPC error code lives at error.data.code, not error.json.data.code. */
const errCode = (r) => r.json?.error?.json?.data?.code;

const cookieOf = (r) => (r.setCookie ? r.setCookie.split(";")[0] : null);

/** Sign in as an allowlisted admin, creating the account on first run.
 *  The role comes from ADMIN_EMAILS server-side — never from the signup call. */
async function adminSession() {
  const email = "admin1@markethub.test";
  const password = "AdminPass123!";
  const signup = await trpc("auth.signup", { method: "POST", input: { email, password, name: "Admin One" } });
  if (signup.json?.error) {
    const login = await trpc("auth.login", { method: "POST", input: { email, password } });
    return cookieOf(login);
  }
  return cookieOf(signup);
}

async function main() {
  console.log(`MarketHub end-to-end verification \u2014 ${BASE}\n`);

  // ── health ────────────────────────────────────────────────────────────────
  section("Health & connectivity");
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  ok("GET /api/health returns ok:true", health?.ok === true, JSON.stringify(health));

  // ── catalogue ─────────────────────────────────────────────────────────────
  section("Catalogue");
  const home = unwrap(await trpc("catalog.home"));
  ok("catalog.home responds", Boolean(home.data), JSON.stringify(home.error ?? {}).slice(0, 200));
  ok("home has featured products", (home.data?.featured?.length ?? 0) > 0, `got ${home.data?.featured?.length}`);
  ok("home has new arrivals", (home.data?.newArrivals?.length ?? 0) > 0);
  ok("home has best sellers", (home.data?.bestSellers?.length ?? 0) > 0);
  ok("home has discounted products", (home.data?.discounted?.length ?? 0) > 0);
  ok("home has categories", (home.data?.categories?.length ?? 0) >= 10, `got ${home.data?.categories?.length}`);

  const list = unwrap(await trpc("catalog.products", { input: { page: 1, pageSize: 1 } }));
  ok("catalog.products reports exactly 200 products", list.data?.total === 200, `total=${list.data?.total}`);

  // Walk every page and confirm each product is complete.
  let seen = 0;
  let missingImage = 0;
  let missingSub = 0;
  let badPrice = 0;
  let badDiscount = 0;
  let firstSlug = null;
  for (let page = 1; page <= 10; page += 1) {
    const p = unwrap(await trpc("catalog.products", { input: { page, pageSize: 20 } }));
    const items = p.data?.items ?? [];
    if (items.length === 0) break;
    for (const it of items) {
      seen += 1;
      if (!firstSlug) firstSlug = it.slug;
      if (!it.imageUrl) missingImage += 1;
      if (!it.subcategory) missingSub += 1;
      if (!(it.price > 0)) badPrice += 1;
      if (it.discountPrice != null && !(it.discountPrice < it.price)) badDiscount += 1;
    }
  }
  ok("all 200 products are reachable by paging", seen === 200, `saw ${seen}`);
  ok("every product has an image", missingImage === 0, `${missingImage} missing`);
  ok("every product has a subcategory", missingSub === 0, `${missingSub} missing`);
  ok("every product has a price above zero", badPrice === 0, `${badPrice} bad`);
  ok("every discount price is below its original", badDiscount === 0, `${badDiscount} bad`);

  // ── product detail ────────────────────────────────────────────────────────
  section("Product detail");
  const detail = unwrap(await trpc("catalog.product", { input: { slug: firstSlug } }));
  ok("product detail loads by slug", detail.data?.slug === firstSlug);
  ok("detail includes images", (detail.data?.images?.length ?? 0) > 0);
  ok("detail includes a description", (detail.data?.description?.length ?? 0) > 20);
  ok("detail includes stock", typeof detail.data?.stock === "number");

  // ── search & filter ───────────────────────────────────────────────────────
  section("Search & filtering");
  const search = unwrap(await trpc("catalog.products", { input: { q: "phone", page: 1, pageSize: 20 } }));
  ok("search returns matches", (search.data?.items?.length ?? 0) > 0, `got ${search.data?.items?.length}`);

  const sugg = unwrap(await trpc("catalog.suggestions", { input: { q: "sh" } }));
  ok("search suggestions respond", Array.isArray(sugg.data), JSON.stringify(sugg.error ?? {}).slice(0, 120));

  const cats = unwrap(await trpc("catalog.categories"));
  const catSlug = cats.data?.[0]?.slug;
  const filtered = unwrap(await trpc("catalog.products", { input: { categorySlug: catSlug, page: 1, pageSize: 50 } }));
  ok(`category filter (${catSlug}) returns products`, (filtered.data?.items?.length ?? 0) > 0);
  const catName = cats.data?.[0]?.name;
  ok(
    "category filter returns only that category",
    (filtered.data?.items ?? []).every((i) => i.categoryName === catName),
    `expected ${catName}`,
  );

  const sorted = unwrap(await trpc("catalog.products", { input: { sort: "price_asc", page: 1, pageSize: 20 } }));
  const prices = (sorted.data?.items ?? []).map((i) => i.price);
  ok("price_asc sorting is ordered", prices.every((p, i) => i === 0 || prices[i - 1] <= p));

  const ranged = unwrap(
    await trpc("catalog.products", { input: { minPrice: 100000, maxPrice: 500000, page: 1, pageSize: 50 } }),
  );
  ok(
    "price range filter respects both bounds",
    (ranged.data?.items ?? []).every((i) => i.price >= 100000 && i.price <= 500000),
  );

  // ── payment config ────────────────────────────────────────────────────────
  section("Payment configuration");
  const pay = unwrap(await trpc("catalog.paymentConfig"));
  ok("paymentConfig responds", Boolean(pay.data), JSON.stringify(pay.error ?? {}).slice(0, 200));
  ok("no gateway is advertised when none is configured", pay.data?.gateway === null, `gateway=${pay.data?.gateway}`);
  ok("manual transfer is offered", pay.data?.manualTransfer === true);
  ok("no secret key is exposed", !JSON.stringify(pay.data ?? {}).toLowerCase().includes("secret"));

  // ── email/password auth ───────────────────────────────────────────────────
  section("Authentication \u2014 email + password");
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const pw = "hunter2hunter2";

  const signup = await trpc("auth.signup", { method: "POST", input: { email, password: pw, name: "E2E Shopper" } });
  const su = unwrap(signup);
  ok("signup succeeds", su.data?.email === email, JSON.stringify(su.error ?? {}).slice(0, 200));
  const emailCookie = cookieOf(signup);
  ok("signup sets a session cookie", Boolean(emailCookie));

  const me = unwrap(await trpc("auth.me", { cookie: emailCookie }));
  ok("session identifies the new user", me.data?.email === email);
  ok("a fresh signup is NOT an admin", me.data?.role !== "admin", `role=${me.data?.role}`);

  const dupeRaw = await trpc("auth.signup", { method: "POST", input: { email, password: pw } });
  const dupe = unwrap(dupeRaw);
  ok("duplicate email is refused with CONFLICT", errCode(dupeRaw) === "CONFLICT", errCode(dupeRaw));

  const badLoginRaw = await trpc("auth.login", { method: "POST", input: { email, password: "wrongpassword" } });
  ok("wrong password is refused", errCode(badLoginRaw) === "UNAUTHORIZED", errCode(badLoginRaw));

  const login = await trpc("auth.login", { method: "POST", input: { email, password: pw } });
  ok("login with the right password succeeds", unwrap(login).data?.email === email);

  // ── phone/password auth ───────────────────────────────────────────────────
  section("Authentication \u2014 phone + password");
  const phone = `0803${String(stamp).slice(-7)}`;
  const phoneSignup = await trpc("auth.signupPhone", {
    method: "POST",
    input: { fullName: "Ada Okafor", phone, password: pw, confirmPassword: pw },
  });
  const ps = unwrap(phoneSignup);
  ok("phone signup succeeds", Boolean(ps.data?.id), JSON.stringify(ps.error ?? {}).slice(0, 200));
  const phoneCookie = cookieOf(phoneSignup);
  ok("phone signup sets a session cookie", Boolean(phoneCookie));

  const phoneMe = unwrap(await trpc("auth.me", { cookie: phoneCookie }));
  ok("phone session identifies the user", phoneMe.data?.id === ps.data?.id);

  // The SAME number in a different spelling must be recognised as taken.
  const spaced = `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
  const phoneDupeRaw = await trpc("auth.signupPhone", {
    method: "POST",
    input: { fullName: "Someone Else", phone: spaced, password: pw, confirmPassword: pw },
  });
  ok(
    "the same number in another format is refused (normalisation works)",
    errCode(phoneDupeRaw) === "CONFLICT",
    errCode(phoneDupeRaw),
  );

  const phoneLogin = await trpc("auth.loginPhone", { method: "POST", input: { phone: spaced, password: pw } });
  ok("phone login works with a differently-formatted number", unwrap(phoneLogin).data?.id === ps.data?.id);

  const phoneBadRaw = await trpc("auth.loginPhone", { method: "POST", input: { phone, password: "nope" } });
  ok("phone login with a wrong password is refused", errCode(phoneBadRaw) === "UNAUTHORIZED", errCode(phoneBadRaw));

  const mismatchRaw = await trpc("auth.signupPhone", {
    method: "POST",
    input: { fullName: "X Y", phone: "08099999999", password: pw, confirmPassword: "different123" },
  });
  ok("mismatched passwords are refused server-side", errCode(mismatchRaw) === "BAD_REQUEST", errCode(mismatchRaw));

  // ── guest checkout ────────────────────────────────────────────────────────
  section("Guest checkout");
  const g = unwrap(await trpc("catalog.products", { input: { page: 1, pageSize: 3 } }));
  const gItems = g.data?.items ?? [];
  const gProduct = gItems.find((i) => i.stock > 2) ?? gItems[0];
  const stockBefore = gProduct.stock;

  const guestOrder = await trpc("guest.place", {
    method: "POST",
    input: {
      fullName: "Guest Buyer",
      phone: "08031234567",
      line1: "12 Adeola Odeku Street",
      city: "Victoria Island",
      state: "Lagos",
      items: [{ productId: gProduct.id, quantity: 2 }],
    },
  });
  const go = unwrap(guestOrder);
  ok("guest order is placed", Boolean(go.data?.orderNumber), JSON.stringify(go.error ?? {}).slice(0, 200));
  ok("guest order gets an MH- reference", /^MH-/.test(go.data?.orderNumber ?? ""), go.data?.orderNumber);

  const guestLookup = unwrap(
    await trpc("guest.order", { input: { orderNumber: go.data?.orderNumber, phone: "08031234567" } }),
  );
  ok("guest can look the order up with number + phone", guestLookup.data?.orderNumber === go.data?.orderNumber);
  ok("guest order has line items", (guestLookup.data?.items?.length ?? 0) === 1);
  ok("guest order total is server-computed", guestLookup.data?.total > 0);

  const wrongPhoneRaw = await trpc("guest.order", {
    input: { orderNumber: go.data?.orderNumber, phone: "08039999999" },
  });
  ok("a wrong phone number cannot read the order", errCode(wrongPhoneRaw) === "NOT_FOUND", errCode(wrongPhoneRaw));

  const after = unwrap(await trpc("catalog.product", { input: { slug: gProduct.slug } }));
  ok(
    "stock was decremented by the guest order",
    after.data?.stock === stockBefore - 2,
    `${stockBefore} -> ${after.data?.stock}`,
  );

  // Ask for more than exists. The request schema caps quantity at 20, so we
  // first drop a product's stock to 3 through the ADMIN API (which also proves
  // admin edits reach the customer-facing catalogue), then over-order it.
  const adminCookie = await adminSession();
  const scarce = gItems[0];
  await trpc("admin.updateProduct", {
    method: "POST",
    cookie: adminCookie,
    input: { id: scarce.id, stock: 3 },
  });
  const overOrderRaw = await trpc("guest.place", {
    method: "POST",
    input: {
      fullName: "Greedy Buyer",
      phone: "08031234568",
      line1: "1 Test Street",
      city: "Ikeja",
      state: "Lagos",
      items: [{ productId: scarce.id, quantity: 4 }],
    },
  });
  ok("ordering more than stock is refused", Boolean(overOrderRaw.json?.error), errCode(overOrderRaw));

  // And the customer-facing read must show the admin's new stock immediately.
  const afterEdit = unwrap(await trpc("catalog.product", { input: { slug: scarce.slug } }));
  ok("an admin stock edit is visible to customers at once", afterEdit.data?.stock === 3, `stock=${afterEdit.data?.stock}`);

  const guestRef = unwrap(
    await trpc("guest.submitReference", {
      method: "POST",
      input: { orderNumber: go.data?.orderNumber, phone: "08031234567", reference: "TRF-E2E-001" },
    }),
  );
  ok("guest can submit a transfer reference", Boolean(guestRef.data?.id), JSON.stringify(guestRef.error ?? {}).slice(0, 200));

  const afterRef = unwrap(
    await trpc("guest.order", { input: { orderNumber: go.data?.orderNumber, phone: "08031234567" } }),
  );
  ok(
    "submitting a reference moves payment to awaiting_verification",
    afterRef.data?.paymentStatus === "awaiting_verification",
    afterRef.data?.paymentStatus,
  );
  ok(
    "and does NOT mark the order paid",
    afterRef.data?.paymentStatus !== "paid",
  );

  // ── signed-in cart & order ────────────────────────────────────────────────
  section("Signed-in cart & order");
  const cItem = gItems.find((i) => i.stock > 1) ?? gItems[0];
  const add = unwrap(
    await trpc("cart.add", { method: "POST", cookie: emailCookie, input: { productId: cItem.id, quantity: 1 } }),
  );
  ok("signed-in user can add to cart", !add.error, JSON.stringify(add.error ?? {}).slice(0, 160));

  const cart = unwrap(await trpc("cart.get", { cookie: emailCookie }));
  ok("cart returns the item", (cart.data?.items?.length ?? 0) === 1);
  ok("cart computes a subtotal", cart.data?.subtotal > 0);
  ok("cart computes a total", cart.data?.total >= cart.data?.subtotal);

  const addr = unwrap(
    await trpc("addresses.create", {
      method: "POST",
      cookie: emailCookie,
      input: {
        fullName: "E2E Shopper",
        phone: "08035550000",
        line1: "5 Broad Street",
        city: "Lagos Island",
        state: "Lagos",
      },
    }),
  );
  ok("customer can save a delivery address", Boolean(addr.data?.id), JSON.stringify(addr.error ?? {}).slice(0, 200));

  const order = unwrap(
    await trpc("orders.place", { method: "POST", cookie: emailCookie, input: { addressId: addr.data?.id } }),
  );
  ok("signed-in order is placed", Boolean(order.data?.orderNumber), JSON.stringify(order.error ?? {}).slice(0, 200));

  const myOrders = unwrap(await trpc("orders.list", { cookie: emailCookie }));
  ok("customer sees their order history", (myOrders.data?.length ?? 0) >= 1);

  // ── authorization ─────────────────────────────────────────────────────────
  section("Authorization");
  const anonAdminRaw = await trpc("admin.stats");
  ok("anonymous cannot read admin stats", errCode(anonAdminRaw) === "UNAUTHORIZED", errCode(anonAdminRaw));

  const custAdminRaw = await trpc("admin.stats", { cookie: emailCookie });
  ok("a normal customer cannot read admin stats", errCode(custAdminRaw) === "FORBIDDEN", errCode(custAdminRaw));

  const custSetRoleRaw = await trpc("admin.setRole", {
    method: "POST",
    cookie: emailCookie,
    input: { userId: ps.data?.id, role: "admin" },
  });
  ok("a customer cannot promote themselves to admin", errCode(custSetRoleRaw) === "FORBIDDEN", errCode(custSetRoleRaw));

  const custProductsRaw = await trpc("admin.products", { cookie: emailCookie, input: { page: 1, pageSize: 5 } });
  ok("a customer cannot list admin products", errCode(custProductsRaw) === "FORBIDDEN", errCode(custProductsRaw));

  const custCreateRaw = await trpc("admin.createProduct", {
    method: "POST",
    cookie: emailCookie,
    input: {
      name: "Hacked",
      slug: "hacked",
      description: "x",
      categoryId: null,
      price: 100,
      discountPrice: null,
      stock: 1,
      isFeatured: false,
      status: "active",
      images: ["/products/phone.png"],
      variants: [],
    },
  });
  ok("a customer cannot create a product", errCode(custCreateRaw) === "FORBIDDEN", errCode(custCreateRaw));

  const otherOrders = unwrap(await trpc("orders.list", { cookie: phoneCookie }));
  ok("a different customer sees only their own orders", (otherOrders.data?.length ?? 0) === 0, `saw ${otherOrders.data?.length}`);

  // ── admin dashboard ──────────────────────────────────────────────────────
  section("Admin dashboard");
  const adminStats = unwrap(await trpc("admin.stats", { cookie: adminCookie }));
  ok("admin can read the overview", typeof adminStats.data?.totalProducts === "number", JSON.stringify(adminStats.data ?? {}).slice(0, 120));
  ok("overview counts the 200 products", adminStats.data?.totalProducts === 200, `totalProducts=${adminStats.data?.totalProducts}`);

  const adminList = unwrap(await trpc("admin.products", { cookie: adminCookie, input: { page: 1, pageSize: 5 } }));
  ok("admin can list products", (adminList.data?.items ?? []).length === 5);

  // Edit a preloaded product end-to-end and confirm the customer sees it.
  const target = adminList.data?.items?.[0];
  const newName = `E2E Renamed ${Date.now()}`;
  const edited = unwrap(
    await trpc("admin.updateProduct", {
      method: "POST",
      cookie: adminCookie,
      input: { id: target.id, name: newName, price: 1234500, discountPrice: 999900, isFeatured: true },
    }),
  );
  ok("admin can edit a product", edited.data?.name === newName, edited.data?.name);

  const asCustomer = unwrap(await trpc("catalog.product", { input: { slug: target.slug } }));
  ok("the customer-facing page shows the admin's new name", asCustomer.data?.name === newName, asCustomer.data?.name);
  ok("the customer-facing page shows the admin's new price", asCustomer.data?.price === 1234500, `price=${asCustomer.data?.price}`);
  ok("the customer-facing page shows the admin's discount", asCustomer.data?.discountPrice === 999900, `discount=${asCustomer.data?.discountPrice}`);

  // Create then delete, so the catalogue returns to exactly 200.
  const created = unwrap(
    await trpc("admin.createProduct", {
      method: "POST",
      cookie: adminCookie,
      input: {
        name: "E2E Temporary Product",
        slug: `e2e-temp-${Date.now()}`,
        description: "Created by the end-to-end test and deleted again.",
        subcategory: "Test",
        categoryId: null,
        price: 500000,
        discountPrice: null,
        stock: 5,
        isFeatured: false,
        status: "active",
        images: ["/products/phone.png"],
        variants: [],
      },
    }),
  );
  ok("admin can add a product", Boolean(created.data?.id), JSON.stringify(created.error ?? {}).slice(0, 120));

  const afterCreate = unwrap(await trpc("catalog.products", { input: { page: 1, pageSize: 1 } }));
  ok("the new product is counted", afterCreate.data?.total === 201, `total=${afterCreate.data?.total}`);

  const del = unwrap(await trpc("admin.deleteProduct", { method: "POST", cookie: adminCookie, input: { id: created.data?.id } }));
  ok("admin can delete a product", !del.error, JSON.stringify(del.error ?? {}).slice(0, 120));

  const afterDelete = unwrap(await trpc("catalog.products", { input: { page: 1, pageSize: 1 } }));
  ok("the catalogue is back to exactly 200", afterDelete.data?.total === 200, `total=${afterDelete.data?.total}`);

  const adminOrders = unwrap(await trpc("admin.orders", { cookie: adminCookie, input: { page: 1, pageSize: 10 } }));
  ok("admin can list orders", Array.isArray(adminOrders.data?.items), JSON.stringify(adminOrders.error ?? {}).slice(0, 120));

  // Put the edited product back exactly as seeded. The test edits a PRELOADED
  // product on purpose (that is the requirement), so it must undo its own edit
  // or the catalogue is left with a test name in it.
  const restored = unwrap(
    await trpc("admin.updateProduct", {
      method: "POST",
      cookie: adminCookie,
      input: {
        id: target.id,
        name: target.name,
        price: target.price,
        discountPrice: target.discountPrice,
        isFeatured: target.isFeatured,
      },
    }),
  );
  ok("the test restored the product it edited", restored.data?.name === target.name, restored.data?.name);

  // ── summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"\u2500".repeat(64)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\n  Failures:");
    for (const f of failures) console.log(`   \u2022 ${f}`);
  }
  console.log(`${"\u2500".repeat(64)}\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nE2E run crashed:", e);
  process.exit(1);
});
