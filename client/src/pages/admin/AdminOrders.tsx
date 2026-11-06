import { useState } from "react";
import { useSearch } from "wouter";
import { Search, X } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { AdminLayout, AdminPageHeader, AdminDenied } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  formatDateTime,
  formatNaira,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/format";

const statusLabel = (s: string) => ORDER_STATUS_LABEL[s as (typeof ORDER_STATUSES)[number]] ?? s;

export default function AdminOrders() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();
  const search = useSearch();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === "admin";
  const list = trpc.admin.orders.useQuery(
    { q: q || undefined, status: status || undefined, page, pageSize: 20 },
    { enabled: isAdmin },
  );

  const openId = new URLSearchParams(search).get("order");
  const detail = trpc.admin.order.useQuery({ id: openId ?? "" }, { enabled: isAdmin && Boolean(openId) });
  const setStatusM = trpc.admin.updateOrderStatus.useMutation();

  async function changeStatus(id: string, next: string) {
    try {
      await setStatusM.mutateAsync({ id, status: next as (typeof ORDER_STATUSES)[number] });
      toast.success("Order status updated.");
      await utils.admin.orders.invalidate();
      await utils.admin.order.invalidate();
      await utils.admin.stats.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the order.");
    }
  }

  if (authLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-8 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </AdminLayout>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminLayout>
      <AdminPageHeader title="Orders" description="Every order, its payment state and its delivery progress." />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Order number, name or email…"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="w-auto"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={q || status ? "No orders match those filters" : "No orders yet"}
          description={
            q || status
              ? "Try a different search term or clear the status filter."
              : "Orders appear here as soon as a customer completes checkout."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Customer</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Payment</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data?.items.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-xs font-semibold">{o.orderNumber}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <p className="text-xs font-medium">{o.customerName ?? o.shipName}</p>
                      <p className="text-[11px] text-muted-foreground">{o.customerEmail}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatNaira(o.total)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={paymentStatusTone(o.paymentStatus)}>
                        {paymentStatusLabel(o.paymentStatus)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={orderStatusTone(o.orderStatus)}>
                        {statusLabel(o.orderStatus)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => window.location.assign(`/admin/orders?order=${o.id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {list.data && list.data.total > list.data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {list.data.page} · {list.data.total} orders
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * list.data.pageSize >= list.data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <h2 className="text-sm font-bold">Order detail</h2>
              <button
                type="button"
                onClick={() => window.location.assign("/admin/orders")}
                className="rounded p-1 hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {detail.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : detail.isError ? (
              <div className="p-4">
                <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />
              </div>
            ) : detail.data ? (
              <div className="space-y-4 p-4">
                <div>
                  <p className="font-mono text-base font-extrabold">{detail.data.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">Placed {formatDateTime(detail.data.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={paymentStatusTone(detail.data.paymentStatus)}>
                      {paymentStatusLabel(detail.data.paymentStatus)}
                    </Badge>
                    <Badge tone={orderStatusTone(detail.data.orderStatus)}>
                      {statusLabel(detail.data.orderStatus)}
                    </Badge>
                  </div>
                </div>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Customer</h3>
                  <p className="mt-1 text-sm font-medium">{detail.data.customerName ?? detail.data.shipName}</p>
                  <p className="text-xs text-muted-foreground">{detail.data.customerEmail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail.data.shipPhone}</p>
                </section>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delivery</h3>
                  <address className="mt-1 text-sm not-italic leading-relaxed">
                    {detail.data.shipName}
                    <br />
                    {detail.data.shipLine1}
                    {detail.data.shipLine2 ? `, ${detail.data.shipLine2}` : ""}
                    <br />
                    {detail.data.shipCity}, {detail.data.shipState}
                  </address>
                  {detail.data.customerNote && (
                    <p className="mt-2 rounded bg-muted px-2 py-1.5 text-xs">
                      <span className="font-semibold">Note:</span> {detail.data.customerNote}
                    </p>
                  )}
                </section>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Items</h3>
                  <ul className="mt-1 divide-y">
                    {detail.data.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 py-2">
                        <div className="size-9 shrink-0 overflow-hidden rounded border bg-muted">
                          {it.imageUrl && <img src={it.imageUrl} alt="" className="size-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-xs font-medium">{it.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {it.variantLabel ? `${it.variantLabel} · ` : ""}Qty {it.quantity}
                          </p>
                        </div>
                        <p className="text-xs font-semibold">{formatNaira(it.lineTotal)}</p>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-2 space-y-1 border-t pt-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd>{formatNaira(detail.data.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Delivery</dt>
                      <dd>{detail.data.deliveryFee === 0 ? "Free" : formatNaira(detail.data.deliveryFee)}</dd>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold">
                      <dt>Total</dt>
                      <dd>{formatNaira(detail.data.total)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Payment references
                  </h3>
                  {detail.data.payments.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No reference submitted yet.</p>
                  ) : (
                    <ul className="mt-1 divide-y">
                      {detail.data.payments.map((p) => (
                        <li key={p.id} className="py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold">{p.reference}</span>
                            <Badge
                              tone={
                                p.status === "verified"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : p.status === "rejected"
                                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                                    : "bg-amber-50 text-amber-800 ring-amber-200"
                              }
                            >
                              {p.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Submitted {formatDateTime(p.submittedAt)}
                          </p>
                          {p.adminNote && <p className="mt-1 text-[11px]">Note: {p.adminNote}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Update delivery status
                  </h3>
                  <Select
                    className="mt-2"
                    value={detail.data.orderStatus}
                    onChange={(e) => changeStatus(detail.data!.id, e.target.value)}
                    disabled={setStatusM.isPending || detail.data.orderStatus === "cancelled"}
                    aria-label="Order status"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    The customer is notified in-app for processing, shipped, out for delivery, delivered and
                    cancelled. Payment status is only changed by verifying a payment.
                  </p>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
