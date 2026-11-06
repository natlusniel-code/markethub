import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function Notifications() {
  const { user, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.notifications.list.useQuery({ audience: "customer" }, { enabled: Boolean(user) });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });
  const markOne = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  if (authLoading || list.isLoading) {
    return <StoreLayout><div className="mx-auto max-w-3xl space-y-3 px-4 py-8"><Skeleton className="h-8 w-40" /><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-20 w-full rounded-xl" /></div></StoreLayout>;
  }

  if (!user) {
    return <StoreLayout><div className="mx-auto max-w-2xl px-4 py-16"><EmptyState title="Sign in to see notifications" action={<Link to="/login"><Button>Sign in</Button></Link>} /></div></StoreLayout>;
  }

  if (list.isError) {
    return <StoreLayout><div className="mx-auto max-w-2xl px-4 py-16"><ErrorState message={list.error.message} onRetry={() => list.refetch()} /></div></StoreLayout>;
  }

  const items = list.data?.items ?? [];
  const unread = list.data?.unread ?? 0;

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate({ audience: "customer" })} disabled={markAll.isPending}>
              Mark all as read
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No notifications yet"
              description="Order updates, payment confirmations and delivery notices will appear here."
              action={<Link to="/orders"><Button variant="outline">View my orders</Button></Link>}
            />
          </div>
        ) : (
          <ul className="mt-5 divide-y rounded-xl border bg-card">
            {items.map((n) => (
              <li key={n.id} className={cn("p-4", !n.isRead && "bg-primary/[0.03]")}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.isRead ? "bg-border" : "bg-primary",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={cn("text-sm", n.isRead ? "font-medium" : "font-bold")}>{n.title}</p>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>}
                    <div className="mt-1.5 flex gap-3">
                      {n.link && (
                        <Link
                          to={n.link}
                          onClick={() => !n.isRead && markOne.mutate({ notificationId: n.id })}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          View details →
                        </Link>
                      )}
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => markOne.mutate({ notificationId: n.id })}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
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
