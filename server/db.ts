// ── AGENT-OWNED: business data-access ────────────────────────────────────────
// All SQL lives here so routers stay thin. Money is integer kobo throughout.
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { atomic, db } from "./_core/db";
import { normalizePhone } from "../shared/phone";
import {
  addresses,
  cartItems,
  carts,
  categories,
  notifications,
  orderItems,
  orders,
  paymentSettings,
  payments,
  productImages,
  productVariants,
  products,
  profiles,
  reviews,
  users,
  wishlists,
} from "../drizzle/schema";

import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, deliveryFeeFor } from "../shared/constants";
export { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, deliveryFeeFor };
export const LOW_STOCK_THRESHOLD = 5;

/** Human labels for the order lifecycle, shared by every read path. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending Payment",
  payment_verification: "Payment Verification",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// ── profiles ────────────────────────────────────────────────────────────────
export async function ensureProfile(userId: string, fullName?: string | null) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(profiles)
    .values({ userId, fullName: fullName ?? null })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [again] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return again;
}

export async function getProfile(userId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row ?? null;
}

export async function updateProfile(userId: string, input: { fullName?: string; phone?: string; name?: string }) {
  await ensureProfile(userId);
  if (input.name !== undefined) {
    await db.update(users).set({ name: input.name }).where(eq(users.id, userId));
  }
  const [row] = await db
    .update(profiles)
    .set({
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    })
    .where(eq(profiles.userId, userId))
    .returning();
  return row;
}

/** Grant admin to any account whose email is listed in ADMIN_EMAILS. */
export async function syncAdminRole(userId: string, email: string) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return;
  if (!list.includes(email.toLowerCase())) return;
  // Unconditional: `role` is nullable, and `ne(role, 'admin')` evaluates to NULL
  // for a NULL role, which would silently skip the promotion.
  await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
}

// ── categories ──────────────────────────────────────────────────────────────
export async function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listCategoriesWithCounts() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.status, "active")))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows;
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}) {
  const [row] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateCategory(
  id: string,
  input: { name?: string; slug?: string; description?: string; imageUrl?: string; sortOrder?: number },
) {
  const [row] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    })
    .where(eq(categories.id, id))
    .returning();
  return row;
}

export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id));
  return { ok: true };
}

// ── products ────────────────────────────────────────────────────────────────
export type ProductRow = typeof products.$inferSelect;
export type ProductCard = ProductRow & { imageUrl: string | null; categoryName: string | null };

async function attachImages(rows: ProductRow[]): Promise<ProductCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const imgs = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, ids))
    .orderBy(asc(productImages.sortOrder));
  const first = new Map<string, string>();
  for (const img of imgs) if (!first.has(img.productId)) first.set(img.productId, img.url);
  const cats = await db.select().from(categories);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    ...r,
    imageUrl: first.get(r.id) ?? null,
    categoryName: r.categoryId ? (catName.get(r.categoryId) ?? null) : null,
  }));
}

export type ProductFilters = {
  q?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  discountedOnly?: boolean;
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "popular" | "discount";
  page?: number;
  pageSize?: number;
  includeDrafts?: boolean;
};

