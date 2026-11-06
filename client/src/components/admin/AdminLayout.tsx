import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  CreditCard,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  Store,
  Bell,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/users", label: "Customers", icon: Users },
  { href: "/admin/settings", label: "Payment settings", icon: Settings },
];

/**
 * Admin chrome. Deliberately separate from the storefront: no store header, no
 * cart, no link back into customer navigation except "View store".
 *
 * The role check here is a UX affordance only — every admin API call is
 * independently authorised server-side by adminProcedure.
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const unread = trpc.notifications.list.useQuery(
    { audience: "admin" },
    { enabled: Boolean(user), refetchInterval: 30_000 },
  );

  useEffect(() => setOpen(false), [location]);

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  const pending = unread.data?.unread ?? 0;

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
        <Link to="/admin" className="flex items-center gap-2">
          <Logo className="text-sm" />
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="rounded-md p-2 hover:bg-muted"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div className="lg:flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "z-30 w-full shrink-0 border-b bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:border-r lg:border-b-0",
            open ? "block" : "hidden lg:block",
          )}
        >
          <div className="hidden items-center gap-2 px-5 py-5 lg:flex">
            <Logo />
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Admin
            </span>
          </div>

          <nav className="space-y-0.5 px-3 pb-3 lg:pb-0" aria-label="Admin sections">
            {NAV.map((item) => {
              const active =
                item.href === "/admin" ? location === "/admin" : location.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/admin/payments" && pending > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {pending}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 space-y-1 border-t px-3 py-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <Store className="size-4" /> View store
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>

          <div className="hidden border-t px-5 py-3 lg:block">
            <p className="truncate text-xs font-medium text-slate-700">{user?.name ?? "Admin"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Page heading used by every admin screen. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Shown when a non-admin somehow reaches an admin screen. */
export function AdminDenied() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <X className="size-6" />
        </div>
        <h1 className="text-lg font-bold">Administrator access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is restricted to MarketHub staff. If you believe you should have access, ask an
          existing administrator to grant it.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/">
            <Button variant="outline">Back to store</Button>
          </Link>
          <Link to="/login">
            <Button>Sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export { Bell };
