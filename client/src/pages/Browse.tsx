import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/_core/trpc";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductGridSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { nairaToKobo } from "@/lib/format";

type Sort = "newest" | "price_asc" | "price_desc" | "popular" | "discount";

const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest first",
  popular: "Most popular",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  discount: "Biggest discount",
};

/**
 * Browse / search. All filter state lives in the URL so a filtered view is
 * shareable and the back button behaves.
 */
export default function Browse({ categorySlug }: { categorySlug?: string }) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as Sort) ?? "newest";
  const discountedOnly = params.get("discounted") === "1";
  const inStockOnly = params.get("instock") === "1";
  const featuredOnly = params.get("featured") === "1";
  const minPrice = params.get("min") ? Number(params.get("min")) : undefined;
  const maxPrice = params.get("max") ? Number(params.get("max")) : undefined;
  const page = Number(params.get("page") ?? 1);

  const [minInput, setMinInput] = useState(minPrice ? String(minPrice / 100) : "");
  const [maxInput, setMaxInput] = useState(maxPrice ? String(maxPrice / 100) : "");

  useEffect(() => {
    setMinInput(minPrice ? String(minPrice / 100) : "");
    setMaxInput(maxPrice ? String(maxPrice / 100) : "");
  }, [minPrice, maxPrice]);

  const categories = trpc.catalog.categories.useQuery();
  const activeCategory = categories.data?.find((c) => c.slug === categorySlug);

  const products = trpc.catalog.products.useQuery({
    q: q || undefined,
    categorySlug,
    sort,
    discountedOnly: discountedOnly || undefined,
    inStockOnly: inStockOnly || undefined,
    featuredOnly: featuredOnly || undefined,
    minPrice,
    maxPrice,
    page,
    pageSize: 24,
  });

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(search);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    const qs = next.toString();
    navigate(`${categorySlug ? `/category/${categorySlug}` : "/search"}${qs ? `?${qs}` : ""}`);
  }

  const totalPages = products.data ? Math.max(1, Math.ceil(products.data.total / products.data.pageSize)) : 1;
  const activeFilterCount =
    (discountedOnly ? 1 : 0) + (inStockOnly ? 1 : 0) + (featuredOnly ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);

  const heading = activeCategory?.name ?? (q ? `Results for “${q}”` : "All products");

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span aria-hidden="true">/</span>
          {activeCategory ? (
            <>
              <Link to="/search" className="hover:text-foreground">Shop</Link>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-foreground">{activeCategory.name}</span>
            </>
          ) : (
            <span className="font-medium text-foreground">Shop</span>
          )}
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.data
                ? `${products.data.total} product${products.data.total === 1 ? "" : "s"}`
                : "Loading…"}
              {activeCategory?.description ? ` · ${activeCategory.description}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="sr-only">Sort by</Label>
            <Select
              id="sort"
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
              className="w-48"
            >
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <option key={s} value={s}>{SORT_LABEL[s]}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* ── Filters ─────────────────────────────────────────────────────── */}
          <aside className="space-y-5 lg:sticky lg:top-40 lg:self-start">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Category</h2>
              <ul className="mt-2 space-y-0.5">
                <li>
                  <Link
                    to="/search"
                    className={cn(
                      "block rounded px-2 py-1.5 text-[13px] hover:bg-muted",
                      !categorySlug && "bg-primary/10 font-semibold text-primary",
                    )}
                  >
                    All categories
                  </Link>
                </li>
                {(categories.data ?? []).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/category/${c.slug}`}
                      className={cn(
                        "flex items-center justify-between rounded px-2 py-1.5 text-[13px] hover:bg-muted",
                        categorySlug === c.slug && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{c.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Price (₦)</h2>
              <form
                className="mt-2 flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = new URLSearchParams(search);
                  const min = nairaToKobo(minInput);
                  const max = nairaToKobo(maxInput);
                  if (min > 0) next.set("min", String(min));
                  else next.delete("min");
                  if (max > 0) next.set("max", String(max));
                  else next.delete("max");
                  next.delete("page");
                  navigate(`${categorySlug ? `/category/${categorySlug}` : "/search"}?${next.toString()}`);
                }}
              >
                <Input
                  inputMode="numeric"
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  placeholder="Min"
                  aria-label="Minimum price in naira"
                  className="h-8 text-xs"
                />
                <span className="text-muted-foreground" aria-hidden="true">–</span>
                <Input
                  inputMode="numeric"
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  placeholder="Max"
                  aria-label="Maximum price in naira"
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0 px-2 text-xs">
                  Go
                </Button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1">
                {[
                  ["Under ₦5k", 0, 500000],
                  ["₦5k–₦20k", 500000, 2000000],
                  ["₦20k–₦100k", 2000000, 10000000],
                  ["₦100k+", 10000000, 0],
                ].map(([label, min, max]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(search);
                      if (Number(min) > 0) next.set("min", String(min));
                      else next.delete("min");
                      if (Number(max) > 0) next.set("max", String(max));
                      else next.delete("max");
                      next.delete("page");
                      navigate(`${categorySlug ? `/category/${categorySlug}` : "/search"}?${next.toString()}`);
                    }}
                    className="rounded-full border px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Refine</h2>
              <div className="mt-2 space-y-2">
                {[
                  ["Discounted only", "discounted", discountedOnly],
                  ["In stock only", "instock", inStockOnly],
                  ["Featured", "featured", featuredOnly],
                ].map(([label, key, checked]) => (
                  <label key={String(key)} className="flex cursor-pointer items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(e) => setParam(String(key), e.target.checked ? "1" : null)}
                      className="size-4 rounded border-input accent-[#4F2DD6]"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-7 w-full text-xs"
                  onClick={() => navigate(categorySlug ? `/category/${categorySlug}` : "/search")}
                >
                  Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </aside>

          {/* ── Results ─────────────────────────────────────────────────────── */}
          <div>
            {products.isLoading ? (
              <ProductGridSkeleton count={12} />
            ) : products.isError ? (
              <ErrorState message={products.error.message} onRetry={() => products.refetch()} />
            ) : products.data!.items.length === 0 ? (
              <EmptyState
                title="No products match those filters"
                description={
                  q
                    ? `We couldn't find anything for “${q}”. Try a broader word, or clear the filters.`
                    : "Nothing in this category matches the filters you picked."
                }
                action={
                  <Button
                    variant="outline"
                    onClick={() => navigate(categorySlug ? `/category/${categorySlug}` : "/search")}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                <div className="grid-products">
                  {products.data!.items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setParam("page", String(page - 1))}
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setParam("page", String(page + 1))}
                    >
                      Next
                    </Button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
