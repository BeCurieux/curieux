/**
 * Plans: what each allows, and what a failed lookup is not allowed to mean.
 */

import { describe, expect, it } from "vitest";
import { PLANS, accessFor, chooseMarkets, planSelectionUrl } from "@/shopify/plans.js";

describe("the plans match brief §6", () => {
  it("prices and allowances", () => {
    expect([PLANS.starter.priceUsd, PLANS.growth.priceUsd, PLANS.studio.priceUsd]).toEqual([49, 99, 199]);
    expect([PLANS.starter.maxProducts, PLANS.growth.maxProducts]).toEqual([50, 250]);
    expect(PLANS.studio.maxProducts).toBe(Number.POSITIVE_INFINITY);
    expect([PLANS.starter.maxMarkets, PLANS.growth.maxMarkets]).toEqual([1, 3]);
  });
});

describe("accessFor", () => {
  it("grants the plan's entitlements for an active subscription", () => {
    expect(accessFor({ kind: "active", handle: "growth" })).toEqual({ kind: "granted", entitlements: PLANS.growth });
  });

  it("sends a shop with no subscription to choose a plan", () => {
    expect(accessFor({ kind: "none" })).toEqual({ kind: "choose-plan" });
  });

  it("never sends a paying shop to the plan page because the lookup failed", () => {
    expect(accessFor({ kind: "unknown", lastKnown: "studio" })).toEqual({ kind: "granted", entitlements: PLANS.studio });
    expect(accessFor({ kind: "unknown", lastKnown: null })).toEqual({ kind: "retry" });
  });

  it("retries rather than guesses on a plan handle it does not know", () => {
    expect(accessFor({ kind: "active", handle: "enterprise" })).toEqual({ kind: "retry" });
  });
});

describe("chooseMarkets", () => {
  it("accepts supported markets within the allowance, deduplicated and upper-cased", () => {
    expect(chooseMarkets(PLANS.growth, ["au", "US", "AU"])).toEqual({ ok: true, markets: ["AU", "US"] });
  });

  it("refuses more markets than the plan covers rather than trimming", () => {
    expect(chooseMarkets(PLANS.starter, ["AU", "US"])).toMatchObject({ ok: false, reason: "over-allowance" });
  });

  it("refuses a market with no pack, whatever the plan (law 3)", () => {
    expect(chooseMarkets(PLANS.studio, ["AU", "CA_QC"])).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("refuses an empty choice", () => {
    expect(chooseMarkets(PLANS.studio, [])).toMatchObject({ ok: false, reason: "none" });
  });
});

describe("planSelectionUrl", () => {
  it("points at the hosted page for the store and app", () => {
    expect(planSelectionUrl("aurelia-skin.myshopify.com", "franca")).toBe(
      "https://admin.shopify.com/store/aurelia-skin/charges/franca/pricing_plans",
    );
  });
});
