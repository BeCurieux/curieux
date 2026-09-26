/**
 * The dimensions no model is asked for (HANDOFF §6.3).
 *
 * Pure functions from catalogue facts to values, each returning the evidence
 * it used. A price position without its comparison set is an assertion; with
 * "category, n=47, p52" it is something a merchant can check.
 *
 * Nothing here reads a shopper event. `inventory_depth` takes an optional
 * trailing sales rate for when order access exists (M3); until then it is
 * never passed, and depth is stock against the merchant's minimum — the
 * spec's own no-history rule, and the owner's ruling for M1.
 */

import type { ComparisonScope, EvidenceState } from "./records";
import { referenceFor, type PriceBandReference } from "./price-bands";
import { UNKNOWN, type ParentCategory } from "./taxonomy";

export interface Derived {
  value: string;
  rawValue: string | null;
  comparisonScope: ComparisonScope | null;
  comparisonN: number | null;
  percentile: number | null;
  evidenceState: EvidenceState | null;
}

const plain = (value: string, rawValue: string | null): Derived => ({
  value,
  rawValue,
  comparisonScope: null,
  comparisonN: null,
  percentile: null,
  evidenceState: null,
});

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// ------------------------------------------------------------- price_band

export function priceBand(
  price: number | null,
  parentCategory: ParentCategory | null,
  currency: string | null,
  references?: readonly PriceBandReference[],
): Derived {
  const ref = referenceFor(parentCategory, currency, references);
  if (price === null || !ref) {
    return {
      ...plain(UNKNOWN, price === null ? "no price" : `no reference for ${parentCategory ?? "unknown category"} in ${currency ?? "unknown currency"}`),
      comparisonScope: "global_reference",
    };
  }
  const value = price <= ref.budgetMax ? "budget" : price <= ref.midMax ? "mid" : price <= ref.premiumMax ? "premium" : "luxury";
  return {
    ...plain(value, `${money(price)} ${ref.currency} vs ${ref.parentCategory} ceilings ${ref.budgetMax}/${ref.midMax}/${ref.premiumMax}`),
    comparisonScope: "global_reference",
  };
}

// ---------------------------------------------------------- price_position

export interface PricedProduct {
  handle: string;
  productType: string | null;
  /** Default variant, pre-discount. Null when the catalogue gave none. */
  price: number | null;
}

export const MIN_COMPARISON_N = 10;

/**
 * Percentile of `price` within `set`, 0–100: the share strictly below it, plus
 * half the ties. Ties split evenly so that a catalogue where everything costs
 * $20 puts everything at p50 (mid), not p0 (entry).
 */
export function percentileOf(price: number, set: readonly number[]): number {
  if (set.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const p of set) {
    if (p < price) below += 1;
    else if (p === price) equal += 1;
  }
  return Math.round(((below + equal / 2) / set.length) * 100);
}

function position(percentile: number): string {
  if (percentile < 25) return "entry";
  if (percentile >= 75) return "premium";
  return "mid";
}

const BAND_TO_POSITION: Record<string, string> = {
  budget: "entry",
  mid: "mid",
  premium: "premium",
  luxury: "premium",
};

/**
 * Price position for every product in one store, with the §6.1 rule 5
 * fallback: product type in store → whole store → global category reference,
 * each only when its comparison set has at least ten priced products.
 *
 * `bandOf` supplies the global fallback: the product's `price_band`, mapped
 * onto the three positions. That is the only way a product in a store of
 * seven gets a position at all, and the scope says so.
 */
export function pricePositions(
  products: readonly PricedProduct[],
  bandOf: (handle: string) => string = () => UNKNOWN,
): Map<string, Derived> {
  const priced = products.filter((p): p is PricedProduct & { price: number } => p.price !== null);
  const byType = new Map<string, number[]>();
  for (const p of priced) {
    const key = normaliseType(p.productType);
    if (!key) continue;
    const list = byType.get(key);
    if (list) list.push(p.price);
    else byType.set(key, [p.price]);
  }
  const storePrices = priced.map((p) => p.price);

  const out = new Map<string, Derived>();
  for (const p of products) {
    if (p.price === null) {
      out.set(p.handle, plain(UNKNOWN, "no price"));
      continue;
    }
    const typeSet = byType.get(normaliseType(p.productType) ?? "") ?? [];
    let scope: ComparisonScope;
    let set: number[];
    if (typeSet.length >= MIN_COMPARISON_N) {
      scope = "product_type";
      set = typeSet;
    } else if (storePrices.length >= MIN_COMPARISON_N) {
      scope = "store";
      set = storePrices;
    } else {
      const band = bandOf(p.handle);
      out.set(p.handle, {
        value: BAND_TO_POSITION[band] ?? UNKNOWN,
        rawValue: `${money(p.price)}; store too small (n=${storePrices.length}), from price_band ${band}`,
        comparisonScope: "global_reference",
        comparisonN: null,
        percentile: null,
        evidenceState: null,
      });
      continue;
    }
    const pct = percentileOf(p.price, set);
    out.set(p.handle, {
      value: position(pct),
      rawValue: money(p.price),
      comparisonScope: scope,
      comparisonN: set.length,
      percentile: pct,
      evidenceState: null,
    });
  }
  return out;
}

