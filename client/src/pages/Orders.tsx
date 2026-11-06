import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { formatDate, formatNaira, orderStatusTone, paymentStatusLabel, paymentStatusTone } from "@/lib/format";

export default function Orders() {
  const { user, isLoading: authLoading } = useAuth();
  const orders = trpc.orders.list.useQuery(undefined, { enabled: Boolean(user) });

  if (authLoading || orders.isLoading) {
    return <StoreLayout><div className="mx-auto max-w-4xl space-y-3 px-4 py-8"><Skeleton className="h-8 w-40" /><Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-32 w-full rounded-xl" /></div></StoreLayout>;
  }

  if (!user) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState title="Sign in to see your orders" action={<Link to="/login"><Button>Sign in</Button></Link>} />
        </div>
      </StoreLayout>
    );
  }

  if (orders.isError) {
    return <StoreLayout><div className="mx-auto max-w-2xl px-4 py-16"><ErrorState message={orders.error.message} onRetry={() => orders.refetch()} /></div></StoreLayout>;
  }

  const list = orders.data ?? [];

  return (
    <StoreLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">My orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every order you've placed, with its payment and delivery status.
        </p>

        {list.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No orders yet"
              description="When you place an order it will appear here with its payment status and delivery progress."
              action={<Link to="/search"><Button>Start shopping</Button></Link>}
            />
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {list.map((o) => (
              <li key={o.id} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{o.orderNumber}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={paymentStatusTone(o.paymentStatus)}>{paymentStatusLabel(o.paymentStatus)}</Badge>
                    <Badge tone={orderStatusTone(o.status)}>{o.statusLabel}</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex -space-x-2">
                    {o.items.slice(0, 4).map((it) => (
                      <div key={it.id} className="size-10 overflow-hidden rounded-md border-2 border-card bg-muted">
                        {it.imageUrl && <img src={it.imageUrl} alt="" className="size-full object-cover" />}
                      </div>
                    ))}
                    {o.items.length > 4 && (
                      <div className="flex size-10 items-center justify-center rounded-md border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground">
                        +{o.items.length - 4}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">
                      {o.items[0]?.name}
                      {o.items.length > 1 ? ` and ${o.items.length - 1} more` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{o.itemCount} item{o.itemCount === 1 ? "" : "s"}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-extrabold">{formatNaira(o.total)}</p>
                  </div>

                  <div className="flex gap-1.5">
                    {o.paymentStatus === "unpaid" && o.status !== "cancelled" && (
                      <Link to={`/orders/${o.id}/payment`}>
                        <Button size="sm">Pay now</Button>
                      </Link>
                    )}
                    <Link to={`/orders/${o.id}`}>
                      <Button size="sm" variant="outline">Details</Button>
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StoreLayout>
  );
}
