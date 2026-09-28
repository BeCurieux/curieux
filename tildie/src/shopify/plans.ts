/**
 * The three paid plans from brief §6, as what they allow.
 *
 * Billing itself is Shopify's. For a new public app, Shopify App Pricing is
 * the default: plans, prices and trials live in the Partner Dashboard,
 * Shopify hosts the plan-selection page, and the docs are explicit — "Don't
 * call the Billing API's appSubscriptionCreate mutation"
 * (https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing). So this
 * file never charges anybody. It maps a plan handle to entitlements, and it
 * decides what to do with the answer to "which plan is this shop on".
 *
 * The plan handles here must match the handles configured in the Partner
 * Dashboard. That is a manual step, listed in SHOPIFY-APP.md.
 */

import { isSupported } from "../engine/registry.js";
import type { Jurisdiction } from "../engine/types.js";

export type PlanHandle = "starter" | "growth" | "studio";

export type Entitlements = {
  handle: PlanHandle;
  name: string;
  priceUsd: number;
  /**
   * Products scanned. §6 says SKUs; a SKU is a variant, and variants share
   * their product's copy, so the allowance is counted in products — the unit
   * that has words. Recorded as an open question in SHOPIFY-APP.md.
   */
  maxProducts: number;
  /** How many markets a shop may select. Infinity is "every market with a pack". */
  maxMarkets: number;
  adChecker: boolean;
  retailerPacks: boolean;
  packagingChecks: boolean;
  /**
   * Drift *alerts* — telling the merchant a score fell. Not the rescan itself:
   * every plan is rescanned when a product changes, because a badge is
   * live-linked (§5) and a mark that outlives an edit to the copy under it is
   * the dishonest-badge failure the north star ranks worst.
   */
  driftAlerts: boolean;
};

export const PLANS: Record<PlanHandle, Entitlements> = {
  starter: {
    handle: "starter",
    name: "Starter",
    priceUsd: 49,
    maxProducts: 50,
    maxMarkets: 1,
    adChecker: false,
    retailerPacks: false,
    packagingChecks: false,
    driftAlerts: false,
  },
  growth: {
    handle: "growth",
    name: "Growth",
    priceUsd: 99,
    maxProducts: 250,
    maxMarkets: 3,
    adChecker: true,
    retailerPacks: true,
    packagingChecks: false,
    driftAlerts: false,
  },
  studio: {
    handle: "studio",
    name: "Studio",
    priceUsd: 199,
    maxProducts: Number.POSITIVE_INFINITY,
    maxMarkets: Number.POSITIVE_INFINITY,
    adChecker: true,
    retailerPacks: true,
    packagingChecks: true,
    driftAlerts: true,
  },
};

export function isPlanHandle(value: unknown): value is PlanHandle {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}

/**
 * What the subscription lookup said. Three states, not two.
 *
 * `unknown` is the one that matters: the Partner API was throttled, timed out
 * or answered with something unparseable. Shopify's own sample throws in that
 * case "so a failed request doesn't redirect a paying merchant", and this type
 * exists so that nobody can collapse a failed lookup into `none` by accident.
 */
export type PlanLookup =
  | { kind: "active"; handle: string }
  | { kind: "none" }
  | { kind: "unknown"; lastKnown: PlanHandle | null };

export type Access =
  | { kind: "granted"; entitlements: Entitlements }
  | { kind: "choose-plan" }
  /** The lookup failed and there is no plan on record to fall back on. */
  | { kind: "retry" };

export function accessFor(lookup: PlanLookup): Access {
  switch (lookup.kind) {
    case "active":
      // A handle we do not know is a Partner Dashboard plan this code has not
      // been told about. Refusing a paying merchant for our omission is wrong,
      // and guessing their entitlements is worse; it is a retry and a log line.
      return isPlanHandle(lookup.handle) ? { kind: "granted", entitlements: PLANS[lookup.handle] } : { kind: "retry" };
    case "none":
      return { kind: "choose-plan" };
    case "unknown":
      return lookup.lastKnown ? { kind: "granted", entitlements: PLANS[lookup.lastKnown] } : { kind: "retry" };
  }
}

export type MarketChoice =
  | { ok: true; markets: Jurisdiction[] }
  | { ok: false; reason: "none" | "unsupported" | "over-allowance"; detail: string };

/**
 * Checks the markets a merchant picked against their plan and against law 3.
 *
 * Refuses rather than trims. A badge names the markets it was reviewed
 * against, so quietly dropping one the merchant sells into would not make the
 * mark dishonest — but it would make the merchant believe a market was covered
 * that was not, and they would only find out from a regulator.
 */
export function chooseMarkets(entitlements: Entitlements, requested: readonly string[]): MarketChoice {
  const markets = [...new Set(requested.map((m) => m.trim().toUpperCase()))];
  if (markets.length === 0) return { ok: false, reason: "none", detail: "Choose at least one market." };

  const unsupported = markets.filter((m) => !isSupported(m as Jurisdiction));
  if (unsupported.length > 0) {
    return { ok: false, reason: "unsupported", detail: `No rules are written for ${unsupported.join(", ")} yet.` };
  }
  if (markets.length > entitlements.maxMarkets) {
    return {
      ok: false,
      reason: "over-allowance",
      detail: `${entitlements.name} covers ${entitlements.maxMarkets} market${entitlements.maxMarkets === 1 ? "" : "s"}.`,
    };
  }
  return { ok: true, markets: markets as Jurisdiction[] };
}

/**
 * The hosted plan-selection page.
 *
 * [unverified] The docs say the URL "follows this pattern" and the index this
 * was read through dropped the pattern itself. This is the pattern as
 * published before that; confirm it against the Partner Dashboard's own link
 * before launch. It opens outside the app iframe, so the caller redirects with
 * `target: "_top"`.
 */
export function planSelectionUrl(shopDomain: string, appHandle: string): string {
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}
