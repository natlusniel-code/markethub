import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { discountPercent, formatNaira, formatRating } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  imageUrl: string | null;
  categoryName?: string | null;
};

/**
 * The dense grid card. One image, one line of name, price block, and a discount
 * flag — the information a shopper scans for, nothing else.
 */
export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const off = discountPercent(product.price, product.discountPrice);
  const soldOut = product.stock <= 0;

  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        "card-hover group flex flex-col overflow-hidden rounded-xl border bg-card",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}

        {off > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
            -{off}%
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-bold uppercase tracking-wide text-slate-700 backdrop-blur-[1px]">
            Sold out
          </span>
        )}
        {!soldOut && product.stock <= 5 && (
          <span className="absolute bottom-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
            Only {product.stock} left
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground/90 group-hover:text-primary">
          {product.name}
        </h3>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[15px] font-extrabold tracking-tight text-foreground">
            {formatNaira(product.price)}
          </span>
          {off > 0 && product.discountPrice && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatNaira(product.discountPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {product.ratingCount > 0 ? (
            <>
              <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                <StarIcon /> {formatRating(product.ratingAvg)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{product.ratingCount} reviews</span>
            </>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>

        {product.soldCount > 0 && (
          <p className="text-[11px] text-muted-foreground">{product.soldCount} sold</p>
        )}
      </div>
    </Link>
  );
}

export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={cn("size-3", className)}>
      <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6z" />
    </svg>
  );
}

/** Horizontal scroller used by the home page rails. */
export function ProductRail({
  title,
  subtitle,
  products,
  href,
  accent,
}: {
  title: string;
  subtitle?: string;
  products: ProductCardData[];
  href?: string;
  accent?: "amber" | "indigo";
}) {
  if (products.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            {accent === "amber" && (
              <span className="inline-block size-2 rounded-full bg-amber-500" aria-hidden="true" />
            )}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {href && (
          <Link
            to={href}
            className="shrink-0 text-sm font-semibold text-primary hover:underline"
          >
            See all →
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]"
          />
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export { Badge };