export async function listProducts(f: ProductFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, f.pageSize ?? 24));
  const conds = [];
  if (!f.includeDrafts) conds.push(eq(products.status, "active"));
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim()}%`;
    conds.push(or(ilike(products.name, term), ilike(products.description, term)));
  }
  if (f.categorySlug) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, f.categorySlug)).limit(1);
    if (!cat) return { items: [] as ProductCard[], total: 0, page, pageSize };
    conds.push(eq(products.categoryId, cat.id));
  }
  if (f.minPrice !== undefined) conds.push(gte(products.price, f.minPrice));
  if (f.maxPrice !== undefined) conds.push(lte(products.price, f.maxPrice));
  if (f.discountedOnly) conds.push(sql`${products.discountPrice} is not null`);
  if (f.inStockOnly) conds.push(gte(products.stock, 1));
  if (f.featuredOnly) conds.push(eq(products.isFeatured, true));

  const where = conds.length ? and(...conds) : undefined;

  const orderBy =
    f.sort === "price_asc"
      ? [asc(products.price)]
      : f.sort === "price_desc"
        ? [desc(products.price)]
        : f.sort === "popular"
          ? [desc(products.soldCount), desc(products.ratingCount)]
          : f.sort === "discount"
            ? [desc(sql`coalesce(${products.discountPrice}, 0) - ${products.price}`)]
            : [desc(products.createdAt)];

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  return { items: await attachImages(rows), total: count, page, pageSize };
}

export async function getProductBySlug(slug: string) {
  const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!row) return null;
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, row.id))
    .orderBy(asc(productImages.sortOrder));
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, row.id))
    .orderBy(asc(productVariants.kind), asc(productVariants.value));
  const [cat] = row.categoryId
    ? await db.select().from(categories).where(eq(categories.id, row.categoryId)).limit(1)
    : [];
  return { ...row, images, variants, category: cat ?? null };
}

export async function getProductById(id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.sortOrder));
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  return { ...row, images, variants };
}

export async function relatedProducts(productId: string, categoryId: string | null, limit = 8) {
  const conds = [eq(products.status, "active"), ne(products.id, productId)];
  if (categoryId) conds.push(eq(products.categoryId, categoryId));
  const rows = await db
    .select()
    .from(products)
    .where(and(...conds))
    .orderBy(desc(products.soldCount))
    .limit(limit);
  if (rows.length >= 4) return attachImages(rows);
  const extra = await db
    .select()
    .from(products)
    .where(and(eq(products.status, "active"), ne(products.id, productId)))
    .orderBy(desc(products.soldCount))
    .limit(limit);
  const seen = new Set(rows.map((r) => r.id));
  const merged = [...rows, ...extra.filter((e) => !seen.has(e.id))].slice(0, limit);
  return attachImages(merged);
}

export async function searchSuggestions(q: string, limit = 6) {
  if (!q.trim()) return [];
  const term = `%${q.trim()}%`;
  const rows = await db
    .select({ id: products.id, name: products.name, slug: products.slug, price: products.price })
    .from(products)
    .where(and(eq(products.status, "active"), ilike(products.name, term)))
    .orderBy(desc(products.soldCount))
    .limit(limit);
  return rows;
}

export async function homeSections() {
  const active = eq(products.status, "active");
  const [featured, bestSellers, newArrivals, trending, discounted, flash] = await Promise.all([
    db.select().from(products).where(and(active, eq(products.isFeatured, true))).orderBy(desc(products.createdAt)).limit(10),
    db.select().from(products).where(active).orderBy(desc(products.soldCount)).limit(10),
    db.select().from(products).where(active).orderBy(desc(products.createdAt)).limit(10),
    db.select().from(products).where(active).orderBy(desc(products.ratingCount), desc(products.ratingAvg)).limit(10),
    db.select().from(products).where(and(active, sql`${products.discountPrice} is not null`)).orderBy(desc(sql`coalesce(${products.discountPrice},0) - ${products.price}`)).limit(10),
    db.select().from(products).where(and(active, sql`${products.discountPrice} is not null`, gte(products.stock, 1))).orderBy(desc(sql`coalesce(${products.discountPrice},0) - ${products.price}`)).limit(6),
  ]);
  const [cats, all] = await Promise.all([listCategoriesWithCounts(), attachImages([...featured, ...bestSellers, ...newArrivals, ...trending, ...discounted, ...flash])]);
  const byId = new Map(all.map((p) => [p.id, p]));
  const pick = (rows: ProductRow[]) => rows.map((r) => byId.get(r.id)).filter((x): x is ProductCard => Boolean(x));
  return {
    categories: cats,
    featured: pick(featured),
    bestSellers: pick(bestSellers),
    newArrivals: pick(newArrivals),
    trending: pick(trending),
    discounted: pick(discounted),
    flashDeals: pick(flash),
  };
}

// ── admin product CRUD ──────────────────────────────────────────────────────
export async function createProduct(input: {
  name: string;
  slug: string;
  description: string;
  subcategory?: string | null;
  categoryId: string | null;
  price: number;
  discountPrice: number | null;
  stock: number;
  isFeatured: boolean;
  status: string;
  images: string[];
  variants: { kind: string; value: string; priceDelta: number; stock: number }[];
}) {
  const id = crypto.randomUUID();
  const stmts = [
    db
      .insert(products)
      .values({
        id,
        name: input.name,
        slug: input.slug,
        description: input.description,
        subcategory: input.subcategory ?? null,
        categoryId: input.categoryId,
        price: input.price,
        discountPrice: input.discountPrice,
        stock: input.stock,
        isFeatured: input.isFeatured,
        status: input.status,
      })
      .returning(),
    ...(input.images.length
      ? [
          db.insert(productImages).values(
            input.images.map((url, i) => ({ productId: id, url, sortOrder: i })),
          ),
        ]
      : []),
    ...(input.variants.length
      ? [db.insert(productVariants).values(input.variants.map((v) => ({ productId: id, ...v })))]
      : []),
  ] as unknown as Parameters<typeof atomic>[0] extends (d: never) => infer R ? R : never;
  const [created] = await atomic(() => stmts);
  return (created as unknown as ProductRow[])[0];
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string;
    subcategory?: string | null;
    categoryId?: string | null;
    price?: number;
    discountPrice?: number | null;
    stock?: number;
    isFeatured?: boolean;
    status?: string;
    images?: string[];
    variants?: { kind: string; value: string; priceDelta: number; stock: number }[];
  },
) {
  const [row] = await db
    .update(products)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.subcategory !== undefined ? { subcategory: input.subcategory } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.discountPrice !== undefined ? { discountPrice: input.discountPrice } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .where(eq(products.id, id))
    .returning();
  if (!row) return null;

  if (input.images) {
    await db.delete(productImages).where(eq(productImages.productId, id));
    if (input.images.length) {
      await db
        .insert(productImages)
        .values(input.images.map((url, i) => ({ productId: id, url, sortOrder: i })));
    }
  }
  if (input.variants) {
    await db.delete(productVariants).where(eq(productVariants.productId, id));
    if (input.variants.length) {
      await db.insert(productVariants).values(input.variants.map((v) => ({ productId: id, ...v })));
    }
  }
  return row;
}

export async function deleteProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
  return { ok: true };
}

// ── cart ────────────────────────────────────────────────────────────────────
async function ensureCart(userId: string) {
  const [existing] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(carts).values({ userId }).onConflictDoNothing().returning();
  if (row) return row;
  const [again] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  return again;
}

export type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number;
  variantLabel: string | null;
  stock: number;
  lineTotal: number;
};

export async function getCart(userId: string) {
  const cart = await ensureCart(userId);
  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      name: products.name,
      slug: products.slug,
      price: products.price,
      stock: products.stock,
      variantKind: productVariants.kind,
      variantValue: productVariants.value,
      variantDelta: productVariants.priceDelta,
      variantStock: productVariants.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt));

  const ids = [...new Set(rows.map((r) => r.productId))];
  const imgs = ids.length
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, ids))
        .orderBy(asc(productImages.sortOrder))
    : [];
  const first = new Map<string, string>();
  for (const img of imgs) if (!first.has(img.productId)) first.set(img.productId, img.url);

  const items: CartLine[] = rows.map((r) => {
    const unitPrice = r.price + (r.variantDelta ?? 0);
    return {
      id: r.id,
      productId: r.productId,
      variantId: r.variantId,
      quantity: r.quantity,
      name: r.name,
      slug: r.slug,
      imageUrl: first.get(r.productId) ?? null,
      unitPrice,
      variantLabel: r.variantKind && r.variantValue ? `${r.variantKind}: ${r.variantValue}` : null,
      stock: r.variantId ? (r.variantStock ?? 0) : r.stock,
      lineTotal: unitPrice * r.quantity,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = deliveryFeeFor(subtotal);
  return {
    items: items.map((i) => ({ ...i, availableStock: i.stock })),
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    count: items.reduce((s, i) => s + i.quantity, 0),
    hasStockIssue: items.some((i) => i.quantity > i.stock),
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
  };
}

export async function addToCart(userId: string, productId: string, variantId: string | null, quantity: number) {
  const cart = await ensureCart(userId);
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.productId, productId),
        variantId ? eq(cartItems.variantId, variantId) : sql`${cartItems.variantId} is null`,
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ cartId: cart.id, productId, variantId, quantity });
  }
  return getCart(userId);
}

export async function setCartQuantity(userId: string, itemId: string, quantity: number) {
  const cart = await ensureCart(userId);
  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  }
  return getCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  const cart = await ensureCart(userId);
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  return getCart(userId);
}

export async function clearCart(userId: string) {
  const cart = await ensureCart(userId);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  return getCart(userId);
}

// ── wishlist ────────────────────────────────────────────────────────────────
export async function listWishlist(userId: string) {
  const rows = await db
    .select({ product: products })
    .from(wishlists)
    .innerJoin(products, eq(products.id, wishlists.productId))
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.createdAt));
  return attachImages(rows.map((r) => r.product));
}

export async function toggleWishlist(userId: string, productId: string) {
  const [existing] = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)))
    .limit(1);
  if (existing) {
    await db.delete(wishlists).where(eq(wishlists.id, existing.id));
    return { saved: false };
  }
  await db.insert(wishlists).values({ userId, productId }).onConflictDoNothing();
  return { saved: true };
}

export async function wishlistIds(userId: string) {
  const rows = await db.select({ productId: wishlists.productId }).from(wishlists).where(eq(wishlists.userId, userId));
  return rows.map((r) => r.productId);
}

// ── addresses ───────────────────────────────────────────────────────────────
export async function listAddresses(userId: string) {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

export async function createAddress(
  userId: string,
  input: {
    label: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode?: string;
    isDefault?: boolean;
  },
) {
  if (input.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
  }
  const [row] = await db
    .insert(addresses)
    .values({
      userId,
      label: input.label,
      fullName: input.fullName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode ?? null,
      isDefault: input.isDefault ?? false,
    })
    .returning();
  return row;
}

/** Promote one address to default, clearing the flag on the rest. */
export async function setDefaultAddress(userId: string, addressId: string) {
  await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
  const [row] = await db
    .update(addresses)
    .set({ isDefault: true })
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
    .returning();
  if (!row) throw new Error("ADDRESS_NOT_FOUND");
  return row;
}

export async function updateAddress(
  userId: string,
  id: string,
  input: {
    label?: string;
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    isDefault?: boolean;
  },
) {
  if (input.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
  }
  const [row] = await db
    .update(addresses)
    .set({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
      ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    })
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteAddress(userId: string, id: string) {
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
  return { ok: true };
}

// ── notifications ───────────────────────────────────────────────────────────
export async function notify(
  userId: string | null,
  audience: "customer" | "admin",
  type: string,
  title: string,
  body: string | null,
  link: string | null,
) {
  // A guest order has no account, so there is no in-app inbox to write to.
  // No-op rather than throw: the order itself is already placed and correct.
  if (!userId) return;
  await db.insert(notifications).values({ userId, audience, type, title, body, link });
}

export async function notifyAdmins(type: string, title: string, body: string | null, link: string | null) {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  if (admins.length === 0) return;
  await db.insert(notifications).values(
    admins.map((a) => ({ userId: a.id, audience: "admin" as const, type, title, body, link })),
  );
}

export async function listNotifications(userId: string, audience: "customer" | "admin", limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.audience, audience)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: string, audience: "customer" | "admin") {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.audience, audience), eq(notifications.isRead, false)));
  return row?.count ?? 0;
}

export async function markNotificationRead(userId: string, id: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { ok: true };
}

export async function markAllNotificationsRead(userId: string, audience: "customer" | "admin") {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.audience, audience)));
  return { ok: true };
}

// ── orders ──────────────────────────────────────────────────────────────────
function orderNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MH-${ymd}-${rand}`;
}

