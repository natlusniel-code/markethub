import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard, ProductRail, SectionHeading } from "@/components/store/ProductCard";
import { ProductGridSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function Home() {
  const home = trpc.catalog.home.useQuery();
  const toast = useToast();
  const [email, setEmail] = useState("");

  if (home.isLoading) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
          <div className="shimmer h-56 rounded-2xl sm:h-72" />
          <ProductGridSkeleton count={10} />
        </div>
      </StoreLayout>
    );
  }

  if (home.isError) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <ErrorState
            title="We couldn't load the shop"
            message={home.error.message}
            onRetry={() => home.refetch()}
          />
        </div>
      </StoreLayout>
    );
  }

  const d = home.data!;
  const hasAnything =
    d.featured.length + d.bestSellers.length + d.newArrivals.length + d.trending.length > 0;

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:space-y-12 sm:py-8">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="brand-gradient relative overflow-hidden rounded-2xl px-6 py-10 text-white sm:px-10 sm:py-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 right-10 size-72 rounded-full bg-amber-400/20 blur-3xl"
            />
            <div className="relative max-w-lg">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-white/25">
                <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                New season, new prices
              </span>
              <h1 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
                Everything you need.
                <br />
                <span className="text-amber-300">Nothing you don't.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
                Electronics, fashion, home, groceries and more — checked, priced fairly, and
                delivered to your door anywhere in Nigeria.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/search">
                  <Button size="lg" className="bg-white text-[#4F2DD6] hover:bg-white/90">
                    Start shopping
                  </Button>
                </Link>
                <Link to="/search?discounted=1">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    Today's deals
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Promo tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              to="/category/electronics"
              className="card-hover group relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                Tech that keeps up
              </p>
              <p className="mt-1 text-lg font-bold leading-tight">Up to 30% off audio</p>
              <p className="mt-1 text-xs text-white/70">Earbuds, speakers and soundbars</p>
              <span className="mt-3 inline-block text-xs font-semibold text-amber-400 group-hover:underline">
                Shop electronics →
              </span>
            </Link>
            <Link
              to="/category/home-and-kitchen"
              className="card-hover group relative overflow-hidden rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Kitchen refresh
              </p>
              <p className="mt-1 text-lg font-bold leading-tight text-amber-950">
                Cook better for less
              </p>
              <p className="mt-1 text-xs text-amber-800/80">Air fryers, pans and blenders</p>
              <span className="mt-3 inline-block text-xs font-semibold text-amber-800 group-hover:underline">
                Shop home &amp; kitchen →
              </span>
            </Link>
          </div>
        </section>

        {!hasAnything && (
          <EmptyState
            title="The shelves are being stocked"
            description="No products are published yet. Once an administrator adds products they will appear here."
            action={
              <Link to="/search">
                <Button variant="outline">Browse all products</Button>
              </Link>
            }
          />
        )}

        {/* ── Categories ───────────────────────────────────────────────────── */}
        {d.categories.length > 0 && (
          <section>
            <SectionHeading
              title="Shop by category"
              subtitle="Nine departments, one checkout"
              action={
                <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
                  See all →
                </Link>
              }
            />
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
              {d.categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/category/${c.slug}`}
                  className="card-hover flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {c.name.slice(0, 1)}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.productCount} items</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Flash deals ──────────────────────────────────────────────────── */}
        {d.flashDeals.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg amber-gradient text-sm font-black text-amber-950">
                  ⚡
                </span>
                <div>
                  <h2 className="text-base font-bold leading-tight sm:text-lg">Flash deals</h2>
                  <p className="text-[11px] text-amber-800/80">Biggest markdowns right now</p>
                </div>
              </div>
              <Link
                to="/search?discounted=1&sort=discount"
                className="shrink-0 text-xs font-semibold text-amber-800 hover:underline"
              >
                All deals →
              </Link>
            </div>
            <div className="grid-products">
              {d.flashDeals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {d.featured.length > 0 && (
          <ProductRail
            title="Featured this week"
            subtitle="Hand-picked by our buying team"
            products={d.featured}
            href="/search?featured=1"
          />
        )}

        {d.bestSellers.length > 0 && (
          <ProductRail
            title="Best sellers"
            subtitle="What everyone else is buying"
            products={d.bestSellers}
            href="/search?sort=popular"
          />
        )}

        {d.newArrivals.length > 0 && (
          <ProductRail
            title="New arrivals"
            subtitle="Fresh on the shelves"
            products={d.newArrivals}
            href="/search?sort=newest"
          />
        )}

        {/* ── Mid-page promo ───────────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl bg-[#4F2DD6] p-6 text-white sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
              Spend ₦150,000 or more
            </p>
            <p className="mt-1.5 text-xl font-extrabold leading-tight sm:text-2xl">
              Free delivery, nationwide
            </p>
            <p className="mt-2 max-w-xs text-sm text-white/80">
              Applied automatically at checkout — no code needed.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Pay your way
            </p>
            <p className="mt-1.5 text-xl font-extrabold leading-tight sm:text-2xl">
              Bank transfer, verified by a human
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Transfer to our account, submit your reference, and we confirm it before your order
              ships. No card details, ever.
            </p>
          </div>
        </section>

        {d.trending.length > 0 && (
          <ProductRail
            title="Trending now"
            subtitle="Most reviewed this month"
            products={d.trending}
            href="/search?sort=popular"
          />
        )}

        {d.discounted.length > 0 && (
          <ProductRail
            title="Discounted collections"
            subtitle="Reduced, not remaindered"
            products={d.discounted}
            href="/search?discounted=1"
            accent="amber"
          />
        )}

        {/* ── Newsletter ───────────────────────────────────────────────────── */}
        <section className="brand-gradient-soft rounded-2xl border border-primary/15 p-6 sm:p-10">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Get the deals before they sell out
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One short email a week with the markdowns worth knowing about. No spam, unsubscribe
              any time.
            </p>
            <form
              className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) return;
                toast.success("You're on the list — watch your inbox.");
                setEmail("");
              }}
            >
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="h-10 bg-background"
              />
              <Button type="submit" className="h-10 shrink-0">
                Subscribe
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-muted-foreground">
              This form is a preview of the signup — no mailing list is connected in this build.
            </p>
          </div>
        </section>

        {/* ── Trust strip ──────────────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Verified payments", "Every transfer is checked by a person before dispatch."],
            ["Nationwide delivery", "Lagos, Abuja and all 36 states."],
            ["Real stock counts", "What you see is what is on the shelf."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border bg-card p-4">
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </StoreLayout>
  );
}
