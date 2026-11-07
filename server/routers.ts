// ── AGENT-OWNED: tRPC API surface ────────────────────────────────────────────
// Thin procedures: validate with zod, delegate to server/db.ts.
// Access levels: publicProcedure / protectedProcedure / adminProcedure.
// Admin authorization is enforced HERE (server-side), never by the client.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import { authProvider, registerLocalUser, registerLocalUserWithPhone, AuthError, EmailTakenError, PhoneTakenError } from "./_core/auth";
import { storageCommit, storageDeleteOwned, storageListByOwner, storagePutUrl, StorageError } from "./_core/storage";
import * as q from "./db";
import { rateLimit, RateLimitError } from "./services/rate-limit";
import { isConfigured as paymentsConfigured, publicConfig as paymentsPublicConfig } from "./services/payments";
import { normalizePhone } from "../shared/phone";

/** Turn a domain error code into a user-facing TRPCError. */
function domainError(e: unknown): never {
  const msg = e instanceof Error ? e.message : "";
  const map: Record<string, { code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN"; text: string }> = {
    EMPTY_CART: { code: "BAD_REQUEST", text: "Your cart is empty." },
    ADDRESS_REQUIRED: { code: "BAD_REQUEST", text: "Choose or enter a delivery address." },
    ADDRESS_NOT_FOUND: { code: "NOT_FOUND", text: "That delivery address no longer exists." },
    STOCK_CHANGED: { code: "CONFLICT", text: "An item sold out while you were checking out. Your cart has been kept — please review it." },
    ORDER_NOT_FOUND: { code: "NOT_FOUND", text: "Order not found." },
    ALREADY_PAID: { code: "CONFLICT", text: "This order is already paid." },
    ORDER_CANCELLED: { code: "CONFLICT", text: "This order was cancelled." },
    ALREADY_PENDING: { code: "CONFLICT", text: "A reference is already awaiting verification for this order." },
    PAYMENT_NOT_FOUND: { code: "NOT_FOUND", text: "Payment not found." },
    ALREADY_REVIEWED: { code: "CONFLICT", text: "This payment has already been reviewed." },
    BAD_STATUS: { code: "BAD_REQUEST", text: "Unknown order status." },
    CANCELLED_LOCKED: { code: "CONFLICT", text: "A cancelled order cannot be reopened." },
    LAST_ADMIN: { code: "CONFLICT", text: "You cannot remove the last administrator." },
    SELF_DEMOTE: { code: "CONFLICT", text: "You cannot revoke your own admin access." },
    CATEGORY_IN_USE: { code: "CONFLICT", text: "Move or delete the products in this category first." },
    SLUG_TAKEN: { code: "CONFLICT", text: "That slug is already used by another record." },
    BAD_PHONE: { code: "BAD_REQUEST", text: "Enter a valid Nigerian mobile number." },
    PRODUCT_UNAVAILABLE: { code: "CONFLICT", text: "One of the items is no longer available. Please review your cart." },
  };
  if (msg.startsWith("OUT_OF_STOCK:")) {
    throw new TRPCError({ code: "CONFLICT", message: `${msg.slice(13)} only has limited stock left.` });
  }
  const hit = map[msg];
  if (hit) throw new TRPCError({ code: hit.code, message: hit.text });
  throw e;
}

function guard<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch(domainError);
}

function limit(key: string, max: number, windowMs: number) {
  try {
    rateLimit(key, max, windowMs);
  } catch (e) {
    if (e instanceof RateLimitError) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: e.message });
    throw e;
  }
}

// ── auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters."),
        name: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      limit(`signup:${input.email.toLowerCase()}`, 5, 60 * 60 * 1000);
      try {
        const user = await registerLocalUser(input.email, input.password, input.name);
        await q.ensureProfile(user.id, input.name ?? null);
        await q.syncAdminRole(user.id, user.email);
        await authProvider().login(ctx.c, input.email, input.password);
        return user;
      } catch (e) {
        if (e instanceof EmailTakenError) throw new TRPCError({ code: "CONFLICT", message: e.message });
        throw e;
      }
    }),

  /**
   * Register with a phone number as the primary identifier.
   *
   * `confirmPassword` is validated HERE rather than only in the form: a client
   * check is a convenience, and the server must not accept a signup whose two
   * passwords disagree just because the request did not come from our page.
   */
  signupPhone: publicProcedure
    .input(
      z
        .object({
          fullName: z.string().min(2, "Enter your full name.").max(120),
          phone: z.string().min(7).max(40),
          password: z.string().min(8, "Password must be at least 8 characters."),
          confirmPassword: z.string(),
        })
        .refine((v) => v.password === v.confirmPassword, {
          message: "The two passwords do not match.",
          path: ["confirmPassword"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const canonical = normalizePhone(input.phone);
      if (!canonical) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid Nigerian mobile number." });
      }
      limit(`signup:${canonical}`, 5, 60 * 60 * 1000);
      try {
        const { user } = await registerLocalUserWithPhone(input.phone, input.password, input.fullName);
        await q.syncAdminRole(user.id, user.email);
        await authProvider().loginWithPhone(ctx.c, input.phone, input.password);
        return user;
      } catch (e) {
        if (e instanceof PhoneTakenError) throw new TRPCError({ code: "CONFLICT", message: e.message });
        if (e instanceof AuthError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
        throw e;
      }
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      limit(`login:${input.email.toLowerCase()}`, 10, 15 * 60 * 1000);
      try {
        const user = await authProvider().login(ctx.c, input.email, input.password);
        await q.ensureProfile(user.id, user.name);
        await q.syncAdminRole(user.id, user.email);
        return user;
      } catch (e) {
        if (e instanceof AuthError) throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        throw e;
      }
    }),

  loginPhone: publicProcedure
    .input(z.object({ phone: z.string().min(7).max(40), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const canonical = normalizePhone(input.phone) ?? input.phone;
      limit(`login:${canonical}`, 10, 15 * 60 * 1000);
      try {
        const user = await authProvider().loginWithPhone(ctx.c, input.phone, input.password);
        await q.ensureProfile(user.id, user.name);
        await q.syncAdminRole(user.id, user.email);
        return user;
      } catch (e) {
        if (e instanceof AuthError) throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        throw e;
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await authProvider().logout(ctx.c);
    return { ok: true };
  }),
});

// ── catalogue (public) ───────────────────────────────────────────────────────
const catalogRouter = router({
  home: publicProcedure.query(() => q.homeSections()),

  categories: publicProcedure.query(() => q.listCategoriesWithCounts()),

  products: publicProcedure
    .input(
      z.object({
        q: z.string().max(120).optional(),
        categorySlug: z.string().max(120).optional(),
        minPrice: z.number().int().nonnegative().optional(),
        maxPrice: z.number().int().nonnegative().optional(),
        discountedOnly: z.boolean().optional(),
        inStockOnly: z.boolean().optional(),
        featuredOnly: z.boolean().optional(),
        sort: z.enum(["newest", "price_asc", "price_desc", "popular", "discount"]).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(60).optional(),
      }),
    )
    .query(({ input }) => q.listProducts(input)),

  product: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const product = await q.getProductBySlug(input.slug);
      if (!product || product.status !== "active") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }
      const [related, reviews] = await Promise.all([
        q.relatedProducts(product.id, product.categoryId),
        q.listReviews(product.id),
      ]);
      return { ...product, related, reviews };
    }),

  suggestions: publicProcedure
    .input(z.object({ q: z.string().max(120) }))
    .query(({ input }) => q.searchSuggestions(input.q)),

  /**
   * Which payment flow the storefront should show.
   *
   * `gateway` is non-null ONLY when a provider is selected AND its secret key is
   * present server-side, so the UI cannot offer a gateway that would fail. The
   * public key is safe to send; the secret key is never in this response.
   */
  paymentConfig: publicProcedure.query(async () => {
    const cfg = await paymentsPublicConfig();
    return {
      gateway: cfg.provider,
      publicKey: cfg.publicKey,
      manualTransfer: true,
      configured: await paymentsConfigured(),
    };
  }),
});

// ── cart ─────────────────────────────────────────────────────────────────────
const cartRouter = router({
  get: protectedProcedure.query(({ ctx }) => q.getCart(ctx.user.id)),

  add: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable().optional(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(() => q.addToCart(ctx.user.id, input.productId, input.variantId ?? null, input.quantity)),
    ),

  setQuantity: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(0).max(20) }))
    .mutation(({ ctx, input }) => q.setCartQuantity(ctx.user.id, input.itemId, input.quantity)),

  remove: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(({ ctx, input }) => q.removeCartItem(ctx.user.id, input.itemId)),

  clear: protectedProcedure.mutation(({ ctx }) => q.clearCart(ctx.user.id)),
});

