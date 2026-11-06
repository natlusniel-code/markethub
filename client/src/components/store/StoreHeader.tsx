import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/format";
import { NotificationBell } from "@/components/store/NotificationBell";

/**
 * Storefront header. Deliberately contains NO link to /admin — the admin area is
 * reachable only by typing the URL, and only admins get past its guard.
 */
export function StoreHeader() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user) });
  const suggestions = trpc.catalog.suggestions.useQuery(
    { q: term },
    { enabled: term.trim().length >= 2 },
  );
  const categories = trpc.catalog.categories.useQuery();

  // Close the suggestion panel on an outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setFocused(false);
    navigate(term.trim() ? `/search?q=${encodeURIComponent(term.trim())}` : "/search");
  }

  const cartCount = cart.data?.count ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Announcement strip */}
      <div className="brand-gradient text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-[11px] font-medium sm:text-xs">
          <span className="hidden sm:inline">Free delivery on orders over ₦150,000</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span>Pay by bank transfer — verified within one business day</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center gap-3 sm:gap-5">
          <Link to="/" className="shrink-0" aria-label="MarketHub home">
            <Logo />
          </Link>

          {/* Search */}
          <div ref={boxRef} className="relative hidden flex-1 md:block">
            <form onSubmit={submitSearch} role="search">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onFocus={() => setFocused(true)}
                  placeholder="Search products, brands and categories"
                  aria-label="Search products"
                  className="h-10 rounded-full border-transparent bg-muted pl-9 pr-24 text-sm focus-visible:border-primary focus-visible:bg-background"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-1 top-1 h-8 rounded-full px-4"
                >
                  Search
                </Button>
              </div>
            </form>

            {focused && term.trim().length >= 2 && (
              <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border bg-popover shadow-xl">
                {suggestions.isLoading ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
                ) : (suggestions.data?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No matches for “{term}”. Try a different word.
                  </p>
                ) : (
                  <ul>
                    {suggestions.data!.map((s) => (
                      <li key={s.id}>
                        <Link
                          to={`/product/${s.slug}`}
                          onClick={() => setFocused(false)}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted"
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="shrink-0 font-semibold">{formatNaira(s.price)}</span>
                        </Link>
                      </li>
                    ))}
                    <li className="border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setFocused(false);
                          navigate(`/search?q=${encodeURIComponent(term.trim())}`);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold text-primary hover:bg-muted"
                      >
                        See all results for “{term.trim()}” →
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <NotificationBell />
                <Link
                  to="/wishlist"
                  className="hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
                  aria-label="Wishlist"
                >
                  <HeartIcon />
                </Link>
                <Link
                  to="/cart"
                  className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
                >
                  <CartIcon />
                  {cartCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-amber-950">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-full p-1 pr-2 hover:bg-muted"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </span>
                    <ChevronIcon className="size-3.5 text-muted-foreground" />
                  </button>

                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border bg-popover py-1 shadow-xl"
                      >
                        <div className="border-b px-3 py-2">
                          <p className="truncate text-sm font-semibold">{user.name || "Your account"}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        {[
                          ["/account", "Account settings"],
                          ["/orders", "My orders"],
                          ["/wishlist", "Wishlist"],
                          ["/notifications", "Notifications"],
                        ].map(([href, label]) => (
                          <Link
                            key={href}
                            to={href}
                            onClick={() => setMenuOpen(false)}
                            className="block px-3 py-2 text-sm hover:bg-muted"
                            role="menuitem"
                          >
                            {label}
                          </Link>
                        ))}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => {
                            setMenuOpen(false);
                            await logout();
                            navigate("/");
                          }}
                          className="block w-full border-t px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/cart" className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Cart">
                  <CartIcon />
                </Link>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={submitSearch} role="search" className="pb-3 md:hidden">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search MarketHub"
              aria-label="Search products"
              className="h-10 rounded-full border-transparent bg-muted pl-9 text-sm"
            />
          </div>
        </form>

        {/* Category strip */}
        <nav aria-label="Categories" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
          <Link
            to="/search"
            className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            All products
          </Link>
          {(categories.data ?? []).map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.slug}`}
              className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4", className)} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
      <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 8a4 4 0 017 2.8C19 15.6 12 20 12 20z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4", className)} aria-hidden="true">
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
