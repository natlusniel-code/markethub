import { Link, useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useGuestCart } from "@/_core/guest-cart";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatNaira } from "@/lib/format";

export default function Cart() {
  const { user, isLoading: authLoading } = useAuth();
  const guestCart = useGuestCart();
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();

  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user) });
  const setQty = trpc.cart.setQuantity.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.cart.remove.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success("Removed from cart");
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-5xl px-4 py-8"><Skeleton className="h-64 w-full rounded-xl" /></div>
      </StoreLayout>
    );
  }

  // ── guest cart ─────────────────────────────────────────────────────────────
  // Same layout as the signed-in cart, driven by localStorage instead of the
  // server. Prices shown here are the ones captured when the item was added;
  // the server recomputes them at checkout, so a stale display cannot become a
  // wrong charge.
  if (!user) {
    if (guestCart.lines.length === 0) {
      return (
        <StoreLayout>
          <div className="mx-auto max-w-2xl px-4 py-16">
            <EmptyState
              title="Your cart is empty"
              description="Nothing here yet. Browse the shop and add something you like — you can check out as a guest, no account needed."
              action={<Link to="/search"><Button>Start shopping</Button></Link>}
            />
          </div>
        </StoreLayout>
      );
    }

    return (
      <StoreLayout>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Your cart{" "}
            <span className="text-base font-normal text-muted-foreground">
              ({guestCart.count} item{guestCart.count === 1 ? "" : "s"})
            </span>
          </h1>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <ul className="divide-y rounded-xl border bg-card">
              {guestCart.lines.map((line) => {
                const maxQty = Math.min(20, line.availableStock);
                return (
                  <li key={`${line.productId}:${line.variantId ?? ""}`} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                    <Link to={`/product/${line.slug}`} className="shrink-0">
                      <div className="size-20 overflow-hidden rounded-lg border bg-muted sm:size-24">
                        {line.imageUrl ? (
                          <img src={line.imageUrl} alt={line.name} className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">No image</div>
                        )}
                      </div>
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/product/${line.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                          {line.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => guestCart.remove(line.productId, line.variantId)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove ${line.name} from cart`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>

                      {line.variantLabel && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{line.variantLabel}</p>
                      )}

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div className="inline-flex items-center rounded-lg border">
                          <button
                            type="button"
                            onClick={() => guestCart.setQuantity(line.productId, line.variantId, line.quantity - 1)}
                            disabled={line.quantity <= 1}
                            aria-label="Decrease quantity"
                            className="px-2.5 py-1 text-base leading-none disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-7 text-center text-sm font-semibold">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => guestCart.setQuantity(line.productId, line.variantId, line.quantity + 1)}
                            disabled={line.quantity >= maxQty}
                            aria-label="Increase quantity"
                            className="px-2.5 py-1 text-base leading-none disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-extrabold">{formatNaira(line.unitPrice * line.quantity)}</p>
                          {line.quantity > 1 && (
                            <p className="text-[11px] text-muted-foreground">{formatNaira(line.unitPrice)} each</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="lg:sticky lg:top-40 lg:self-start">
              <div className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-bold">Order summary</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-semibold">{formatNaira(guestCart.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="font-semibold">
                      {guestCart.deliveryFee === 0 ? (
                        <span className="text-emerald-600">Free</span>
                      ) : (
                        formatNaira(guestCart.deliveryFee)
                      )}
                    </dd>
                  </div>
                  {guestCart.deliveryFee > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Add {formatNaira(guestCart.freeDeliveryThreshold - guestCart.subtotal)} more for free delivery.
                    </p>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base">
                    <dt className="font-bold">Total</dt>
                    <dd className="font-extrabold">{formatNaira(guestCart.total)}</dd>
                  </div>
                </dl>

                <Button size="lg" className="mt-4 w-full" onClick={() => navigate("/checkout")}>
                  Proceed to checkout
                </Button>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  No account needed — you can check out as a guest.
                </p>
                <Link to="/search" className="mt-2 block text-center text-xs font-semibold text-primary hover:underline">
                  Continue shopping
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </StoreLayout>
    );
  }

  // ── signed-in cart ─────────────────────────────────────────────────────────
  if (cart.isLoading) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </StoreLayout>
    );
  }

  if (cart.isError) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState message={cart.error.message} onRetry={() => cart.refetch()} />
        </div>
      </StoreLayout>
    );
  }

  const data = cart.data!;

  if (data.items.length === 0) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState
            title="Your cart is empty"
            description="Nothing here yet. Browse the shop and add something you like."
            action={<Link to="/search"><Button>Start shopping</Button></Link>}
          />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Your cart <span className="text-base font-normal text-muted-foreground">({data.count} item{data.count === 1 ? "" : "s"})</span>
        </h1>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ul className="divide-y rounded-xl border bg-card">
            {data.items.map((line) => {
              const maxQty = Math.min(20, line.availableStock);
              return (
                <li key={line.id} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                  <Link to={`/product/${line.slug}`} className="shrink-0">
                    <div className="size-20 overflow-hidden rounded-lg border bg-muted sm:size-24">
                      {line.imageUrl ? (
                        <img src={line.imageUrl} alt={line.name} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">No image</div>
                      )}
                    </div>
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/product/${line.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                        {line.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove.mutate({ itemId: line.id })}
                        disabled={remove.isPending}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remove ${line.name} from cart`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                          <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>

                    {line.variantLabel && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{line.variantLabel}</p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="inline-flex items-center rounded-lg border">
                        <button
                          type="button"
                          onClick={() => setQty.mutate({ itemId: line.id, quantity: line.quantity - 1 })}
                          disabled={line.quantity <= 1 || setQty.isPending}
                          aria-label="Decrease quantity"
                          className="px-2.5 py-1 text-base leading-none disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-7 text-center text-sm font-semibold">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQty.mutate({ itemId: line.id, quantity: line.quantity + 1 })}
                          disabled={line.quantity >= maxQty || setQty.isPending}
                          aria-label="Increase quantity"
                          className="px-2.5 py-1 text-base leading-none disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-extrabold">{formatNaira(line.lineTotal)}</p>
                        {line.quantity > 1 && (
                          <p className="text-[11px] text-muted-foreground">{formatNaira(line.unitPrice)} each</p>
                        )}
                      </div>
                    </div>

                    {line.availableStock < line.quantity && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600">
                        Only {line.availableStock} in stock — reduce the quantity to continue.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Summary */}
          <aside className="lg:sticky lg:top-40 lg:self-start">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Order summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-semibold">{formatNaira(data.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="font-semibold">
                    {data.deliveryFee === 0 ? (
                      <span className="text-emerald-600">Free</span>
                    ) : (
                      formatNaira(data.deliveryFee)
                    )}
                  </dd>
                </div>
                {data.deliveryFee > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Add {formatNaira(data.freeDeliveryThreshold - data.subtotal)} more for free delivery.
                  </p>
                )}
                <div className="flex justify-between border-t pt-2 text-base">
                  <dt className="font-bold">Total</dt>
                  <dd className="font-extrabold">{formatNaira(data.total)}</dd>
                </div>
              </dl>

              <Button
                size="lg"
                className="mt-4 w-full"
                disabled={data.hasStockIssue}
                onClick={() => navigate("/checkout")}
              >
                Proceed to checkout
              </Button>
              {data.hasStockIssue && (
                <p className="mt-2 text-[11px] font-medium text-rose-600">
                  Fix the stock issues above before checking out.
                </p>
              )}
              <Link to="/search" className="mt-2 block text-center text-xs font-semibold text-primary hover:underline">
                Continue shopping
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </StoreLayout>
  );
}
