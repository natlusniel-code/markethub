import { useEffect, useState } from "react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { AdminLayout, AdminPageHeader, AdminDenied } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/**
 * Bank details shown on the customer payment-instructions page. Stored in the
 * payment_settings singleton row — never hardcoded in the frontend.
 */
export default function AdminSettings() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  const settings = trpc.admin.paymentSettings.useQuery(undefined, { enabled: isAdmin });
  const saveM = trpc.admin.updatePaymentSettings.useMutation();

  const [form, setForm] = useState({ bankName: "", accountName: "", accountNumber: "", instructions: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data) {
      setForm({
        bankName: settings.data.bankName,
        accountName: settings.data.accountName,
        accountNumber: settings.data.accountNumber,
        instructions: settings.data.instructions,
      });
    }
  }, [settings.data]);

  async function save() {
    const e: Record<string, string> = {};
    if (form.bankName.trim().length < 2) e.bankName = "Enter the bank name.";
    if (form.accountName.trim().length < 2) e.accountName = "Enter the account name.";
    if (form.accountNumber.trim().length < 6) e.accountNumber = "Enter a valid account number.";
    if (form.instructions.trim().length < 10) e.instructions = "Give customers at least a sentence of guidance.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    try {
      await saveM.mutateAsync({
        bankName: form.bankName.trim(),
        accountName: form.accountName.trim(),
        accountNumber: form.accountNumber.trim(),
        instructions: form.instructions.trim(),
      });
      toast.success("Payment settings saved. Customers see this immediately.");
      await utils.admin.paymentSettings.invalidate();
      await utils.payments.settings.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the settings.");
    }
  }

  if (authLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full rounded-xl" />
      </AdminLayout>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Payment settings"
        description="These bank details appear on every customer's payment instructions page."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank">Bank name</Label>
              <Input
                id="bank"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="Guaranty Trust Bank"
              />
              <FieldError>{errors.bankName}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-name">Account name</Label>
              <Input
                id="acct-name"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                placeholder="MarketHub Commerce Ltd"
              />
              <FieldError>{errors.accountName}</FieldError>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="acct-no">Account number</Label>
              <Input
                id="acct-no"
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="0123456789"
                className="font-mono tracking-wider"
              />
              <FieldError>{errors.accountNumber}</FieldError>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="instructions">Payment instructions</Label>
              <Textarea
                id="instructions"
                rows={6}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Transfer the exact total, then submit your transaction reference below. Orders are processed once payment is verified, usually within a few hours."
              />
              <FieldError>{errors.instructions}</FieldError>
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t pt-4">
            <Button onClick={save} disabled={saveM.isPending}>
              {saveM.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </section>

        <aside className="rounded-xl border bg-slate-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Customer preview</h2>
          <div className="mt-2 rounded-lg border bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transfer to</p>
            <p className="mt-1 text-sm font-bold">{form.bankName || "Bank name"}</p>
            <p className="text-xs text-muted-foreground">{form.accountName || "Account name"}</p>
            <p className="mt-1 font-mono text-base font-extrabold tracking-wider">
              {form.accountNumber || "0000000000"}
            </p>
            <p className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
              {form.instructions || "Payment instructions will appear here."}
            </p>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Nothing here is hardcoded in the app — the customer page reads this row from the database on every
            visit, so a change takes effect immediately.
          </p>
        </aside>
      </div>
    </AdminLayout>
  );
}
