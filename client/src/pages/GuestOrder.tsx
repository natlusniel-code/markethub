import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/_core/trpc";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatNaira } from "@/lib/format";

/**
 * Guest order tracking.
 *
 * A guest has no session, so the order number + the phone number given at
 * checkout ARE the credential. Both are read from the URL when arriving straight
 * from checkout, and can be typed in when coming back later.
 */
export default function GuestOrder() {
  const [, navigate] = useLocation();
  const toast = useToast();
  // `useSearch()` is wouter's own hook for the query string. Reading it off
  // `useLocation()`'s path does NOT work — that value is the pathname only, so
  // the params were always empty and the page fell back to a blank lookup form
  // even when arriving straight from checkout with both values in the URL.
  const search = useSearch();
  const params = new URLSearchParams(search);

  const [orderNumber, setOrderNumber] = useState(params.get("number") ?? "");
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [submitted, setSubmitted] = useState(Boolean(params.get("number") && params.get("phone")));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const order = trpc.guest.order.useQuery(
    { orderNumber, phone },
    { enabled: submitted && Boolean(orderNumber) && Boolean(phone), retry: false },
  );

  const submitRef = trpc.guest.submitReference.useMutation({
    onSuccess: () => {
      toast.success("Reference submitted — we'll verify it shortly");
      setReference("");
      setNote("");
      order.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function lookup() {
    if (!orderNumber.trim() || !phone.trim()) {
      toast.error("Enter both the order number and your phone number");
      return;
    }
    setSubmitted(true);
    navigate(`/guest/order?number=${encodeURIComponent(orderNumber.trim())}&phone=${encodeURIComponent(phone.trim())}`);
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Track your order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the order number and the phone number you used at checkout.
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label className="mb-1 block text-xs">Order number</Label>
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="MH-XXXXXX"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Phone number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803 000 0000"
              inputMode="tel"
            />
          </div>
          <Button onClick={lookup} className="sm:mb-0">Find order</Button>
        </div>

        {submitted && order.isLoading && (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        )}

        {submitted && order.isError && (
          <div className="mt-6">
            <ErrorState
              message="No order matches that number and phone number. Check both and try again."
              onRetry={() => order.refetch()}
            />
          </div>
        )}

        {order.data && (
          <div className="mt-6 space-y-5">
            <section className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                  <p className="text-lg font-extrabold">{order.data.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Placed {formatDate(order.data.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {order.data.statusLabel}
                  </span>
                  <p className="mt-1.5 text-lg font-extrabold">{formatNaira(order.data.total)}</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Delivering to</dt>
                  <dd className="mt-0.5 font-medium">
                    {order.data.address.fullName}
                    <br />
                    <span className="text-muted-foreground">
                      {order.data.address.line1}
                      {order.data.address.line2 ? `, ${order.data.address.line2}` : ""}
                      <br />
                      {order.data.address.city}, {order.data.address.state}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Payment</dt>
                  <dd className="mt-0.5 font-medium capitalize">
                    {order.data.paymentStatus.replace(/_/g, " ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Items</h2>
              <ul className="mt-3 divide-y">
                {order.data.items.map((line) => (
                  <li key={line.id} className="flex items-center gap-3 py-2.5">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {line.imageUrl && <img src={line.imageUrl} alt="" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.variantLabel ? `${line.variantLabel} · ` : ""}Qty {line.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{formatNaira(line.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatNaira(order.data.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd>{order.data.deliveryFee === 0 ? "Free" : formatNaira(order.data.deliveryFee)}</dd>
                </div>
                <div className="flex justify-between font-bold">
                  <dt>Total</dt>
                  <dd>{formatNaira(order.data.total)}</dd>
                </div>
              </dl>
            </section>

            {order.data.paymentStatus !== "paid" && order.data.status !== "cancelled" && (
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-bold">Payment</h2>
                {order.data.payments.some((p) => p.status === "awaiting_verification") ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Your reference is with us and is being verified. This page updates once it is confirmed.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Transfer {formatNaira(order.data.total)} to the account shown at checkout, then enter the
                      transfer reference below. We verify it before marking the order paid.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label className="mb-1 block text-xs">Transfer reference</Label>
                        <Input
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="e.g. TRF-8891234"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs">Note (optional)</Label>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Anything we should know about this transfer?"
                          maxLength={500}
                        />
                      </div>
                      <Button
                        onClick={() =>
                          submitRef.mutate({
                            orderNumber: order.data!.orderNumber,
                            phone,
                            reference: reference.trim(),
                            note: note.trim() || undefined,
                          })
                        }
                        disabled={submitRef.isPending || reference.trim().length < 4}
                      >
                        {submitRef.isPending ? "Submitting…" : "Submit reference"}
                      </Button>
                    </div>
                  </>
                )}
              </section>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Want to track orders without re-entering these details?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline">Create an account</Link>
            </p>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
