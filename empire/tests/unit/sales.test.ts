import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkClaims } from "@/lib/ai/guard";
import { calculate } from "@/lib/ads/calculator";
import { REFUND_POLICY } from "@/lib/billing/plans";
import type { BusinessProfile } from "@/lib/domain/profile";

// The sales documents and social assets follow the house rules, and their
// worked figures come from the calculator.

const dir = "docs/sales";
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
const profile = {
  verifiedClaims: [],
  productsSummary: "",
  goal: "",
  prohibitedClaims: [],
} as unknown as BusinessProfile;

describe("sales documents (docs/sales)", () => {
  it.each(files)("%s passes the claims guard", (file) => {
    expect(checkClaims(readFileSync(`${dir}/${file}`, "utf8").split("\n"), profile)).toEqual([]);
  });

  it("every social asset that mentions US$19 carries the exact refund sentence", () => {
    const assets = readFileSync(`${dir}/SOCIAL_ASSETS.md`, "utf8")
      .split(/^## Asset /m)
      .slice(1);
    expect(assets).toHaveLength(5);
    for (const a of assets.filter((x) => /US\$19/.test(x))) expect(a).toContain(REFUND_POLICY);
  });

  it("the calculator asset's figures come from the engine", () => {
    const r = calculate({
      price: 49,
      fees: { percent: 0.1, fixed: 0.8 },
      refundRate: 0.03,
      ads: { spend: 140, orders: 3 },
    });
    const text = readFileSync(`${dir}/SOCIAL_ASSETS.md`, "utf8");
    expect(text).toContain(`ROAS ${r.ads.roas!.toFixed(2)}`);
    expect(text).toContain(`break-even here is ${r.breakEven.roas!.toFixed(2)}`);
    expect(text).toContain(`−A$${Math.abs(r.ads.contributionAfterAds).toFixed(2)}`);
  });

  it("the ad plan's break-even figures come from the engine and stay within A$15 a day", () => {
    const plan = readFileSync(`${dir}/AD_TEST_PLAN.md`, "utf8");
    for (const refunds of [0, 0.05, 0.1]) {
      const r = calculate({
        currency: "USD",
        price: 19,
        fees: { percent: 0.1, fixed: 0.5 },
        refundRate: refunds,
      });
      expect(plan).toContain(r.perOrder.contribution.toFixed(2));
      expect(plan).toContain(r.breakEven.roas!.toFixed(2));
    }
    const daily = [...plan.matchAll(/A\$(\d+)\/day/g)].map((m) => Number(m[1]));
    expect(Math.max(...daily)).toBeLessThanOrEqual(15);
  });
});