export async function placeOrder(
  userId: string,
  input: {
    addressId?: string;
    address?: {
      label: string;
      fullName: string;
      phone: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
    };
    customerNote?: string;
  },
) {
  const cart = await getCart(userId);
  if (cart.items.length === 0) throw new Error("EMPTY_CART");

  // Re-validate stock server-side against live rows.
  for (const line of cart.items) {
    if (line.quantity > line.stock) throw new Error(`OUT_OF_STOCK:${line.name}`);
  }

  let ship: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
  };
  if (input.addressId) {
    const [addr] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)))
      .limit(1);
    if (!addr) throw new Error("ADDRESS_NOT_FOUND");
    ship = {
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
    };
  } else if (input.address) {
    ship = {
      fullName: input.address.fullName,
      phone: input.address.phone,
      line1: input.address.line1,
      line2: input.address.line2 ?? null,
      city: input.address.city,
      state: input.address.state,
    };
  } else {
    throw new Error("ADDRESS_REQUIRED");
  }

  const subtotal = cart.items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = deliveryFeeFor(subtotal);
  const total = subtotal + deliveryFee;
  const orderId = crypto.randomUUID();
  const number = orderNumber();
  const cartRow = await ensureCart(userId);

  // 1. Create the order + its line snapshots in one atomic unit.
  await atomic((d) => [
    d
      .insert(orders)
      .values({
        id: orderId,
        orderNumber: number,
        userId,
        shipName: ship.fullName,
        shipPhone: ship.phone,
        shipLine1: ship.line1,
        shipLine2: ship.line2,
        shipCity: ship.city,
        shipState: ship.state,
        subtotal,
        deliveryFee,
        total,
        paymentStatus: "unpaid",
        orderStatus: "pending_payment",
        customerNote: input.customerNote ?? null,
      })
      .returning(),
    d.insert(orderItems).values(
      cart.items.map((line) => ({
        orderId,
        productId: line.productId,
        name: line.name,
        imageUrl: line.imageUrl,
        variantLabel: line.variantLabel,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
    ),
  ]);

  // 2. Guarded stock decrements. A zero-row RETURNING means somebody bought the
  //    last unit between our read and this write — cancel the order and refund
  //    the cart rather than overselling.
  let oversold = false;
  for (const line of cart.items) {
    const updated = line.variantId
      ? await db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
          .where(and(eq(productVariants.id, line.variantId), gte(productVariants.stock, line.quantity)))
          .returning()
      : await db
          .update(products)
          .set({ stock: sql`${products.stock} - ${line.quantity}` })
          .where(and(eq(products.id, line.productId), gte(products.stock, line.quantity)))
          .returning();
    if (updated.length === 0) {
      oversold = true;
      break;
    }
  }

  if (oversold) {
    await db
      .update(orders)
      .set({ orderStatus: "cancelled", paymentStatus: "unpaid", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    throw new Error("STOCK_CHANGED");
  }

  // 3. Empty the cart and bump the sold counter.
  await db.delete(cartItems).where(eq(cartItems.cartId, cartRow.id));
  for (const line of cart.items) {
    await db
      .update(products)
      .set({ soldCount: sql`${products.soldCount} + ${line.quantity}` })
      .where(eq(products.id, line.productId));
  }

  await notify(
    userId,
    "customer",
    "order_placed",
    `Order ${number} placed`,
    `We received your order for ${cart.items.length} item(s). Complete your bank transfer to confirm it.`,
    `/orders/${orderId}`,
  );
  await notifyAdmins(
    "new_order",
    `New order ${number}`,
    `A new order worth ₦${(total / 100).toLocaleString("en-NG")} was placed.`,
    `/admin/orders`,
  );

  return { id: orderId, orderNumber: number, total };
}

// ── guest checkout ───────────────────────────────────────────────────────────
// A guest has no cart row (carts.user_id is NOT NULL and belongs to the
// scaffold), so the lines arrive with the request. That makes the SERVER the
// only thing standing between a crafted request and a wrong price, which is why
// every price, name and stock figure below is read from the database and the
// request carries nothing but ids and quantities.

export type GuestLineInput = { productId: string; variantId?: string | null; quantity: number };

export async function placeGuestOrder(input: {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  customerNote?: string;
  items: GuestLineInput[];
}) {
  if (input.items.length === 0) throw new Error("EMPTY_CART");

  const canonicalPhone = normalizePhone(input.phone);
  if (!canonicalPhone) throw new Error("BAD_PHONE");

  const ids = [...new Set(input.items.map((i) => i.productId))];
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const variantIds = input.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
  const vRows = variantIds.length
    ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds))
    : [];
  const vById = new Map(vRows.map((v) => [v.id, v]));

  const imgs = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, ids))
    .orderBy(asc(productImages.sortOrder));
  const firstImg = new Map<string, string>();
  for (const img of imgs) if (!firstImg.has(img.productId)) firstImg.set(img.productId, img.url);

  const lines = input.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p || p.status !== "active") throw new Error("PRODUCT_UNAVAILABLE");
    const v = i.variantId ? vById.get(i.variantId) : null;
    if (i.variantId && (!v || v.productId !== p.id)) throw new Error("PRODUCT_UNAVAILABLE");
    const unitPrice = p.price + (v?.priceDelta ?? 0);
    const stock = v ? v.stock : p.stock;
    if (i.quantity > stock) throw new Error(`OUT_OF_STOCK:${p.name}`);
    return {
      productId: p.id,
      variantId: v?.id ?? null,
      quantity: i.quantity,
      name: p.name,
      imageUrl: firstImg.get(p.id) ?? null,
      variantLabel: v ? `${v.kind}: ${v.value}` : null,
      unitPrice,
      lineTotal: unitPrice * i.quantity,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryFee = deliveryFeeFor(subtotal);
  const total = subtotal + deliveryFee;
  const orderId = crypto.randomUUID();
  const number = orderNumber();

  await atomic((d) => [
    d
      .insert(orders)
      .values({
        id: orderId,
        orderNumber: number,
        userId: null,
        isGuest: true,
        shipName: input.fullName,
        shipPhone: canonicalPhone,
        shipLine1: input.line1,
        shipLine2: input.line2 ?? null,
        shipCity: input.city,
        shipState: input.state,
        subtotal,
        deliveryFee,
        total,
        paymentStatus: "unpaid",
        orderStatus: "pending_payment",
        customerNote: input.customerNote ?? null,
      })
      .returning(),
    d.insert(orderItems).values(
      lines.map((l) => ({
        orderId,
        productId: l.productId,
        name: l.name,
        imageUrl: l.imageUrl,
        variantLabel: l.variantLabel,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        lineTotal: l.lineTotal,
      })),
    ),
  ]);

  // Guarded decrements, exactly as the signed-in path: a zero-row RETURNING
  // means somebody bought the last unit first, so cancel rather than oversell.
  let oversold = false;
  for (const l of lines) {
    const updated = l.variantId
      ? await db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${l.quantity}` })
          .where(and(eq(productVariants.id, l.variantId), gte(productVariants.stock, l.quantity)))
          .returning()
      : await db
          .update(products)
          .set({ stock: sql`${products.stock} - ${l.quantity}` })
          .where(and(eq(products.id, l.productId), gte(products.stock, l.quantity)))
          .returning();
    if (updated.length === 0) {
      oversold = true;
      break;
    }
  }

  if (oversold) {
    await db
      .update(orders)
      .set({ orderStatus: "cancelled", paymentStatus: "unpaid", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    throw new Error("STOCK_CHANGED");
  }

  for (const l of lines) {
    await db
      .update(products)
      .set({ soldCount: sql`${products.soldCount} + ${l.quantity}` })
      .where(eq(products.id, l.productId));
  }

  await notifyAdmins(
    "new_order",
    `New guest order ${number}`,
    `A guest order worth ₦${(total / 100).toLocaleString("en-NG")} was placed by ${input.fullName}.`,
    `/admin/orders`,
  );

  return { id: orderId, orderNumber: number, total, phone: canonicalPhone };
}

/**
 * Look up a guest order.
 *
 * The credential is the order number PLUS the phone number given at checkout —
 * there is no session to lean on. Both are required and the phone is normalised
 * first, so "0803 000 0000" finds an order placed with "+2348030000000".
 * A wrong phone returns null, which the router turns into a 404: the caller
 * cannot tell "no such order" from "wrong phone", so the endpoint cannot be
 * used to enumerate order numbers.
 */
export async function getGuestOrder(orderNumber: string, phone: string) {
  const canonical = normalizePhone(phone);
  if (!canonical) return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber.trim().toUpperCase()), eq(orders.shipPhone, canonical)))
    .limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .orderBy(desc(payments.submittedAt));
  return {
    ...order,
    status: order.orderStatus,
    statusLabel: ORDER_STATUS_LABEL[order.orderStatus] ?? order.orderStatus,
    items,
    payments: pays,
    address: {
      fullName: order.shipName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2,
      city: order.shipCity,
      state: order.shipState,
      postalCode: null as string | null,
    },
  };
}

/** Guest equivalent of submitPaymentReference — same guards, no session. */
export async function submitGuestPaymentReference(
  orderNumber: string,
  phone: string,
  reference: string,
  note: string | null,
) {
  const order = await getGuestOrder(orderNumber, phone);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.paymentStatus === "paid") throw new Error("ALREADY_PAID");
  if (order.orderStatus === "cancelled") throw new Error("ORDER_CANCELLED");

  const [pending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, order.id), eq(payments.status, "awaiting_verification")))
    .limit(1);
  if (pending) throw new Error("ALREADY_PENDING");

  const [row] = await db
    .insert(payments)
    .values({ orderId: order.id, userId: null, reference, note, status: "awaiting_verification" })
    .returning();

  await db
    .update(orders)
    .set({ paymentStatus: "awaiting_verification", orderStatus: "payment_verification", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  await notifyAdmins(
    "payment_submitted",
    `Payment reference submitted — ${order.orderNumber}`,
    `Reference ${reference} needs verification. Expected ₦${(order.total / 100).toLocaleString("en-NG")}.`,
    `/admin/payments`,
  );

  return row;
}

export async function listOrders(userId: string) {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  if (rows.length === 0) return [];
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((o) => {
    const mine = items.filter((i) => i.orderId === o.id);
    return {
      ...o,
      status: o.orderStatus,
      statusLabel: ORDER_STATUS_LABEL[o.orderStatus] ?? o.orderStatus,
      itemCount: mine.reduce((s, i) => s + i.quantity, 0),
      items: mine,
    };
  });
}

export async function getOrder(userId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.submittedAt));
  return {
    ...order,
    status: order.orderStatus,
    statusLabel: ORDER_STATUS_LABEL[order.orderStatus] ?? order.orderStatus,
    items,
    payments: pays,
    address: {
      fullName: order.shipName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2,
      city: order.shipCity,
      state: order.shipState,
      postalCode: null as string | null,
    },
  };
}

export async function getPaymentSettings() {
  const [row] = await db.select().from(paymentSettings).where(eq(paymentSettings.id, 1)).limit(1);
  return (
    row ?? {
      id: 1,
      bankName: "",
      accountName: "",
      accountNumber: "",
      instructions: "",
      updatedAt: new Date(),
    }
  );
}

export async function updatePaymentSettings(input: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
}) {
  const [row] = await db
    .insert(paymentSettings)
    .values({ id: 1, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: paymentSettings.id,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function submitPaymentReference(
  userId: string,
  orderId: string,
  reference: string,
  note: string | null,
) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.paymentStatus === "paid") throw new Error("ALREADY_PAID");
  if (order.orderStatus === "cancelled") throw new Error("ORDER_CANCELLED");

  const [pending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "awaiting_verification")))
    .limit(1);
  if (pending) throw new Error("ALREADY_PENDING");

  const [row] = await db
    .insert(payments)
    .values({ orderId, userId, reference, note, status: "awaiting_verification" })
    .returning();

  await db
    .update(orders)
    .set({ paymentStatus: "awaiting_verification", orderStatus: "payment_verification", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await notify(
    userId,
    "customer",
    "payment_submitted",
    "Payment reference received",
    `We received reference ${reference} for order ${order.orderNumber}. Our team will verify it shortly.`,
    `/orders/${orderId}`,
  );
  await notifyAdmins(
    "payment_submitted",
    `Payment reference submitted — ${order.orderNumber}`,
    `Reference ${reference} needs verification. Expected ₦${(order.total / 100).toLocaleString("en-NG")}.`,
    `/admin/payments`,
  );

  return row;
}

// ── reviews ─────────────────────────────────────────────────────────────────
export async function listReviews(productId: string) {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      createdAt: reviews.createdAt,
      authorName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.productId, productId))
    .orderBy(desc(reviews.createdAt));
  return rows;
}

export async function createReview(
  userId: string,
  productId: string,
  rating: number,
  title: string | null,
  body: string | null,
) {
  const [row] = await db
    .insert(reviews)
    .values({ userId, productId, rating, title, body })
    .onConflictDoUpdate({
      target: [reviews.productId, reviews.userId],
      set: { rating, title, body, createdAt: new Date() },
    })
    .returning();

  const [agg] = await db
    .select({
      avg: sql<number>`coalesce(round(avg(${reviews.rating}) * 10), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(eq(reviews.productId, productId));
  await db
    .update(products)
    .set({ ratingAvg: agg?.avg ?? 0, ratingCount: agg?.count ?? 0 })
    .where(eq(products.id, productId));
  return row;
}

// ── admin: orders ───────────────────────────────────────────────────────────
export async function adminListOrders(f: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const conds = [];
  if (f.status && f.status !== "all") conds.push(eq(orders.orderStatus, f.status));
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim()}%`;
    conds.push(or(ilike(orders.orderNumber, term), ilike(orders.shipName, term), ilike(users.email, term)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      order: orders,
      customerEmail: users.email,
      customerName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(where);

  const ids = rows.map((r) => r.order.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];

  return {
    items: rows.map((r) => ({
      ...r.order,
      customerEmail: r.customerEmail,
      customerName: r.customerName,
      items: items.filter((i) => i.orderId === r.order.id),
    })),
    total: count,
    page,
    pageSize,
  };
}

export async function adminGetOrder(orderId: string) {
  const [row] = await db
    .select({ order: orders, customerEmail: users.email, customerName: users.name })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const pays = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.submittedAt));
  return { ...row.order, customerEmail: row.customerEmail, customerName: row.customerName, items, payments: pays };
}

const ORDER_STATUSES = [
  "pending_payment",
  "payment_verification",
  "paid",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export async function adminUpdateOrderStatus(orderId: string, status: string) {
  if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) throw new Error("BAD_STATUS");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.orderStatus === "cancelled" && status !== "cancelled") throw new Error("CANCELLED_LOCKED");

  const [row] = await db
    .update(orders)
    .set({ orderStatus: status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  const messages: Record<string, { title: string; body: string; type: string }> = {
    processing: { type: "order_processing", title: "Order is being prepared", body: `Order ${order.orderNumber} is now being processed.` },
    shipped: { type: "order_shipped", title: "Order shipped", body: `Order ${order.orderNumber} has been shipped.` },
    out_for_delivery: { type: "order_out_for_delivery", title: "Out for delivery", body: `Order ${order.orderNumber} is out for delivery today.` },
    delivered: { type: "order_delivered", title: "Order delivered", body: `Order ${order.orderNumber} has been delivered. Thank you for shopping with MarketHub.` },
    cancelled: { type: "order_cancelled", title: "Order cancelled", body: `Order ${order.orderNumber} has been cancelled.` },
  };
  const msg = messages[status];
  if (msg) await notify(order.userId, "customer", msg.type, msg.title, msg.body, `/orders/${orderId}`);
  return row;
}

// ── admin: payments ─────────────────────────────────────────────────────────
export async function adminListPayments(f: { status?: string; q?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const conds = [];
  if (f.status && f.status !== "all") conds.push(eq(payments.status, f.status));
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim()}%`;
    conds.push(or(ilike(payments.reference, term), ilike(orders.orderNumber, term), ilike(users.email, term)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      payment: payments,
      orderNumber: orders.orderNumber,
      orderTotal: orders.total,
      orderStatus: orders.orderStatus,
      customerEmail: users.email,
      customerName: users.name,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(users, eq(users.id, payments.userId))
    .where(where)
    .orderBy(desc(payments.submittedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(users, eq(users.id, payments.userId))
    .where(where);

  return {
    items: rows.map((r) => ({
      ...r.payment,
      orderNumber: r.orderNumber,
      orderTotal: r.orderTotal,
      orderStatus: r.orderStatus,
      customerEmail: r.customerEmail,
      customerName: r.customerName,
    })),
    total: count,
    page,
    pageSize,
  };
}

export async function reviewPayment(
  adminId: string,
  paymentId: string,
  decision: "approve" | "reject",
  adminNote: string | null,
) {
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!pay) throw new Error("PAYMENT_NOT_FOUND");
  if (pay.status !== "awaiting_verification") throw new Error("ALREADY_REVIEWED");

  const [order] = await db.select().from(orders).where(eq(orders.id, pay.orderId)).limit(1);
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (decision === "approve") {
    // Guarded: only flips a payment that is still awaiting verification, so two
    // admins clicking approve at once cannot both succeed.
    const [updated] = await db
      .update(payments)
      .set({ status: "verified", adminNote, reviewedAt: new Date(), reviewedBy: adminId })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "awaiting_verification")))
      .returning();
    if (!updated) throw new Error("ALREADY_REVIEWED");

    await db
      .update(orders)
      .set({ paymentStatus: "paid", orderStatus: "paid", updatedAt: new Date() })
      .where(eq(orders.id, pay.orderId));

    await notify(
      pay.userId,
      "customer",
      "payment_approved",
      "Payment verified",
      `Your payment for order ${order.orderNumber} has been verified. We are preparing your order.`,
      `/orders/${pay.orderId}`,
    );
    return updated;
  }

  const [updated] = await db
    .update(payments)
    .set({ status: "rejected", adminNote, reviewedAt: new Date(), reviewedBy: adminId })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "awaiting_verification")))
    .returning();
  if (!updated) throw new Error("ALREADY_REVIEWED");

  await db
    .update(orders)
    .set({ paymentStatus: "rejected", orderStatus: "pending_payment", updatedAt: new Date() })
    .where(eq(orders.id, pay.orderId));

  await notify(
    pay.userId,
    "customer",
    "payment_rejected",
    "Payment could not be verified",
    `We could not verify reference ${pay.reference} for order ${order.orderNumber}.${adminNote ? ` Note: ${adminNote}` : ""} Please submit a corrected reference.`,
    `/orders/${pay.orderId}`,
  );
  return updated;
}