// ── wishlist ─────────────────────────────────────────────────────────────────
const wishlistRouter = router({
  list: protectedProcedure.query(({ ctx }) => q.listWishlist(ctx.user.id)),
  ids: protectedProcedure.query(({ ctx }) => q.wishlistIds(ctx.user.id)),
  toggle: protectedProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .mutation(({ ctx, input }) => q.toggleWishlist(ctx.user.id, input.productId)),
});

// ── account ──────────────────────────────────────────────────────────────────
const accountRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => {
    const [profile, addresses] = await Promise.all([q.getProfile(ctx.user.id), q.listAddresses(ctx.user.id)]);
    return { user: ctx.user, profile, addresses };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().max(120).optional(),
        fullName: z.string().max(120).optional(),
        phone: z.string().max(40).optional(),
      }),
    )
    .mutation(({ ctx, input }) => q.updateProfile(ctx.user.id, input)),
});

// ── addresses ────────────────────────────────────────────────────────────────
const addressInput = z.object({
  label: z.string().min(1).max(40).optional(),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(40),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

const addressesRouter = router({
  list: protectedProcedure.query(({ ctx }) => q.listAddresses(ctx.user.id)),

  create: protectedProcedure
    .input(addressInput)
    .mutation(({ ctx, input }) =>
      q.createAddress(ctx.user.id, { ...input, label: input.label ?? "Home" }),
    ),

  update: protectedProcedure
    .input(addressInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const row = await q.updateAddress(ctx.user.id, id, rest);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Address not found." });
      return row;
    }),

  remove: protectedProcedure
    .input(z.object({ addressId: z.string().uuid() }))
    .mutation(({ ctx, input }) => q.deleteAddress(ctx.user.id, input.addressId)),

  setDefault: protectedProcedure
    .input(z.object({ addressId: z.string().uuid() }))
    .mutation(({ ctx, input }) => guard(() => q.setDefaultAddress(ctx.user.id, input.addressId))),
});

// ── orders ───────────────────────────────────────────────────────────────────
const ordersRouter = router({
  list: protectedProcedure.query(({ ctx }) => q.listOrders(ctx.user.id)),

  detail: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const order = await q.getOrder(ctx.user.id, input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      return order;
    }),

  place: protectedProcedure
    .input(
      z.object({
        addressId: z.string().uuid().optional(),
        address: addressInput.omit({ isDefault: true }).optional(),
        notes: z.string().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(() =>
        q.placeOrder(ctx.user.id, {
          addressId: input.addressId,
          address: input.address
            ? {
                label: input.address.label ?? "Home",
                fullName: input.address.fullName,
                phone: input.address.phone,
                line1: input.address.line1,
                line2: input.address.line2,
                city: input.address.city,
                state: input.address.state,
              }
            : undefined,
          customerNote: input.notes,
        }),
      ),
    ),

  review: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().max(120).optional(),
        body: z.string().max(2000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      q.createReview(ctx.user.id, input.productId, input.rating, input.title ?? null, input.body ?? null),
    ),
});

// ── payments (customer side) ─────────────────────────────────────────────────
const paymentsRouter = router({
  settings: publicProcedure.query(() => q.getPaymentSettings()),

  submitReference: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        reference: z.string().min(4, "Enter the transfer reference.").max(120),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      limit(`payref:${ctx.user.id}`, 8, 10 * 60 * 1000);
      return guard(() =>
        q.submitPaymentReference(ctx.user.id, input.orderId, input.reference.trim(), input.note ?? null),
      );
    }),
});

// ── notifications ────────────────────────────────────────────────────────────
const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ audience: z.enum(["customer", "admin"]).default("customer") }))
    .query(async ({ ctx, input }) => {
      if (input.audience === "admin" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const [items, unread] = await Promise.all([
        q.listNotifications(ctx.user.id, input.audience),
        q.unreadCount(ctx.user.id, input.audience),
      ]);
      return { items, unread };
    }),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(({ ctx, input }) => q.markNotificationRead(ctx.user.id, input.notificationId)),

  markAllRead: protectedProcedure
    .input(z.object({ audience: z.enum(["customer", "admin"]).default("customer") }))
    .mutation(({ ctx, input }) => q.markAllNotificationsRead(ctx.user.id, input.audience)),
});

