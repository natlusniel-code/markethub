import { Link } from "wouter";
import { Logo } from "@/components/brand/Logo";
import { trpc } from "@/_core/trpc";

export function StoreFooter() {
  const categories = trpc.catalog.categories.useQuery();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Everyday essentials and the good stuff, at prices that make sense. Delivered across
              Nigeria.
            </p>
            <div className="mt-4 flex gap-2">
              {["Visa", "Mastercard", "Transfer"].map((m) => (
                <span
                  key={m}
                  className="rounded border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold">Shop</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {(categories.data ?? []).slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link to={`/category/${c.slug}`} className="hover:text-foreground">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/search" className="font-medium text-primary hover:underline">
                  All products
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold">Your account</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/account" className="hover:text-foreground">Account settings</Link></li>
              <li><Link to="/orders" className="hover:text-foreground">Order history</Link></li>
              <li><Link to="/wishlist" className="hover:text-foreground">Wishlist</Link></li>
              <li><Link to="/notifications" className="hover:text-foreground">Notifications</Link></li>
              <li><Link to="/cart" className="hover:text-foreground">Cart</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold">Help</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/help/payments" className="hover:text-foreground">How bank transfer works</Link></li>
              <li><Link to="/help/delivery" className="hover:text-foreground">Delivery &amp; charges</Link></li>
              <li><Link to="/help/returns" className="hover:text-foreground">Returns policy</Link></li>
              <li><Link to="/help/contact" className="hover:text-foreground">Contact us</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} MarketHub. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Prices in Nigerian Naira (₦)</span>
            <span aria-hidden="true">·</span>
            <span>Manual bank transfer only</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