// ── admin: users ────────────────────────────────────────────────────────────
export async function adminListUsers(f: { q?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const conds = [];
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim()}%`;
    conds.push(or(ilike(users.email, term), ilike(users.name, term)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      isSuspended: profiles.isSuspended,
      phone: profiles.phone,
      orderCount: sql<number>`(select count(*) from ${orders} where ${orders.userId} = ${users.id})::int`,
      totalSpent: sql<number>`(select coalesce(sum(${orders.total}),0) from ${orders} where ${orders.userId} = ${users.id} and ${orders.paymentStatus} = 'paid')::int`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  return { items: rows, total: count, page, pageSize };
}

export async function adminGetUser(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      isSuspended: profiles.isSuspended,
      phone: profiles.phone,
      fullName: profiles.fullName,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const userOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  return { ...row, orders: userOrders };
}

export async function adminSetRole(adminId: string, userId: string, role: "user" | "admin") {
  if (role === "user") {
    // Refuse to remove the last remaining admin.
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (count <= 1) throw new Error("LAST_ADMIN");
    if (adminId === userId) throw new Error("SELF_DEMOTE");
  }
  const [row] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
  return row;
}

export async function adminSetSuspended(userId: string, suspended: boolean) {
  await ensureProfile(userId);
  const [row] = await db
    .update(profiles)
    .set({ isSuspended: suspended })
    .where(eq(profiles.userId, userId))
    .returning();
  return row;
}

// ── admin: dashboard ────────────────────────────────────────────────────────
export async function adminStats() {
  const [sales] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.total}),0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"));

  const [allOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  const [pendingPay] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, "awaiting_verification"));
  const [verifiedPay] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, "verified"));
  const [rejectedPay] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, "rejected"));
  const [customers] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "user"));
  const [productCount] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  const [activeProducts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.status, "active"));

  const lowStock = await db
    .select({ id: products.id, name: products.name, stock: products.stock, slug: products.slug })
    .from(products)
    .where(and(eq(products.status, "active"), lte(products.stock, LOW_STOCK_THRESHOLD)))
    .orderBy(asc(products.stock))
    .limit(8);

  const recentOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      orderStatus: orders.orderStatus,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
      customerEmail: users.email,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .orderBy(desc(orders.createdAt))
    .limit(8);

  const recentActivity = await db
    .select()
    .from(notifications)
    .where(eq(notifications.audience, "admin"))
    .orderBy(desc(notifications.createdAt))
    .limit(8);

  const salesByDay = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${orders.total}),0)::int`,
      orders: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(sql`${orders.createdAt} >= now() - interval '14 days'`)
    .groupBy(sql`date_trunc('day', ${orders.createdAt})`)
    .orderBy(sql`date_trunc('day', ${orders.createdAt})`);

  const topProducts = await db
    .select({
      name: orderItems.name,
      units: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<number>`sum(${orderItems.lineTotal})::int`,
    })
    .from(orderItems)
    .groupBy(orderItems.name)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  return {
    revenue: sales?.revenue ?? 0,
    paidOrders: sales?.count ?? 0,
    totalOrders: allOrders?.count ?? 0,
    pendingPayments: pendingPay?.count ?? 0,
    verifiedPayments: verifiedPay?.count ?? 0,
    rejectedPayments: rejectedPay?.count ?? 0,
    totalCustomers: customers?.count ?? 0,
    totalProducts: productCount?.count ?? 0,
    activeProducts: activeProducts?.count ?? 0,
    lowStock,
    recentOrders,
    recentActivity,
    salesByDay,
    topProducts,
  };
}
