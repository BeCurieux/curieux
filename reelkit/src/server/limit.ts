/**
 * A per-address request budget for the endpoints that cost money.
 *
 * In memory, so it is per server instance: on serverless it slows a single
 * abuser down rather than stopping a determined one. Accounts and credits
 * are the real control, and they are the next thing to build; this exists so
 * the first public deploy cannot be used to run up an Anthropic bill for free.
 */

export type Limiter = (key: string, now?: number) => boolean;

export function windowLimiter(max: number, windowMs: number): Limiter {
  const hits = new Map<string, number[]>();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear();
    return true;
  };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
