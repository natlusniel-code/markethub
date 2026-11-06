// Shared formatting + domain vocabulary. Money is integer kobo everywhere in
// the API and the database; it is only ever turned into a string here.

export const CURRENCY = "₦";

/** ₦1,234,500 — kobo in, naira out. */
export function formatNaira(kobo: number, opts: { compact?: boolean } = {}): string {
  const naira = kobo / 100;
  if (opts.compact && naira >= 1_000_000) {
    return `${CURRENCY}${(naira / 1_000_000).toFixed(naira >= 10_000_000 ? 0 : 1)}M`;
  }
  if (opts.compact && naira >= 1_000) {
    return `${CURRENCY}${(naira / 1_000).toFixed(naira >= 100_000 ? 0 : 1)}k`;
  }
  return `${CURRENCY}${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Naira string → kobo integer. "12,500.50" → 1250050. */
export function nairaToKobo(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Kobo → plain naira number, for pre-filling an admin price field. */
export function koboToNaira(kobo: number): number {
  return Math.round(kobo) / 100;
}

/** Percentage off, or 0 when there is no discount. */
export function discountPercent(price: number, discountPrice: number | null): number {
  if (!discountPrice || discountPrice <= price) return 0;
  return Math.round(((discountPrice - price) / discountPrice) * 100);
}

/** ratingAvg is stored in tenths (47 = 4.7). */
export function formatRating(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

// ── Order vocabulary ────────────────────────────────────────────────────────
export const ORDER_STATUSES = [
  "pending_payment",
  "payment_verification",
  "paid",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  payment_verification: "Payment Verification",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The happy-path rail, excluding the terminal "cancelled" state. */
export const ORDER_FLOW: { key: OrderStatus; label: string; hint: string }[] = [
  { key: "pending_payment", label: "Pending Payment", hint: "We're waiting for your bank transfer." },
  { key: "payment_verification", label: "Payment Verification", hint: "We're checking your transfer reference." },
  { key: "paid", label: "Paid", hint: "Payment confirmed — your order is confirmed." },
  { key: "processing", label: "Processing", hint: "Your items are being packed." },
  { key: "shipped", label: "Shipped", hint: "Your parcel has left our warehouse." },
  { key: "out_for_delivery", label: "Out for Delivery", hint: "A rider is bringing it to you today." },
  { key: "delivered", label: "Delivered", hint: "Enjoy your order." },
];

export type PaymentStatus = "unpaid" | "awaiting_verification" | "paid" | "rejected";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  awaiting_verification: "Awaiting verification",
  paid: "Paid",
  rejected: "Rejected",
};

export const PAYMENT_REVIEW_LABEL: Record<string, string> = {
  awaiting_verification: "Awaiting verification",
  verified: "Verified",
  rejected: "Rejected",
};

/** Tailwind classes for a status pill. Kept here so every surface agrees. */
export function statusTone(status: string): string {
  switch (status) {
    case "delivered":
    case "paid":
    case "verified":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "shipped":
    case "out_for_delivery":
    case "processing":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "payment_verification":
    case "awaiting_verification":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "cancelled":
    case "rejected":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT — Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// ── Aliases used by the order surfaces ───────────────────────────────────────
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

export function orderStatusTone(status: string): string {
  return statusTone(status);
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status as PaymentStatus] ?? status;
}

export function paymentStatusTone(status: string): string {
  return statusTone(status);
}
