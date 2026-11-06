import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { AdminLayout, AdminPageHeader, AdminDenied } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { formatNaira, formatDateTime, orderStatusTone, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Admin overview. Every number here is a live aggregate from adminStats() —
 * there is no seeded or placeholder figure anywhere on this page.
 */
export default function AdminOverview() {
  const { user, isLoading: authLoading } = useAuth();
  const stats = trpc.admin.stats.useQuery(undefined, { enabled: user?.role === "admin" });

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }
  if (user?.role !== "admin") return <AdminDenied />;
  if (stats.isError) {
    return (
      <AdminLayout>
        <ErrorState message={stats.error.message} onRetry={() => stats.refetch()} />
      </AdminLayout>
    );
  }

  const s = stats.data;
  const maxRevenue = Math.max(1, ...(s?.salesByDay.map((d) => d.revenue) ?? [1]));

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Overview"
        description="Live figures from your store's database."
        action={
          <Link
            to="/admin/products"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Manage products
          </Link>
        }
      />

      {!s ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Revenue (verified)" value={formatNaira(s.revenue)} tone="emerald" hint={`${s.paidOrders} paid order${s.paidOrders === 1 ? "" : "s"}`} />
            <Kpi label="Total orders" value={String(s.totalOrders)} hint="All time" />
            <Kpi label="Pending payments" value={String(s.pendingPayments)} tone="amber" hint="Awaiting your verification" />
            <Kpi label="Verified payments" value={String(s.verifiedPayments)} tone="emerald" hint={`${s.rejectedPayments} rejected`} />
            <Kpi label="Customers" value={String(s.totalCustomers)} hint="Registered accounts" />
            <Kpi label="Products" value={String(s.totalProducts)} hint={`${s.activeProducts} active`} />
            <Kpi label="Low stock" value={String(s.lowStock.length)} tone={s.lowStock.length ? "rose" : undefined} hint="At or below 5 units" />
            <Kpi label="Avg. order value" value={s.paidOrders ? formatNaira(Math.round(s.revenue / s.paidOrders)) : "—"} hint="On paid orders" />
          </div>

          {/* Sales chart */}
          <section className="mt-5 rounded-xl border bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold">Sales — last 14 days</h2>
              <span className="text-[11px] text-muted-foreground">Order value per day</span>
            </div>
            {s.salesByDay.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No orders in the last 14 days yet. The chart fills in as orders arrive.
              </p>
            ) : (
              <div className="mt-4 flex h-40 items-end justify-center gap-1.5 border-b border-border/70" role="img" aria-label="Daily order value for the last 14 days">
                {s.salesByDay.map((d) => (
                  <div key={d.day} className="group relative flex h-full max-w-[46px] flex-1 flex-col items-center justify-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary/70 to-primary transition-all group-hover:from-primary group-hover:to-violet-500"
                      style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
                      title={`${d.day}: ${formatNaira(d.revenue)} · ${d.orders} order(s)`}
                    />
                    <span className="mt-1 hidden text-[9px] text-muted-foreground sm:block">
                      {d.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {/* Recent orders */}
            <section className="rounded-xl border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-bold">Recent orders</h2>
                <Link to="/admin/orders" className="text-xs font-semibold text-primary hover:underline">
                  View all
                </Link>
              </div>
              {s.recentOrders.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No orders yet"
                    description="Orders appear here the moment a customer checks out."
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {s.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        to={`/admin/orders?order=${o.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-semibold">{o.orderNumber}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{o.customerEmail}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold">{formatNaira(o.total)}</p>
                          <Badge tone={orderStatusTone(o.orderStatus)} className="mt-0.5">
                            {o.orderStatus.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Low stock */}
            <section className="rounded-xl border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-bold">Low stock alerts</h2>
                <Link to="/admin/products" className="text-xs font-semibold text-primary hover:underline">
                  Restock
                </Link>
              </div>
              {s.lowStock.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Stock levels are healthy" description="Nothing is at or below 5 units." />
                </div>
              ) : (
                <ul className="divide-y">
                  {s.lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <p className="min-w-0 truncate text-sm">{p.name}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          p.stock === 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Top products */}
            <section className="rounded-xl border bg-white">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-bold">Best-selling products</h2>
              </div>
              {s.topProducts.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No sales recorded yet" description="Ranked by units sold across all orders." />
                </div>
              ) : (
                <ul className="divide-y">
                  {s.topProducts.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm">{p.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.units} sold</span>
                      <span className="shrink-0 text-sm font-semibold">{formatNaira(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Activity */}
            <section className="rounded-xl border bg-white">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-bold">Recent activity</h2>
              </div>
              {s.recentActivity.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="Nothing to report"
                    description="New orders, payment references and stock warnings land here."
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {s.recentActivity.map((n) => (
                    <li key={n.id} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Figures generated {formatDateTime(new Date())} from live database records.
          </p>
        </>
      )}
    </AdminLayout>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "amber" | "rose";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-extrabold tracking-tight",
          tone === "emerald" && "text-emerald-600",
          tone === "amber" && "text-amber-600",
          tone === "rose" && "text-rose-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
