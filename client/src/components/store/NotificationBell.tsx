import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Customer in-app notification bell with unread count and a dropdown history. */
export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const list = trpc.notifications.list.useQuery(
    { audience: "customer" },
    { enabled: Boolean(user), refetchInterval: 60_000 },
  );
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  if (!user) return null;
  const unread = list.data?.unread ?? 0;
  const items = list.data?.items ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 20a2 2 0 003.4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate({ audience: "customer" })}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nothing yet. Order updates will appear here.
                </p>
              ) : (
                <ul className="divide-y">
                  {items.slice(0, 12).map((n) => (
                    <li key={n.id}>
                      <Link
                        to={n.link ?? "/notifications"}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block px-3 py-2.5 hover:bg-muted",
                          !n.isRead && "bg-primary/[0.04]",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {!n.isRead && (
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          )}
                          <div className={cn("min-w-0", n.isRead && "pl-3.5")}>
                            <p className="truncate text-[13px] font-semibold">{n.title}</p>
                            {n.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                            )}
                            <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-muted"
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
