import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard, StarIcon } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { discountPercent, formatDate, formatNaira, formatRating } from "@/lib/format";

export default function ProductDetail({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();

  const product = trpc.catalog.product.useQuery({ slug });
  const wishlist = trpc.wishlist.ids.useQuery(undefined, { enabled: Boolean(user) });

  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success("Added to cart");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleWish = trpc.wishlist.toggle.useMutation({
    onSuccess: (r) => {
      utils.wishlist.ids.invalidate();
      utils.wishlist.list.invalidate();
      toast.success(r.saved ? "Saved to wishlist" : "Removed from wishlist");
    },
    onError: (e) => toast.error(e.message),
  });
  const submitReview = trpc.orders.review.useMutation({
    onSuccess: () => {
      utils.catalog.product.invalidate({ slug });
      setReviewOpen(false);
      setReviewTitle("");
      setReviewBody("");
      toast.success("Thanks — your review is live.");
    },
    onError: (e) => toast.error(e.message),
  });

  const p = product.data;

  // Group variants by kind so each kind renders as its own chip row.
  const variantGroups = useMemo(() => {
    if (!p) return [] as { kind: string; options: { id: string; kind: string; value: string; priceDelta: number; stock: number }[] }[];
    const map = new Map<string, { id: string; kind: string; value: string; priceDelta: number; stock: number }[]>();
    for (const v of p.variants) {
      if (!map.has(v.kind)) map.set(v.kind, []);
      map.get(v.kind)!.push(v);
    }
    return [...map.entries()].map(([kind, options]) => ({ kind, options }));
  }, [p]);

  // A variant is required only when the product actually has variants of that kind.
  const chosenVariant = useMemo(() => {
    if (!p) return null;
    for (const g of variantGroups) {
      const id = selected[g.kind];
      if (id) {
        const found = p.variants.find((v) => v.id === id);
        if (found) return found;
      }
    }
    return null;
  }, [p, selected, variantGroups]);

  const unitPrice = p ? p.price + (chosenVariant?.priceDelta ?? 0) : 0;
  const availableStock = chosenVariant ? chosenVariant.stock : (p?.stock ?? 0);
  const off = p ? discountPercent(p.price, p.discountPrice) : 0;
  const saved = wishlist.data?.includes(p?.id ?? "") ?? false;

  function requireLogin(): boolean {
    if (!user) {
      toast.info("Sign in to continue");
      navigate("/login");
      return false;
    }
    return true;
  }

  function handleAdd(buyNow = false) {
    if (!p || !requireLogin()) return;
    if (variantGroups.length > 0 && !chosenVariant) {
      toast.error(`Choose a ${variantGroups[0].kind.toLowerCase()} first`);
      return;
    }
    if (availableStock <= 0) {
      toast.error("That option is out of stock");
      return;
    }
    addToCart.mutate(
      { productId: p.id, variantId: chosenVariant?.id ?? null, quantity },
      {
        onSuccess: () => {
          if (buyNow) navigate("/cart");
        },
      },
    );
  }

  if (product.isLoading) {
    return (
      <StoreLayout>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (product.isError || !p) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState
            title="Product not found"
            message="This product may have been removed or is no longer published."
            onRetry={() => navigate("/search")}
          />
        </div>
      </StoreLayout>
    );
  }

  const images = p.images.length > 0 ? p.images : [{ id: "none", url: "", sortOrder: 0 }];

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span aria-hidden="true">/</span>
          {p.category && (
            <>
              <Link to={`/category/${p.category.slug}`} className="hover:text-foreground">
                {p.category.name}
              </Link>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span className="line-clamp-1 font-medium text-foreground">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          {/* ── Gallery ─────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border bg-muted">
              {images[imageIndex]?.url ? (
                <img
                  src={images[imageIndex].url}
                  alt={p.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">
                  No image available
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`View image ${i + 1}`}
                    aria-current={i === imageIndex}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted",
                      i === imageIndex ? "border-primary" : "border-transparent hover:border-border",
                    )}
                  >
                    <img src={img.url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Buy box ─────────────────────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {p.category && (
                <Link
                  to={`/category/${p.category.slug}`}
                  className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                >
                  {p.category.name}
                </Link>
              )}
              {p.isFeatured && <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">Featured</Badge>}
            </div>

            <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              {p.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {p.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                  <StarIcon className="size-4" />
                  {formatRating(p.ratingAvg)}
                  <span className="font-normal text-muted-foreground">({p.ratingCount})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">No reviews yet</span>
              )}
              {p.soldCount > 0 && (
                <>
                  <span className="text-muted-foreground" aria-hidden="true">·</span>
                  <span className="text-muted-foreground">{p.soldCount} sold</span>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <span className="text-3xl font-extrabold tracking-tight">{formatNaira(unitPrice)}</span>
              {off > 0 && p.discountPrice && (
                <>
                  <span className="text-base text-muted-foreground line-through">
                    {formatNaira(p.discountPrice)}
                  </span>
                  <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Save {off}%</Badge>
                </>
              )}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {availableStock > 0
                ? availableStock <= 5
                  ? `Only ${availableStock} left in stock`
                  : `In stock (${availableStock} available)`
                : "Out of stock"}
            </p>

            {/* Variants */}
            {variantGroups.map((g) => (
              <div key={g.kind} className="mt-5">
                <p className="text-sm font-semibold">
                  {g.kind}
                  {selected[g.kind] && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      — {g.options.find((o) => o.id === selected[g.kind])?.value}
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const isSel = selected[g.kind] === o.id;
                    const out = o.stock <= 0;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={out}
                        onClick={() => setSelected((s) => ({ ...s, [g.kind]: o.id }))}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                          isSel
                            ? "border-primary bg-primary/5 font-semibold text-primary"
                            : "hover:border-foreground/30",
                          out && "cursor-not-allowed opacity-40 line-through",
                        )}
                      >
                        {o.value}
                        {o.priceDelta !== 0 && (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            {o.priceDelta > 0 ? "+" : "−"}
                            {formatNaira(Math.abs(o.priceDelta))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity */}
            <div className="mt-5 flex items-center gap-3">
              <span className="text-sm font-semibold">Quantity</span>
              <div className="inline-flex items-center rounded-lg border">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="px-3 py-1.5 text-lg leading-none disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, Math.max(1, availableStock), q + 1))}
                  disabled={quantity >= Math.min(20, availableStock)}
                  aria-label="Increase quantity"
                  className="px-3 py-1.5 text-lg leading-none disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                className="flex-1"
                disabled={availableStock <= 0 || addToCart.isPending}
                onClick={() => handleAdd(false)}
              >
                {addToCart.isPending ? "Adding…" : "Add to cart"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="flex-1"
                disabled={availableStock <= 0 || addToCart.isPending}
                onClick={() => handleAdd(true)}
              >
                Buy now
              </Button>
              <Button
                size="lg"
                variant="outline"
                aria-pressed={saved}
                onClick={() => {
                  if (!requireLogin()) return;
                  toggleWish.mutate({ productId: p.id });
                }}
                className={cn("sm:w-auto", saved && "border-rose-300 text-rose-600")}
              >
                <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                  <path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 8a4 4 0 017 2.8C19 15.6 12 20 12 20z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {saved ? "Saved" : "Wishlist"}
              </Button>
            </div>

            <div className="mt-6 grid gap-2 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground sm:grid-cols-2">
              <p>✓ Bank transfer, verified by a person</p>
              <p>✓ Free delivery over ₦150,000</p>
              <p>✓ Nationwide delivery</p>
              <p>✓ Real stock counts</p>
            </div>
          </div>
        </div>

        {/* ── Description ───────────────────────────────────────────────────── */}
        <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-lg font-bold">About this product</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {p.description || "No description has been added for this product yet."}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-bold">Details</h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{p.category?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Stock</dt>
                <dd className="font-medium">{p.stock}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Variants</dt>
                <dd className="font-medium">{p.variants.length || "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Listed</dt>
                <dd className="font-medium">{formatDate(p.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ── Reviews ───────────────────────────────────────────────────────── */}
        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              Reviews {p.ratingCount > 0 && <span className="text-muted-foreground">({p.ratingCount})</span>}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!requireLogin()) return;
                setReviewOpen((v) => !v);
              }}
            >
              {reviewOpen ? "Cancel" : "Write a review"}
            </Button>
          </div>

          {reviewOpen && (
            <form
              className="mt-4 space-y-3 rounded-xl border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                submitReview.mutate({
                  productId: p.id,
                  rating,
                  title: reviewTitle || undefined,
                  body: reviewBody || undefined,
                });
              }}
            >
              <div>
                <Label>Your rating</Label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      aria-pressed={rating === n}
                      className={cn("p-0.5", n <= rating ? "text-amber-500" : "text-muted-foreground/40")}
                    >
                      <StarIcon className="size-6" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="rt">Title (optional)</Label>
                <Input id="rt" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="rb">Your review (optional)</Label>
                <Textarea id="rb" value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} maxLength={2000} />
              </div>
              <Button type="submit" disabled={submitReview.isPending}>
                {submitReview.isPending ? "Posting…" : "Post review"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                One review per product per account — posting again updates your existing review.
              </p>
            </form>
          )}

          {p.reviews.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No reviews yet. Be the first to say what you think.
            </p>
          ) : (
            <ul className="mt-4 divide-y rounded-xl border bg-card">
              {p.reviews.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(r.authorName ?? "A").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold">{r.authorName ?? "Anonymous"}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarIcon key={i} className={cn("size-3.5", i >= r.rating && "text-muted-foreground/25")} />
                    ))}
                  </div>
                  {r.title && <p className="mt-1.5 text-sm font-semibold">{r.title}</p>}
                  {r.body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Related ───────────────────────────────────────────────────────── */}
        {p.related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold">You may also like</h2>
            <div className="grid-products">
              {p.related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}