function normaliseType(type: string | null): string | null {
  const t = type?.trim().toLowerCase();
  return t ? t : null;
}

// --------------------------------------------------------- inventory_depth

export interface StockFacts {
  /** Units available across locations. Only an Admin read knows this. */
  units?: number | null;
  /** Whether anything can be bought, from the public catalogue. */
  available: boolean;
  availabilityKnown: boolean;
  /**
   * Trailing 28-day average daily units sold. Needs order access, which waits
   * until M3; never passed in M1.
   */
  dailyUnits?: number | null;
  /** The merchant's minimum stock level. */
  merchantMin: number;
}

export function inventoryDepth(facts: StockFacts): Derived {
  const { units, dailyUnits, merchantMin } = facts;
  if (units !== undefined && units !== null) {
    if (dailyUnits && dailyUnits > 0) {
      const days = Math.round(units / dailyUnits);
      const value = days < 14 || units < merchantMin ? "low" : days > 90 ? "high" : "normal";
      return plain(value, `${units} units, ${days} days`);
    }
    return plain(units < merchantMin ? "low" : "normal", `${units} units vs min ${merchantMin}; no sales history`);
  }
  // The public path: no unit counts. A sold-out product has zero units, which
  // is below any minimum; anything else is not knowable from here.
  if (facts.availabilityKnown && !facts.available) return plain("low", "sold out (0 units)");
  return plain(UNKNOWN, facts.availabilityKnown ? "in stock; unit count not available" : "availability not reported");
}

// ------------------------------------------------------------- margin_band

export function marginBand(price: number | null, costPerItem: number | null | undefined): Derived {
  if (price === null || price <= 0 || costPerItem === null || costPerItem === undefined) {
    return plain(UNKNOWN, costPerItem === null || costPerItem === undefined ? "no cost per item" : "no price");
  }
  const margin = (price - costPerItem) / price;
  const value = margin < 0.4 ? "low" : margin <= 0.6 ? "mid" : "high";
  return plain(value, `${Math.round(margin * 100)}% (price ${money(price)}, cost ${money(costPerItem)})`);
}

// --------------------------------------------------------- assortment_role

/**
 * Cold start only (HANDOFF §6.3): accessory + entry → provisional add-on;
 * merchant-featured → provisional hero; otherwise neutral. A merchant's own
 * declaration is an override row, not an input here. Raw sales never set it.
 */
export function assortmentRole(facts: { itemType: string; pricePosition: string; featured: boolean }): Derived {
  if (facts.featured) return { ...plain("hero", "merchant-featured"), evidenceState: "provisional" };
  if (facts.itemType === "accessory" && facts.pricePosition === "entry") {
    return { ...plain("add_on", "accessory at entry price"), evidenceState: "provisional" };
  }
  return { ...plain("neutral", "no cold-start rule applies"), evidenceState: "unobserved" };
}

// --------------------------------------------------------------- item_type

/** A Shopify bundle is a set, whatever the model thought (HANDOFF §6.3). */
export function itemTypeRule(isShopifyBundle: boolean | undefined): Derived | null {
  return isShopifyBundle ? plain("set_bundle", "Shopify bundle product") : null;
}

/**
 * Default variant (the first, as Shopify orders them), pre-discount. On sale,
 * Shopify's `price` is the sale price and `compareAtPrice` is what it was, so
 * pre-discount is the compare-at price when it is the higher of the two. A
 * summer sale should not move a shirt from mid to budget.
 */
export function defaultPrice(variants: readonly { price: number; compareAtPrice?: number | undefined }[]): number | null {
  const first = variants[0];
  if (!first) return null;
  return first.compareAtPrice !== undefined && first.compareAtPrice > first.price ? first.compareAtPrice : first.price;
}