// ── admin ────────────────────────────────────────────────────────────────────
const adminRouter = router({
  stats: adminProcedure.query(() => q.adminStats()),

  // categories
  categories: adminProcedure.query(() => q.listCategoriesWithCounts()),
  createCategory: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(80),
        slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
        description: z.string().max(500).optional(),
        imageUrl: z.string().max(500).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(({ input }) => guard(() => q.createCategory(input))),
  updateCategory: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(2).max(80).optional(),
        slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
        description: z.string().max(500).optional(),
        imageUrl: z.string().max(500).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const row = await guard(() => q.updateCategory(id, rest));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
      return row;
    }),
  deleteCategory: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input }) => guard(() => q.deleteCategory(input.id))),

  // products
  products: adminProcedure
    .input(
      z.object({
        q: z.string().max(120).optional(),
        categorySlug: z.string().max(120).optional(),
        sort: z.enum(["newest", "price_asc", "price_desc", "popular", "discount"]).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(60).optional(),
      }),
    )
    .query(({ input }) => q.listProducts({ ...input, includeDrafts: true })),

  product: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const row = await q.getProductById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      return row;
    }),

  createProduct: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(200),
        slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
        description: z.string().max(5000),
        subcategory: z.string().max(80).nullable().optional(),
        categoryId: z.string().uuid().nullable(),
        price: z.number().int().positive(),
        discountPrice: z.number().int().positive().nullable(),
        stock: z.number().int().min(0),
        isFeatured: z.boolean(),
        status: z.enum(["active", "draft"]),
        images: z.array(z.string().max(500)).max(8),
        variants: z
          .array(
            z.object({
              kind: z.enum(["Size", "Colour"]),
              value: z.string().min(1).max(40),
              priceDelta: z.number().int(),
              stock: z.number().int().min(0),
            }),
          )
          .max(30),
      }),
    )
    .mutation(({ input }) => guard(() => q.createProduct(input))),

  updateProduct: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(2).max(200).optional(),
        slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/).optional(),
        description: z.string().max(5000).optional(),
        subcategory: z.string().max(80).nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        price: z.number().int().positive().optional(),
        discountPrice: z.number().int().positive().nullable().optional(),
        stock: z.number().int().min(0).optional(),
        isFeatured: z.boolean().optional(),
        status: z.enum(["active", "draft"]).optional(),
        images: z.array(z.string().max(500)).max(8).optional(),
        variants: z
          .array(
            z.object({
              kind: z.enum(["Size", "Colour"]),
              value: z.string().min(1).max(40),
              priceDelta: z.number().int(),
              stock: z.number().int().min(0),
            }),
          )
          .max(30)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const row = await guard(() => q.updateProduct(id, rest));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      return row;
    }),

  deleteProduct: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input }) => guard(() => q.deleteProduct(input.id))),

  // orders
  orders: adminProcedure
    .input(
      z.object({
        q: z.string().max(120).optional(),
        status: z.string().max(40).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(({ input }) => q.adminListOrders(input)),

  order: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const row = await q.adminGetOrder(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      return row;
    }),

  updateOrderStatus: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "pending_payment",
          "payment_verification",
          "paid",
          "processing",
          "shipped",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ]),
      }),
    )
    .mutation(({ input }) => guard(() => q.adminUpdateOrderStatus(input.id, input.status))),

  // payments
  payments: adminProcedure
    .input(
      z.object({
        status: z.string().max(40).optional(),
        q: z.string().max(120).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(({ input }) => q.adminListPayments(input)),

  reviewPayment: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        adminNote: z.string().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(() => q.reviewPayment(ctx.user.id, input.id, input.decision, input.adminNote ?? null)),
    ),

  // payment settings
  paymentSettings: adminProcedure.query(() => q.getPaymentSettings()),
  updatePaymentSettings: adminProcedure
    .input(
      z.object({
        bankName: z.string().min(2).max(120),
        accountName: z.string().min(2).max(120),
        accountNumber: z.string().min(6).max(40),
        instructions: z.string().min(10).max(2000),
      }),
    )
    .mutation(({ input }) => q.updatePaymentSettings(input)),

  // users
  users: adminProcedure
    .input(
      z.object({
        q: z.string().max(120).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(({ input }) => q.adminListUsers(input)),

  user: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const row = await q.adminGetUser(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      return row;
    }),

  setRole: adminProcedure
    .input(z.object({ id: z.string().uuid(), role: z.enum(["user", "admin"]) }))
    .mutation(({ ctx, input }) => guard(() => q.adminSetRole(ctx.user.id, input.id, input.role))),

  setSuspended: adminProcedure
    .input(z.object({ id: z.string().uuid(), suspended: z.boolean() }))
    .mutation(({ ctx, input }) => {
      if (ctx.user.id === input.id) {
        throw new TRPCError({ code: "CONFLICT", message: "You cannot suspend your own account." });
      }
      return q.adminSetSuspended(input.id, input.suspended);
    }),
});

// ── files (product image upload) ─────────────────────────────────────────────
export function sanitizeBasename(name: string): string {
  const last = name.split(/[/\\]/).pop() ?? "";
  const dot = last.lastIndexOf(".");
  const rawStem = dot > 0 ? last.slice(0, dot) : last;
  const rawExt = dot > 0 ? last.slice(dot + 1) : "";
  const stem = rawStem.replace(/[^A-Za-z0-9._-]/g, "").replace(/^\.+/, "") || "upload";
  const ext = rawExt.replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
  return ext ? `${stem}.${ext}` : stem;
}

const filesRouter = router({
  uploadUrl: adminProcedure
    .input(z.object({ name: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const key = `${crypto.randomUUID()}-${sanitizeBasename(input.name)}`;
      try {
        const { uploadUrl, publicPath } = await storagePutUrl(key, input.contentType, { ownerId: ctx.user.id });
        return { key, uploadUrl, publicPath };
      } catch (e) {
        if (e instanceof StorageError && e.code === "failed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That image type is not accepted. Use PNG, JPEG, WebP, GIF or AVIF.",
          });
        }
        throw e;
      }
    }),

  commit: adminProcedure
    .input(z.object({ key: z.string().min(1), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await storageCommit(input.key, { ownerId: ctx.user.id, name: input.name });
      } catch (e) {
        if (e instanceof StorageError && e.code === "not_found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found — did the upload finish?" });
        }
        if (e instanceof StorageError && e.code === "forbidden") {
          throw new TRPCError({ code: "FORBIDDEN", message: "That file belongs to another user." });
        }
        throw e;
      }
    }),

  list: adminProcedure.query(({ ctx }) => storageListByOwner(ctx.user.id)),

  remove: adminProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await storageDeleteOwned(ctx.user.id, input.key);
      } catch (e) {
        if (e instanceof StorageError && e.code === "forbidden") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Malformed file key." });
        }
        throw e;
      }
    }),
});
// ── guest checkout ───────────────────────────────────────────────────────────
// No session, so the order number + phone number ARE the credential. Every
// procedure here is rate-limited: without a session there is nothing else
// slowing down somebody guessing order numbers.
const guestCredential = z.object({
  orderNumber: z.string().min(4).max(40),
  phone: z.string().min(7).max(40),
});

