import { getStore } from "@/lib/db/store";

/**
 * Fixed-window rate limiting.
 *
 * The endpoint that needs it is /api/generate, because that one spends money
 * on every call. It is already behind `ensureAuthor()`, which is not the
 * protection it looks like: `ensureAuthor()` *mints* an anonymous account for
 * anyone who asks, so limiting per user would hand an attacker a fresh
 * identity with every request. The key has to be something that costs
 * something to change, which in practice means the address it came from.
 *
 * Counted in the store rather than in memory because the deployment target is
 * serverless. A module-level Map would be per-instance and would reset on
 * every cold start, which is a limiter that reports success and does nothing.
 *
 * Fixed windows, not sliding: a sliding window needs every timestamp kept, and
 * the failure mode of fixed windows — up to double the limit across a window
 * boundary — is not worth a table that grows per request to avoid.
 */

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** How many are left after this one. Never negative. */
  remaining: number;
  /** When the current window ends, for a Retry-After header. */
  resetAt: Date;
}

/** Generation calls a model, so this is the one metered by cost, not by plan. */
export const GENERATE_LIMIT: RateLimit = { limit: 20, windowMs: 60 * 60 * 1000 };

/** The start of the window `at` falls in, which is also the row's identity. */
export function windowStart(windowMs: number, at: Date = new Date()): Date {
  return new Date(Math.floor(at.getTime() / windowMs) * windowMs);
}

export async function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimit,
  at: Date = new Date()
): Promise<RateLimitResult> {
  const start = windowStart(windowMs, at);
  const resetAt = new Date(start.getTime() + windowMs);

  const count = await getStore().bumpRateLimit(key, start.toISOString());

  // A store that couldn't count returns 0 and we let it through. A limiter
  // that turns a database wobble into a dead endpoint has become the outage
  // it existed to prevent.
  if (count === 0) return { allowed: true, remaining: limit, resetAt };

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/**
 * Who to count this against.
 *
 * Behind a proxy the socket address is the proxy, so the forwarded headers are
 * the only thing carrying the caller. They are also trivially forged by
 * anyone talking to the origin directly — which is worth being clear about:
 * this raises the cost of hammering the endpoint, it does not make it
 * impossible. Real protection is the platform's own edge limiting; this is
 * what stops one script with a loop from running up a bill.
 */
export function callerKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `${prefix}:${address}`;
}
