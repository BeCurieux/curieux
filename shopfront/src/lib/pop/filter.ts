/**
 * Hard filters (HANDOFF §7 step 2): what may appear at all.
 *
 * Active, buyable, and passing every rule, decided here in code and never
 * delegated to the model. The model only ever sees what survives this, so
 * "under $120" cannot be broken by a plan, only by this file, and this file is
 * tested.
 *
 * A per-item cap is a promise about what the shopper pays, so it is checked
 * against real variant prices, sale prices included. A product whose options
 * straddle the cap stays in, **pinned to its cheapest buyable variant under
 * the cap**, so the page shows and the cart pre-fills a price that keeps the
 * promise. A shirt from $95 to $140 is in a "under $120" shop as the $95 one,
 * never as "from $95".
 */

import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import type { PopBrief } from "./brief";

export interface Candidate {
  product: IngestedProduct;
  /** Set when only some variants keep the rules; the page must show this one. */
  pinnedVariantId: string | null;
  /** The price the shopper would pay for the variant shown. */
  price: number;
}

export interface Excluded {
  handle: string;
  reason: string;
}

export interface FilterResult {
  candidates: Candidate[];
  excluded: Excluded[];
  /** Merchant-locked products that break a rule. The brief contradicts itself. */
  conflicts: string[];
}

export function hardFilter(catalogue: Catalogue, brief: PopBrief): FilterResult {
  const candidates: Candidate[] = [];
  const excluded: Excluded[] = [];
  const exclude = new Set(brief.rules.excludeHandles);
  const cap = brief.rules.priceScope === "per_item" ? brief.rules.priceMax : null;

  for (const product of catalogue.products) {
    const out = (reason: string) => excluded.push({ handle: product.handle, reason });
    if (exclude.has(product.handle)) {
      out("excluded by the merchant");
      continue;
    }
    if (!product.availabilityKnown) {
      out("the storefront does not report stock, so it cannot be promised in stock");
      continue;
    }
    const buyable = product.variants.filter((v) => v.available);
    if (!product.available || buyable.length === 0) {
      out("sold out");
      continue;
    }
    if (cap === null) {
      candidates.push({ product, pinnedVariantId: null, price: Math.min(...buyable.map((v) => v.price)) });
      continue;
    }
    const underCap = buyable.filter((v) => v.price <= cap).sort((a, b) => a.price - b.price);
    if (underCap.length === 0) {
      out(`no buyable variant at or under ${cap} (cheapest ${Math.min(...buyable.map((v) => v.price))})`);
      continue;
    }
    // Every variant, buyable or not, must be under the cap for the product to
    // appear unpinned: the page would otherwise say "from" a price and let the
    // shopper choose one that breaks the promise.
    const allUnder = product.variants.every((v) => v.price <= cap);
    candidates.push({ product, pinnedVariantId: allUnder ? null : underCap[0]!.id, price: underCap[0]!.price });
  }

  const byHandle = new Map(excluded.map((e) => [e.handle, e.reason]));
  const known = new Set(catalogue.products.map((p) => p.handle));
  const conflicts: string[] = [];
  for (const handle of brief.rules.includeHandles) {
    if (!known.has(handle)) conflicts.push(`"${handle}" is locked in but is not in this catalogue.`);
    else if (exclude.has(handle)) conflicts.push(`"${handle}" is both locked in and excluded.`);
    else if (byHandle.has(handle)) conflicts.push(`"${handle}" is locked in but ${byHandle.get(handle)}.`);
  }
  return { candidates, excluded, conflicts };
}

/** Resolve "the linen shirt" to a handle by title, only when exactly one product matches. */
export function resolveMentions(mentions: readonly string[], catalogue: Catalogue): { handles: string[]; unresolved: string[] } {
  const handles: string[] = [];
  const unresolved: string[] = [];
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && w !== "the" && w !== "our");
  for (const mention of mentions) {
    const want = words(mention);
    if (want.length === 0) {
      unresolved.push(mention);
      continue;
    }
    const hits = catalogue.products.filter((p) => {
      const title = new Set(words(`${p.title} ${p.handle.replace(/-/g, " ")}`));
      return want.every((w) => title.has(w));
    });
    if (hits.length === 1) handles.push(hits[0]!.handle);
    else unresolved.push(mention);
  }
  return { handles, unresolved };
}
