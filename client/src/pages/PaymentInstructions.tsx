import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatNaira, paymentStatusLabel, paymentStatusTone } from "@/lib/format";

/**
 * Payment instructions. Every bank detail here comes from the payment_settings
 * row — nothing is hardcoded, so an admin edit changes this page immediately.
 */
export default function PaymentInstructions({ orderId }: { orderId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();

  const order = trpc.orders.detail.useQuery({ orderId }, { enabled: Boolean(user) });
  const settings = trpc.payments.settings.useQuery();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const submit = trpc.payments.submitReference.useMutation({
    onSuccess: () => {
      utils.orders.detail.invalidate({ orderId });
      utils.orders.list.invalidate();
      utils.notifications.list.invalidate();
      setReference("");
      setNote("");
      toast.success("Reference submitted — we'll verify it shortly.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading || order.isLoading) {
    return <StoreLayout><div className="mx-auto max-w-3xl px-4 py-8"><Skeleton className="h-96 w-full rounded-xl" /></div></StoreLayout>;
  }

  if (!user) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState title="Sign in to view this order" action={<Link to="/login"><Button>Sign in</Button></Link>} />
        </div>
      </StoreLayout>
    );
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
  const s = settings.data;
  const latestPayment = o.payments[0] ?? null;
  const awaiting = latestPayment?.status === "awaiting_verification";
  const verified = latestPayment?.status === "verified";
  const rejected = latestPayment?.status === "rejected";
  const canSubmit = !verified && !awaiting && o.status !== "cancelled";

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1800);
      },
      () => toast.error("Couldn't copy — select the text manually"),
    );
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Confirmation banner */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5" aria-hidden="true">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-extrabold text-emerald-950">Order placed</h1>
              <p className="mt-0.5 text-sm text-emerald-900/80">
                Order <span className="font-mono font-bold">{o.orderNumber}</span> is reserved for you.
                Complete the bank transfer below to confirm it.
              </p>
            </div>
          </div>
        </div>

        {/* Amount + status */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount to transfer</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{formatNaira(o.total)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Transfer exactly this amount so we can match it.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment status</p>
            <div className="mt-1.5">
              <Badge tone={paymentStatusTone(o.paymentStatus)}>{paymentStatusLabel(o.paymentStatus)}</Badge>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Order status: <span className="font-medium text-foreground">{o.statusLabel}</span>
            </p>
          </div>
        </div>

        {/* Bank details */}
        <section className="mt-4 rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-bold">Bank transfer details</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              These details are set by the store and update automatically.
            </p>
          </div>

          {settings.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-1/2" /></div>
          ) : !s || !s.bankName ? (
            <div className="p-4">
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                The store hasn't published its bank details yet. Please contact support with your
                order number — do not send money to any account you were not given here.
              </p>
            </div>
          ) : (
            <dl className="divide-y">
              {[
                ["Bank name", s.bankName, "bank"],
                ["Account name", s.accountName, "name"],
                ["Account number", s.accountNumber, "number"],
              ].map(([label, value, key]) => (
                <div key={String(key)} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 truncate font-mono text-sm font-bold">{value}</dd>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => copy(String(value), String(key))}
                  >
                    {copied === key ? "Copied" : "Copy"}
                  </Button>
                </div>
              ))}
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reference to use</dt>
                <dd className="mt-0.5 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-sm font-bold">{o.orderNumber}</span>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => copy(o.orderNumber, "ref")}>
                    {copied === "ref" ? "Copied" : "Copy"}
                  </Button>
                </dd>
              </div>
            </dl>
          )}

          {s?.instructions && (
            <div className="border-t bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Instructions</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{s.instructions}</p>
            </div>
          )}
        </section>

        {/* Reference submission */}
        <section className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">Submit your payment reference</h2>

          {verified ? (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
              <p className="font-semibold">Payment verified</p>
              <p className="mt-0.5 text-emerald-900/80">
                We've confirmed your transfer. Your order is now being prepared.
              </p>
            </div>
          ) : awaiting ? (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-semibold">Awaiting verification</p>
              <p className="mt-0.5 text-amber-900/80">
                We received reference <span className="font-mono font-semibold">{latestPayment?.reference}</span> and
                are checking it against our account. You'll be notified here once it's confirmed.
              </p>
            </div>
          ) : (
            <>
              {rejected && (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
                  <p className="font-semibold">Previous reference rejected</p>
                  <p className="mt-0.5 text-rose-900/80">
                    {latestPayment?.adminNote
                      ? latestPayment.adminNote
                      : "We couldn't match that reference to a transfer."}{" "}
                    Please check your bank app and submit the correct reference below.
                  </p>
                </div>
              )}

              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reference.trim().length < 4) {
                    toast.error("Enter the reference from your bank transfer");
                    return;
                  }
                  submit.mutate({ orderId: o.id, reference: reference.trim(), note: note.trim() || undefined });
                }}
              >
                <div>
                  <Label htmlFor="ref" className="text-xs">Payment reference / transaction ID</Label>
                  <Input
                    id="ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. TRF-20261106-8842190"
                    maxLength={120}
                    required
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Find this in your bank app or transfer receipt. It's usually 8–20 characters.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pnote" className="text-xs">Note (optional)</Label>
                  <Textarea
                    id="pnote"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything that helps us find your transfer — e.g. the sender's name if it differs from your account."
                    maxLength={500}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={submit.isPending || !canSubmit}>
                  {submit.isPending ? "Submitting…" : "Submit reference"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Submitting a reference does not mark the order paid — a person verifies it first.
                </p>
              </form>
            </>
          )}
        </section>

        {/* Order summary */}
        <section className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">What you ordered</h2>
          <ul className="mt-3 divide-y">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-2.5">
                <div className="size-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {it.imageUrl && <img src={it.imageUrl} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.variantLabel ? `${it.variantLabel} · ` : ""}Qty {it.quantity}
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

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={`/orders/${o.id}`}><Button variant="outline">View order details</Button></Link>
          <Link to="/orders"><Button variant="ghost">All my orders</Button></Link>
          <Link to="/search"><Button variant="ghost">Continue shopping</Button></Link>
        </div>
      </div>
    </StoreLayout>
  );
}
