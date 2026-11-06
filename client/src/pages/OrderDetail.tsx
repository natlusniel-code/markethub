import { Link, useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatNaira,
  orderStatusTone,
  ORDER_FLOW,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/format";

export default function OrderDetail({ orderId }: { orderId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const order = trpc.orders.detail.useQuery({ orderId }, { enabled: Boolean(user) });

  if (authLoading || order.isLoading) {
    return <StoreLayout><div className="mx-auto max-w-3xl space-y-3 px-4 py-8"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></div></StoreLayout>;
  }

  if (!user) {
    return <StoreLayout><div className="mx-auto max-w-2xl px-4 py-16"><EmptyState title="Sign in to view this order" action={<Link to="/login"><Button>Sign in</Button></Link>} /></div></StoreLayout>;
  }

  if (order.isError || !order.data) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState
            title="Order not found"
            message="This order doesn't exist, or it belongs to a different account."
            onRetry={() => navigate("/orders")}
          />
        </div>
      </StoreLayout>
    );
  }

  const o = order.data;
  const cancelled = o.status === "cancelled";
  const currentStep = ORDER_FLOW.findIndex((s) => s.key === o.status);

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/orders" className="hover:text-foreground">My orders</Link>
          <span aria-hidden="true">/</span>
          <span className="font-mono font-medium text-foreground">{o.orderNumber}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl font-extrabold tracking-tight">{o.orderNumber}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Placed {formatDateTime(o.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={paymentStatusTone(o.paymentStatus)}>{paymentStatusLabel(o.paymentStatus)}</Badge>
            <Badge tone={orderStatusTone(o.status)}>{o.statusLabel}</Badge>
          </div>
        </div>

        {/* Progress tracker */}
        <section className="mt-5 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">Order progress</h2>
          {cancelled ? (
            <p className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
              This order was cancelled. If you already transferred money, contact support with your
              order number and we'll arrange a refund.
            </p>
          ) : (
            <ol className="mt-3 space-y-0">
              {ORDER_FLOW.map((step, i) => {
                const done = i <= currentStep;
                const active = i === currentStep;
                return (
                  <li key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          active && "ring-4 ring-primary/15",
                        )}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      {i < ORDER_FLOW.length - 1 && (
                        <span className={cn("my-0.5 w-0.5 flex-1", i < currentStep ? "bg-primary" : "bg-border")} />
                      )}
                    </div>
                    <div className={cn("pb-3", i === ORDER_FLOW.length - 1 && "pb-0")}>
                      <p className={cn("text-sm", done ? "font-semibold" : "text-muted-foreground")}>{step.label}</p>
                      <p className="text-[11px] text-muted-foreground">{step.hint}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Payment */}
        <section className="mt-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Payment</h2>
            {o.paymentStatus === "unpaid" && !cancelled && (
              <Link to={`/orders/${o.id}/payment`}><Button size="sm">Pay now</Button></Link>
            )}
          </div>

          {o.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No payment reference submitted yet.{" "}
              {!cancelled && <Link to={`/orders/${o.id}/payment`} className="font-semibold text-primary hover:underline">Get the bank details →</Link>}
            </p>
          ) : (
            <ul className="mt-2 divide-y">
              {o.payments.map((p) => (
                <li key={p.id} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{p.reference}</span>
                    <Badge tone={paymentStatusTone(p.status === "verified" ? "paid" : p.status === "rejected" ? "rejected" : "awaiting_verification")}>
                      {p.status === "verified" ? "Verified" : p.status === "rejected" ? "Rejected" : "Awaiting verification"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Submitted {formatDateTime(p.submittedAt)}</p>
                  {p.note && <p className="mt-1 text-xs text-muted-foreground">Your note: {p.note}</p>}
                  {p.adminNote && (
                    <p className="mt-1 rounded bg-muted px-2 py-1 text-xs">
                      <span className="font-semibold">Store note:</span> {p.adminNote}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Items */}
        <section className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">Items</h2>
          <ul className="mt-2 divide-y">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-2.5">
                <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {it.imageUrl && <img src={it.imageUrl} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.variantLabel ? `${it.variantLabel} · ` : ""}Qty {it.quantity} × {formatNaira(it.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatNaira(it.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatNaira(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{o.deliveryFee === 0 ? "Free" : formatNaira(o.deliveryFee)}</dd></div>
            <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{formatNaira(o.total)}</dd></div>
          </dl>
        </section>

        {/* Delivery */}
        <section className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">Delivery address</h2>
          <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
            <span className="block font-semibold text-foreground">{o.address.fullName}</span>
            {o.address.line1}
            {o.address.line2 ? `, ${o.address.line2}` : ""}
            <br />
            {o.address.city}, {o.address.state}
            {o.address.postalCode ? ` ${o.address.postalCode}` : ""}
            <br />
            {o.address.phone}
          </address>
          {o.customerNote && (
            <p className="mt-2 rounded bg-muted px-2 py-1.5 text-xs">
              <span className="font-semibold">Your note:</span> {o.customerNote}
            </p>
          )}
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/orders"><Button variant="outline">All orders</Button></Link>
          <Link to="/search"><Button variant="ghost">Continue shopping</Button></Link>
        </div>
      </div>
    </StoreLayout>
  );
}