const guestRouter = router({
  place: publicProcedure
    .input(
      z.object({
        fullName: z.string().min(2, "Enter the recipient's full name.").max(120),
        phone: z.string().min(7).max(40),
        line1: z.string().min(3).max(200),
        line2: z.string().max(200).optional(),
        city: z.string().min(2).max(80),
        state: z.string().min(2).max(80),
        notes: z.string().max(500).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              variantId: z.string().uuid().nullable().optional(),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .min(1, "Your cart is empty.")
          .max(50),
      }),
    )
    .mutation(({ input }) => {
      limit(`guest-order:${normalizePhone(input.phone) ?? input.phone}`, 10, 60 * 60 * 1000);
      return guard(() =>
        q.placeGuestOrder({
          fullName: input.fullName,
          phone: input.phone,
          line1: input.line1,
          line2: input.line2,
          city: input.city,
          state: input.state,
          customerNote: input.notes,
          items: input.items,
        }),
      );
    }),

  order: publicProcedure
    .input(guestCredential)
    .query(async ({ input }) => {
      limit(`guest-lookup:${normalizePhone(input.phone) ?? input.phone}`, 30, 15 * 60 * 1000);
      const order = await q.getGuestOrder(input.orderNumber, input.phone);
      // Deliberately the same 404 for "no such order" and "wrong phone":
      // distinguishing them would turn this into an order-number oracle.
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "No order matches that number and phone." });
      return order;
    }),

  submitReference: publicProcedure
    .input(
      guestCredential.extend({
        reference: z.string().min(4, "Enter the transfer reference.").max(120),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(({ input }) => {
      limit(`guest-payref:${normalizePhone(input.phone) ?? input.phone}`, 8, 10 * 60 * 1000);
      return guard(() =>
        q.submitGuestPaymentReference(
          input.orderNumber,
          input.phone,
          input.reference.trim(),
          input.note ?? null,
        ),
      );
    }),
});

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  wishlist: wishlistRouter,
  account: accountRouter,
  addresses: addressesRouter,
  orders: ordersRouter,
  guest: guestRouter,
  payments: paymentsRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
  files: filesRouter,
});

export type AppRouter = typeof appRouter;
