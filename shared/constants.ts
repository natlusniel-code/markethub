// Shared client/server constants.

// Session cookie name is per-app (derived from APP_SLUG) so two apps served on
// the same host cannot clobber each other's session cookie (DESIGN #13). The
// server owns the authoritative value via env; this helper keeps client/server
// in agreement.
export function sessionCookieName(slug: string): string {
  return `app_session_${slug}`;
}

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── delivery pricing ─────────────────────────────────────────────────────────
// Lives in shared/ because BOTH sides need it: the server charges the fee when
// it creates the order, and the guest cart shows the same figure before the
// order exists. Two copies of this rule would drift, and a cart that quotes
// ₦2,500 while the order charges ₦3,000 is a bug the customer sees.
//
// The server remains authoritative — it recomputes the fee from the database
// subtotal and ignores anything the client sends.
export const DELIVERY_FEE = 250_000; // ₦2,500
export const FREE_DELIVERY_THRESHOLD = 15_000_000; // ₦150,000

/** Delivery fee for a subtotal, in kobo. Free above the threshold. */
export function deliveryFeeFor(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
}
