import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ProductGridSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Wishlist() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();
  const list = trpc.wishlist.list.useQuery(undefined, { enabled: Boolean(user) });
  const toggle = trpc.wishlist.toggle.useMutation({
    onSuccess: () => {
      utils.wishlist.list.invalidate();
      utils.wishlist.ids.invalidate();
      toast.success("Removed from wishlist");
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading || list.isLoading) {
    return <StoreLayout><div className="mx-auto max-w-6xl px-4 py-8"><ProductGridSkeleton count={8} /></div></StoreLayout>;
  }

  if (!user) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState
            title="Sign in to see your wishlist"
            description="Save products you're thinking about and come back to them later."
            action={<Link to="/login"><Button>Sign in</Button></Link>}
          />
        </div>
      </StoreLayout>
    );
  }

  if (list.isError) {
    return <StoreLayout><div className="mx-auto max-w-2xl px-4 py-16"><ErrorState message={list.error.message} onRetry={() => list.refetch()} /></div></StoreLayout>;
  }

  const items = list.data ?? [];

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} saved product{items.length === 1 ? "" : "s"}
        </p>

        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Nothing saved yet"
              description="Tap the heart on any product to keep it here for later."
              action={<Link to="/search"><Button>Browse products</Button></Link>}
            />
          </div>
        ) : (
          <div className="mt-5 grid-products">
            {items.map((p) => (
              <div key={p.id} className="relative">
                <ProductCard product={p} />
                <button
                  type="button"
                  onClick={() => toggle.mutate({ productId: p.id })}
                  disabled={toggle.isPending}
                  aria-label={`Remove ${p.name} from wishlist`}
                  className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow ring-1 ring-black/5 hover:bg-white"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                    <path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 8a4 4 0 017 2.8C19 15.6 12 20 12 20z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
