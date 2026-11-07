import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useGuestCart } from "@/_core/guest-cart";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/format";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

export default function Checkout() {
  const { user, isLoading: authLoading } = useAuth();
  const guestCart = useGuestCart();
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();

  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user) });
  const addresses = trpc.addresses.list.useQuery(undefined, { enabled: Boolean(user) });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNew, setUseNew] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "Lagos",
    postalCode: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveAddress = trpc.addresses.create.useMutation({
    onSuccess: () => utils.addresses.list.invalidate(),
  });

  const placeOrder = trpc.orders.place.useMutation({
    onSuccess: (order) => {
      utils.cart.get.invalidate();
      utils.orders.list.invalidate();
      utils.notifications.list.invalidate();
      toast.success(`Order ${order.orderNumber} placed`);
      navigate(`/orders/${order.id}/payment`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Guest checkout: no session, so the order number + phone become the
  // credential the shopper uses to track the order afterwards.
  const placeGuestOrder = trpc.guest.place.useMutation({
    onSuccess: (order) => {
      guestCart.clear();
      toast.success(`Order ${order.orderNumber} placed`);
      navigate(`/guest/order?number=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.phone)}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading) {
    return <StoreLayout><div className="mx-auto max-w-5xl px-4 py-8"><Skeleton className="h-64 w-full rounded-xl" /></div></StoreLayout>;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Enter the recipient's full name";
    if (!/^[0-9+\s-]{7,20}$/.test(form.phone.trim())) e.phone = "Enter a valid phone number";
    if (!form.line1.trim()) e.line1 = "Enter a street address";
    if (!form.city.trim()) e.city = "Enter a city";
    if (!form.state.trim()) e.state = "Select a state";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── guest checkout ─────────────────────────────────────────────────────────
  if (!user) {
    if (guestCart.lines.length === 0) {
      return (
        <StoreLayout>
          <div className="mx-auto max-w-2xl px-4 py-16">
            <EmptyState
              title="Nothing to check out"
              description="Your cart is empty. Add a product first."
              action={<Link to="/search"><Button>Browse products</Button></Link>}
            />
          </div>
        </StoreLayout>
      );
    }

    function handleGuestOrder() {
      if (!validate()) {
        toast.error("Check the delivery details");
        return;
      }
      placeGuestOrder.mutate({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state,
        notes: form.notes.trim() || undefined,
        // Ids and quantities only — the server prices every line itself.
        items: guestCart.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });
    }

    return (
      <StoreLayout>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Checking out as a guest — no account needed. Step 1 of 2: delivery details.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-bold">Delivery address</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      autoComplete="name"
                      placeholder="Ada Okafor"
                    />
                  </Field>
                  <Field label="Phone number" error={errors.phone}>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="0803 000 0000"
                    />
                  </Field>
                  <Field label="State" error={errors.state}>
                    <select
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Street address" error={errors.line1} className="sm:col-span-2">
                    <Input
                      value={form.line1}
                      onChange={(e) => setForm({ ...form, line1: e.target.value })}
                      autoComplete="address-line1"
                      placeholder="12 Adeola Odeku Street"
                    />
                  </Field>
                  <Field label="Apartment, suite, etc. (optional)" className="sm:col-span-2">
                    <Input
                      value={form.line2}
                      onChange={(e) => setForm({ ...form, line2: e.target.value })}
                      autoComplete="address-line2"
                      placeholder="Flat 3B"
                    />
                  </Field>
                  <Field label="City" error={errors.city}>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      autoComplete="address-level2"
                      placeholder="Victoria Island"
                    />
                  </Field>
                  <Field label="Postal code (optional)">
                    <Input
                      value={form.postalCode}
                      onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      autoComplete="postal-code"
                      placeholder="101241"
                    />
                  </Field>
                </div>
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  Keep your phone number handy — you will use it, together with the order number, to track this order.
                </p>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-bold">Items ({guestCart.count})</h2>
                <ul className="mt-3 divide-y">
                  {guestCart.lines.map((line) => (
                    <li key={`${line.productId}:${line.variantId ?? ""}`} className="flex items-center gap-3 py-2.5">
                      <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                        {line.imageUrl && <img src={line.imageUrl} alt="" className="size-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.variantLabel ? `${line.variantLabel} · ` : ""}Qty {line.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatNaira(line.unitPrice * line.quantity)}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <Label htmlFor="notes">Order note (optional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anything the courier should know?"
                  maxLength={500}
                  className="mt-1.5"
                />
              </section>
            </div>

            <aside className="lg:sticky lg:top-40 lg:self-start">
              <div className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-bold">Payment summary</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-semibold">{formatNaira(guestCart.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="font-semibold">
                      {guestCart.deliveryFee === 0 ? <span className="text-emerald-600">Free</span> : formatNaira(guestCart.deliveryFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base">
                    <dt className="font-bold">Total due</dt>
                    <dd className="font-extrabold">{formatNaira(guestCart.total)}</dd>
                  </div>
                </dl>

                <Button
                  size="lg"
                  className="mt-4 w-full"
                  onClick={handleGuestOrder}
                  disabled={placeGuestOrder.isPending}
                >
                  {placeGuestOrder.isPending ? "Placing order…" : "Place order"}
                </Button>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  You'll get bank transfer details on the next page. Nothing is charged automatically.
                </p>
                <Link to="/cart" className="mt-2 block text-center text-xs font-semibold text-primary hover:underline">
                  Back to cart
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </StoreLayout>
    );
  }

  // ── signed-in checkout ─────────────────────────────────────────────────────
  if (cart.isLoading) {
    return <StoreLayout><div className="mx-auto max-w-5xl px-4 py-8"><Skeleton className="h-64 w-full rounded-xl" /></div></StoreLayout>;
  }

  if (cart.isError) {
    return <StoreLayout><div className="mx-auto max-w-2xl px-4 py-16"><ErrorState message={cart.error.message} onRetry={() => cart.refetch()} /></div></StoreLayout>;
  }

  const data = cart.data!;

  if (data.items.length === 0) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState
            title="Nothing to check out"
            description="Your cart is empty. Add a product first."
            action={<Link to="/search"><Button>Browse products</Button></Link>}
          />
        </div>
      </StoreLayout>
    );
  }

  const savedAddresses = addresses.data ?? [];
  const chosen = savedAddresses.find((a) => a.id === selectedAddressId) ?? null;
  const showNewForm = useNew || savedAddresses.length === 0;

  async function handlePlaceOrder() {
    if (data.hasStockIssue) {
      toast.error("Some items are out of stock — adjust your cart first.");
      return;
    }

    let addressId = chosen?.id ?? null;

    if (showNewForm) {
      if (!validate()) {
        toast.error("Check the delivery details");
        return;
      }
      try {
        const created = await saveAddress.mutateAsync({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim() || undefined,
          city: form.city.trim(),
          state: form.state,
          postalCode: form.postalCode.trim() || undefined,
        });
        addressId = created.id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save the address");
        return;
      }
    }

    if (!addressId) {
      toast.error("Choose a delivery address");
      return;
    }

    placeOrder.mutate({ addressId, notes: form.notes.trim() || undefined });
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step 1 of 2 — delivery details. Payment comes next.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {/* Address */}
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Delivery address</h2>

              {savedAddresses.length > 0 && (
                <div className="mt-3 space-y-2">
                  {savedAddresses.map((a) => (
                    <label
                      key={a.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                        !showNewForm && selectedAddressId === a.id
                          ? "border-primary bg-primary/[0.04]"
                          : "hover:border-foreground/25",
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={!showNewForm && selectedAddressId === a.id}
                        onChange={() => {
                          setSelectedAddressId(a.id);
                          setUseNew(false);
                        }}
                        className="mt-1 size-4 accent-[#4F2DD6]"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {a.fullName} {a.isDefault && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Default</span>}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state}
                          {a.postalCode ? ` ${a.postalCode}` : ""}
                          <br />
                          {a.phone}
                        </span>
                      </span>
                    </label>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setUseNew(true);
                      setSelectedAddressId(null);
                    }}
                    className={cn(
                      "w-full rounded-lg border border-dashed p-2.5 text-sm font-semibold",
                      showNewForm ? "border-primary text-primary" : "text-muted-foreground hover:border-foreground/30",
                    )}
                  >
                    + Use a different address
                  </button>
                </div>
              )}

              {showNewForm && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      autoComplete="name"
                      placeholder="Ada Okafor"
                    />
                  </Field>
                  <Field label="Phone number" error={errors.phone}>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="0803 000 0000"
                    />
                  </Field>
                  <Field label="State" error={errors.state}>
                    <select
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Street address" error={errors.line1} className="sm:col-span-2">
                    <Input
                      value={form.line1}
                      onChange={(e) => setForm({ ...form, line1: e.target.value })}
                      autoComplete="address-line1"
                      placeholder="12 Adeola Odeku Street"
                    />
                  </Field>
                  <Field label="Apartment, suite, etc. (optional)" className="sm:col-span-2">
                    <Input
                      value={form.line2}
                      onChange={(e) => setForm({ ...form, line2: e.target.value })}
                      autoComplete="address-line2"
                      placeholder="Flat 3B"
                    />
                  </Field>
                  <Field label="City" error={errors.city}>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      autoComplete="address-level2"
                      placeholder="Victoria Island"
                    />
                  </Field>
                  <Field label="Postal code (optional)">
                    <Input
                      value={form.postalCode}
                      onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      autoComplete="postal-code"
                      placeholder="101241"
                    />
                  </Field>
                </div>
              )}
            </section>

            {/* Items */}
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Items ({data.count})</h2>
              <ul className="mt-3 divide-y">
                {data.items.map((line) => (
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
            </section>

            <section className="rounded-xl border bg-card p-4">
              <Label htmlFor="notes">Order note (optional)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything the courier should know?"
                maxLength={500}
                className="mt-1.5"
              />
            </section>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-40 lg:self-start">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Payment summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-semibold">{formatNaira(data.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="font-semibold">
                    {data.deliveryFee === 0 ? <span className="text-emerald-600">Free</span> : formatNaira(data.deliveryFee)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-2 text-base">
                  <dt className="font-bold">Total due</dt>
                  <dd className="font-extrabold">{formatNaira(data.total)}</dd>
                </div>
              </dl>

              <Button
                size="lg"
                className="mt-4 w-full"
                onClick={handlePlaceOrder}
                disabled={placeOrder.isPending || saveAddress.isPending || data.hasStockIssue}
              >
                {placeOrder.isPending ? "Placing order…" : "Place order"}
              </Button>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                You'll get bank transfer details on the next page. Nothing is charged automatically.
              </p>
              <Link to="/cart" className="mt-2 block text-center text-xs font-semibold text-primary hover:underline">
                Back to cart
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </StoreLayout>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
      {error && <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>}
    </div>
  );
}
