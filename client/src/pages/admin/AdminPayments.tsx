import { useState } from "react";
import { Search, Check, X as XIcon } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { AdminLayout, AdminPageHeader, AdminDenied } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatNaira } from "@/lib/format";

const TABS = [
  { value: "awaiting_verification", label: "Pending verification" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All submissions" },
];

/**
 * Manual payment verification. Approving here is the ONLY path that can set an
 * order to paid — submitting a reference never does.
 */
export default function AdminPayments() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [status, setStatus] = useState("awaiting_verification");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<{ id: string; decision: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");

  const isAdmin = user?.role === "admin";
  const list = trpc.admin.payments.useQuery(
    { status, q: q || undefined, page, pageSize: 20 },
    { enabled: isAdmin },
  );
  const reviewM = trpc.admin.reviewPayment.useMutation();

  async function submitReview() {
    if (!reviewing) return;
    if (reviewing.decision === "reject" && note.trim().length < 3) {
      toast.error("Add a short note so the customer knows what to correct.");
      return;
    }
    try {
      await reviewM.mutateAsync({ id: reviewing.id, decision: reviewing.decision, adminNote: note.trim() || undefined });
      toast.success(reviewing.decision === "approve" ? "Payment verified — order marked paid." : "Payment rejected.");
      setReviewing(null);
      setNote("");
      await utils.admin.payments.invalidate();
      await utils.admin.stats.invalidate();
      await utils.admin.orders.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not review the payment.");
    }
  }

  if (authLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-8 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </AdminLayout>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Payments"
        description="Verify bank-transfer references against your account before marking an order paid."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setStatus(t.value);
                setPage(1);
              }}
              className={
                status === t.value
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Reference, order or email…"
            className="pl-9"
            aria-label="Search payments"
          />
        </div>
      </div>

      {list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={
            status === "awaiting_verification"
              ? "Nothing waiting for verification"
              : status === "verified"
                ? "No verified payments yet"
                : status === "rejected"
                  ? "No rejected payments"
                  : "No payment submissions yet"
          }
          description={
            status === "awaiting_verification"
              ? "When a customer submits a transfer reference it lands here for you to check."
              : "Submissions appear here once customers start paying by bank transfer."
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {list.data?.items.map((p) => (
              <li key={p.id} className="rounded-xl border bg-white p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{p.reference}</span>
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      Order <span className="font-mono font-semibold text-foreground">{p.orderNumber}</span> ·{" "}
                      {p.customerName ?? p.customerEmail} · {p.customerEmail}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Submitted {formatDateTime(p.submittedAt)}
                      {p.reviewedAt ? ` · reviewed ${formatDateTime(p.reviewedAt)}` : ""}
                    </p>
                    {p.note && (
                      <p className="mt-1.5 rounded bg-slate-50 px-2 py-1 text-xs">
                        <span className="font-semibold">Customer note:</span> {p.note}
                      </p>
                    )}
                    {p.adminNote && (
                      <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs">
                        <span className="font-semibold">Your note:</span> {p.adminNote}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expected</p>
                    <p className="text-lg font-extrabold">{formatNaira(p.orderTotal)}</p>
                    {p.status === "awaiting_verification" && (
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewing({ id: p.id, decision: "approve" });
                            setNote("");
                          }}
                        >
                          <Check className="size-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewing({ id: p.id, decision: "reject" });
                            setNote("");
                          }}
                        >
                          <XIcon className="size-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {list.data && list.data.total > list.data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {list.data.page} · {list.data.total} submissions
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

      {/* Review dialog */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold">
              {reviewing.decision === "approve" ? "Approve this payment?" : "Reject this payment?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {reviewing.decision === "approve"
                ? "Confirm you have seen this reference in your bank statement. The order will be marked paid and the customer notified."
                : "The customer will be told the reference could not be verified and can submit a corrected one."}
            </p>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="admin-note">
                Internal note {reviewing.decision === "reject" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="admin-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  reviewing.decision === "approve"
                    ? "e.g. Matched ₦24,500 credit on 6 Nov, ref ends 4471."
                    : "e.g. No matching credit found for this reference."
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {reviewing.decision === "reject"
                  ? "This note is shown to the customer."
                  : "Internal only — the customer sees a generic confirmation."}
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewing(null)} disabled={reviewM.isPending}>
                Cancel
              </Button>
              <Button
                onClick={submitReview}
                disabled={reviewM.isPending}
                variant={reviewing.decision === "reject" ? "destructive" : "default"}
              >
                {reviewM.isPending ? "Saving…" : reviewing.decision === "approve" ? "Approve payment" : "Reject payment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
