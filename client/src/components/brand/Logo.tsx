import { cn } from "@/lib/utils";

/**
 * The MarketHub mark: a rounded indigo→violet tile with a white "M" and an amber
 * hub dot. Inline SVG (not an <img>) so it inherits crispness at any size and
 * needs no network request; the same geometry is baked into the favicon set by
 * scripts/make-icons.py.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="MarketHub"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id="mh-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F2DD6" />
          <stop offset="55%" stopColor="#8B3DD6" />
          <stop offset="100%" stopColor="#A83EC8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.4" fill="url(#mh-mark)" />
      <path
        d="M16.3 47V20.2L32 36.8 47.7 20.2V47"
        fill="none"
        stroke="#fff"
        strokeWidth="6.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="49.6" r="4" fill="#FAB014" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="text-[1.35rem] font-extrabold leading-none tracking-tight">
          <span className="text-foreground">Market</span>
          <span className="bg-gradient-to-r from-[#4F2DD6] to-[#A83EC8] bg-clip-text text-transparent">
            Hub
          </span>
        </span>
      )}
    </span>
  );
}
