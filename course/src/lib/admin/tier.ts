import type { AccessTier } from "@/lib/course/tiers";

// A buyer's tier from her entitlement rows, for the Buyers tab: the same
// rule as tier_of() in the database (highest non-revoked; the benchmark
// pack is separate, and course and founding include it).

const ORDER: AccessTier[] = ["free", "module0", "course", "founding"];

export function tierFromEntitlements(rows: { tier: string; revoked_at: string | null }[]) {
  const live = rows.filter((r) => r.revoked_at === null);
  const tier = live.reduce<AccessTier>((best, r) => {
    const i = ORDER.indexOf(r.tier as AccessTier);
    return i > ORDER.indexOf(best) ? (r.tier as AccessTier) : best;
  }, "free");
  const pack =
    live.some((r) => r.tier === "benchmark_pack") || ORDER.indexOf(tier) >= ORDER.indexOf("course");
  return { tier, benchmarkPack: pack };
}
