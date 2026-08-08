/**
 * Rate limiting (§50).
 *
 * In-memory, per-instance. That is a real limitation on serverless — each
 * instance keeps its own counters — but it costs nothing, needs no extra
 * service, and blunts the cases that actually matter here: someone hammering
 * the waitlist form or repeatedly hitting checkout. The endpoints that would
 * be expensive to abuse (generation, swaps) are additionally bounded by their
 * own per-household limits, which live in the database and are exact.
 *
 * Swap the implementation for Upstash or similar when traffic justifies it;
 * the interface is deliberately small.
 */

import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Evict expired buckets occasionally so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  request: NextRequest,
  scope: string,
  options: { limit: number; windowSeconds: number }
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const key = `${scope}:${clientIp(request)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + options.windowSeconds * 1000 };
    buckets.set(key, bucket);
    return { ok: true, remaining: options.limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  return {
    ok: existing.count <= options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Per-key limiter for things keyed by household rather than by IP. */
export function rateLimitKey(
  key: string,
  options: { limit: number; windowSeconds: number }
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + options.windowSeconds * 1000 };
    buckets.set(key, bucket);
    return { ok: true, remaining: options.limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  return {
    ok: existing.count <= options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear();
}
