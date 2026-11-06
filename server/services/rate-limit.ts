// Minimal in-process fixed-window rate limiter.
//
// Scope: one API process. That is the right shape for this app (a single Hono
// process serves both the SPA and the API), and it is deliberately NOT a
// distributed limiter — a multi-instance deployment would need Redis. It exists
// to blunt credential stuffing and payment-reference spam, not to be a WAF.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic sweep so the map cannot grow without bound.
    if (buckets.size > 5_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new RateLimitError(seconds);
  }
}

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Too many attempts. Please wait ${retryAfterSeconds} second(s) and try again.`);
  }
}
