import { useState } from "react";
import { Search, ShieldCheck, ShieldOff, Ban, CheckCircle2 } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { AdminLayout, AdminPageHeader, AdminDenied } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatNaira } from "@/lib/format";

export default function AdminUsers() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const list = trpc.admin.users.useQuery({ q: q || undefined, page, pageSize: 20 }, { enabled: isAdmin });
  const detail = trpc.admin.user.useQuery({ id: openId ?? "" }, { enabled: isAdmin && Boolean(openId) });

  const setRoleM = trpc.admin.setRole.useMutation();
  const setSuspM = trpc.admin.setSuspended.useMutation();

  async function changeRole(id: string, role: "user" | "admin") {
    const verb = role === "admin" ? "grant admin access to" : "revoke admin access from";
    if (!window.confirm(`Are you sure you want to ${verb} this account?`)) return;
    try {
      await setRoleM.mutateAsync({ id, role });
      toast.success(role === "admin" ? "Admin access granted." : "Admin access revoked.");
      await utils.admin.users.invalidate();
      await utils.admin.user.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the role.");
    }
  }

  async function toggleSuspend(id: string, suspended: boolean) {
    try {
      await setSuspM.mutateAsync({ id, suspended });
      toast.success(suspended ? "Account suspended." : "Account reactivated.");
      await utils.admin.users.invalidate();
      await utils.admin.user.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the account.");
    }
  }

  if (authLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-8 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </AdminLayout>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Customers"
        description="Accounts, order history and access levels. Role changes are audited by the server."
      />

      <div className="relative mb-3 max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Name or email…"
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      {list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={q ? "No accounts match that search" : "No accounts yet"}
          description={q ? "Try a different name or email." : "Customers appear here when they sign up."}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Account</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Joined</th>
                  <th className="px-3 py-2.5 text-right">Orders</th>
                  <th className="hidden px-3 py-2.5 text-right md:table-cell">Spent</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data?.items.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-semibold">{u.name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      {u.isSuspended && (
                        <span className="mt-0.5 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground sm:table-cell">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">{u.orderCount}</td>
                    <td className="hidden px-3 py-2.5 text-right text-xs font-medium md:table-cell">
                      {formatNaira(u.totalSpent)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={
                          u.role === "admin"
                            ? "bg-primary/10 text-primary ring-primary/20"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setOpenId(u.id)}>
                        Manage
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
                Page {list.data.page} · {list.data.total} accounts
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

      {/* Manage drawer */}
      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <h2 className="text-sm font-bold">Manage account</h2>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded px-2 py-1 text-xs font-semibold hover:bg-muted"
              >
                Close
              </button>
            </div>

            {detail.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : detail.isError ? (
              <div className="p-4">
                <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />
              </div>
            ) : detail.data ? (
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-base font-bold">{detail.data.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{detail.data.email}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Joined {formatDate(detail.data.createdAt)}
                    {detail.data.phone ? ` · ${detail.data.phone}` : ""}
                  </p>
                </div>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Access</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.data.role === "admin" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeRole(detail.data!.id, "user")}
                        disabled={setRoleM.isPending || detail.data.id === user?.id}
                      >
                        <ShieldOff className="size-3.5" /> Revoke admin
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => changeRole(detail.data!.id, "admin")} disabled={setRoleM.isPending}>
                        <ShieldCheck className="size-3.5" /> Grant admin
                      </Button>
                    )}
                    {detail.data.isSuspended ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSuspend(detail.data!.id, false)}
                        disabled={setSuspM.isPending}
                      >
                        <CheckCircle2 className="size-3.5" /> Reactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSuspend(detail.data!.id, true)}
                        disabled={setSuspM.isPending || detail.data.id === user?.id}
                      >
                        <Ban className="size-3.5" /> Suspend
                      </Button>
                    )}
                  </div>
                  {detail.data.id === user?.id && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      You cannot revoke or suspend your own account. The server also refuses to remove the last
                      remaining administrator.
                    </p>
                  )}
                </section>

                <section className="rounded-lg border p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Order history ({detail.data.orders.length})
                  </h3>
                  {detail.data.orders.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">This customer has not ordered yet.</p>
                  ) : (
                    <ul className="mt-1 divide-y">
                      {detail.data.orders.map((o) => (
                        <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] font-semibold">{o.orderNumber}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(o.createdAt)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold">{formatNaira(o.total)}</p>
                            <p className="text-[10px] text-muted-foreground">{o.orderStatus.replace(/_/g, " ")}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
