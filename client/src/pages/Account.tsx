import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Account() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();

  const addresses = trpc.addresses.list.useQuery(undefined, { enabled: Boolean(user) });
  const [name, setName] = useState(user?.name ?? "");
  const [newAddr, setNewAddr] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "Lagos",
    postalCode: "",
  });

  const updateProfile = trpc.account.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.account.profile.invalidate();
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const createAddress = trpc.addresses.create.useMutation({
    onSuccess: () => {
      utils.addresses.list.invalidate();
      setNewAddr({ fullName: "", phone: "", line1: "", line2: "", city: "", state: "Lagos", postalCode: "" });
      toast.success("Address saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeAddress = trpc.addresses.remove.useMutation({
    onSuccess: () => {
      utils.addresses.list.invalidate();
      toast.success("Address removed");
    },
    onError: (e) => toast.error(e.message),
  });
  const setDefault = trpc.addresses.setDefault.useMutation({
    onSuccess: () => utils.addresses.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  if (authLoading) {
    return <StoreLayout><div className="mx-auto max-w-3xl px-4 py-8"><Skeleton className="h-64 w-full rounded-xl" /></div></StoreLayout>;
  }

  if (!user) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState title="Sign in to manage your account" action={<Link to="/login"><Button>Sign in</Button></Link>} />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Account settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your profile, delivery addresses and account details.</p>

        {/* Profile */}
        <section className="mt-5 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">Profile</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name || "No name set"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({ name: name.trim() });
            }}
          >
            <div>
              <Label htmlFor="pname" className="text-xs">Display name</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email address</Label>
              <Input value={user.email} disabled className="mt-1 bg-muted" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Your email is your sign-in identity and can't be changed here.
              </p>
            </div>
            <Button type="submit" size="sm" disabled={updateProfile.isPending || name.trim() === (user.name ?? "")}>
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>

          <dl className="mt-4 grid gap-2 border-t pt-3 text-xs sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Signed in as</dt><dd className="truncate font-medium">{user.email}</dd></div>
            <div><dt className="text-muted-foreground">Account type</dt><dd className="font-medium capitalize">{user.role}</dd></div>
          </dl>
        </section>

        {/* Addresses */}
        <section className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">Delivery addresses</h2>

          {addresses.isLoading ? (
            <Skeleton className="mt-3 h-20 w-full" />
          ) : (addresses.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No saved addresses yet. Add one below — it'll be offered at checkout.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(addresses.data ?? []).map((a) => (
                <li key={a.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">
                        {a.fullName}
                        {a.isDefault && (
                          <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Default</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state}
                        {a.postalCode ? ` ${a.postalCode}` : ""} · {a.phone}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!a.isDefault && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDefault.mutate({ addressId: a.id })}>
                          Make default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                        onClick={() => removeAddress.mutate({ addressId: a.id })}
                        disabled={removeAddress.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-4 grid gap-2.5 border-t pt-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newAddr.fullName.trim() || !newAddr.phone.trim() || !newAddr.line1.trim() || !newAddr.city.trim()) {
                toast.error("Fill in name, phone, street and city");
                return;
              }
              createAddress.mutate({
                fullName: newAddr.fullName.trim(),
                phone: newAddr.phone.trim(),
                line1: newAddr.line1.trim(),
                line2: newAddr.line2.trim() || undefined,
                city: newAddr.city.trim(),
                state: newAddr.state,
                postalCode: newAddr.postalCode.trim() || undefined,
              });
            }}
          >
            <div className="sm:col-span-2"><Label className="text-xs">Add a new address</Label></div>
            <Input placeholder="Full name" value={newAddr.fullName} onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })} aria-label="Full name" />
            <Input placeholder="Phone number" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} aria-label="Phone number" />
            <Input placeholder="Street address" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} aria-label="Street address" className="sm:col-span-2" />
            <Input placeholder="Apartment, suite (optional)" value={newAddr.line2} onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })} aria-label="Apartment" className="sm:col-span-2" />
            <Input placeholder="City" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} aria-label="City" />
            <Input placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} aria-label="State" />
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={createAddress.isPending}>
                {createAddress.isPending ? "Saving…" : "Save address"}
              </Button>
            </div>
          </form>
        </section>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/orders"><Button variant="outline" size="sm">My orders</Button></Link>
          <Link to="/wishlist"><Button variant="outline" size="sm">Wishlist</Button></Link>
          <Link to="/notifications"><Button variant="outline" size="sm">Notifications</Button></Link>
        </div>
      </div>
    </StoreLayout>
  );
}
