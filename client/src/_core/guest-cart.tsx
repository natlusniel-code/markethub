import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { deliveryFeeFor } from "@shared/constants";

// ── guest cart ───────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS: the signed-in cart lives in the database (carts.user_id is
// NOT NULL), so a visitor with no account has nowhere to put items. This is a
// localStorage-backed cart for exactly that case, and it is the ONLY place a
// price is held client-side.
//
// That price is a DISPLAY value, never an authority. When a guest checks out,
// the request carries product ids and quantities only; the server re-reads every
// price and stock figure from the database and computes the total itself. So a
// tampered localStorage entry can change what the shopper sees, but not what
// they are charged.
//
// The cart is keyed by product + variant, because two sizes of the same shoe are
// two lines with different prices.

export type GuestLine = {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  imageUrl: string | null;
  variantLabel: string | null;
  /** Display only — the server recomputes this at checkout. */
  unitPrice: number;
  quantity: number;
  /** Stock known when the item was added, used to cap the quantity stepper. */
  availableStock: number;
};

type GuestCartValue = {
  lines: GuestLine[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeDeliveryThreshold: number;
  add: (line: Omit<GuestLine, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
};

const STORAGE_KEY = "markethub.guest-cart.v1";
const MAX_QTY = 20;

const GuestCartContext = createContext<GuestCartValue | null>(null);

function sameLine(a: { productId: string; variantId: string | null }, productId: string, variantId: string | null) {
  return a.productId === productId && a.variantId === variantId;
}

/** Read the stored cart, discarding anything that is not a well-formed line. */
function load(): GuestLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l): l is GuestLine => {
      if (!l || typeof l !== "object") return false;
      const o = l as Record<string, unknown>;
      return (
        typeof o.productId === "string" &&
        typeof o.slug === "string" &&
        typeof o.name === "string" &&
        typeof o.unitPrice === "number" &&
        typeof o.quantity === "number" &&
        o.quantity > 0
      );
    });
  } catch {
    // Corrupt or unreadable storage must not break the storefront — an empty
    // cart is a far better outcome than a blank page.
    return [];
  }
}

export function GuestCartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<GuestLine[]>(load);

  // Persist on every change. Wrapped because Safari in private mode throws on
  // setItem, and a full quota must not take the page down with it.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable — the cart simply will not survive a reload */
    }
  }, [lines]);

  // Keep two tabs of the same shop in step.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setLines(load());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback<GuestCartValue["add"]>((line, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => sameLine(l, line.productId, line.variantId));
      if (existing) {
        return prev.map((l) =>
          sameLine(l, line.productId, line.variantId)
            ? { ...l, quantity: Math.min(MAX_QTY, l.availableStock, l.quantity + quantity) }
            : l,
        );
      }
      return [...prev, { ...line, quantity: Math.min(MAX_QTY, line.availableStock, quantity) }];
    });
  }, []);

  const setQuantity = useCallback<GuestCartValue["setQuantity"]>((productId, variantId, quantity) => {
    setLines((prev) =>
      prev
        .map((l) =>
          sameLine(l, productId, variantId)
            ? { ...l, quantity: Math.max(0, Math.min(MAX_QTY, l.availableStock, quantity)) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback<GuestCartValue["remove"]>((productId, variantId) => {
    setLines((prev) => prev.filter((l) => !sameLine(l, productId, variantId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<GuestCartValue>(() => {
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const deliveryFee = deliveryFeeFor(subtotal);
    return {
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      freeDeliveryThreshold: 15_000_000,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [lines, add, setQuantity, remove, clear]);

  return <GuestCartContext.Provider value={value}>{children}</GuestCartContext.Provider>;
}

export function useGuestCart(): GuestCartValue {
  const ctx = useContext(GuestCartContext);
  if (!ctx) throw new Error("useGuestCart must be used within <GuestCartProvider>");
  return ctx;
}
