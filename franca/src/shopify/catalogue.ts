/**
 * A whole store, scanned: one `ScanResult` per product, and a store-level
 * summary that obeys the same rules the single-page scan does.
 *
 * Nothing here decides anything. Each product goes through `scan()` exactly as
 * pasted copy does, and each product's badge goes through `mayDisplayBadge`,
 * which stays the single gate (CLAUDE.md, law 3). This file only counts.
 *
 * The store headline is the *weakest* product, for the reason the single scan
 * reports the weakest market: an average lets forty clean pages hide the one
 * that draws the letter, and the letter is about that one.
 */

import { scan } from "../engine/evaluate.js";
import { mayDisplayBadge } from "../card/badge.js";
import type { Jurisdiction, ScanResult, ScoreBand } from "../engine/types.js";
import type { ProductCopy } from "./admin/products.js";

export type ProductScan = {
  product: ProductCopy;
  result: ScanResult;
  /**
   * `mayDisplayBadge`, and the product is live on the online store. A draft
   * scores like anything else; it cannot carry a mark on a page that does not
   * exist.
   */
  badge: boolean;
};

export type CatalogueSummary = {
  products: number;
  /** Products with copy, by band. */
  byBand: Record<ScoreBand, number>;
  /**
   * Products with no copy at all. Not "clear": nothing was read, which is law
   * 3's failure and is reported as its own number so it never inflates one.
   */
  unread: number;
  badges: number;
  /** The lowest-scoring product that had copy, or null when none did. */
  weakest: { gid: string; handle: string; title: string; score: number } | null;
};

export type CatalogueScan = {
  scannedAt: string;
  jurisdictions: Jurisdiction[];
  packVersions: Record<string, string>;
  products: ProductScan[];
  summary: CatalogueSummary;
};

export function scanProduct(product: ProductCopy, jurisdictions: Jurisdiction[]): ProductScan {
  const result = scan({
    text: product.text,
    source: { kind: "shopify", reference: product.url ?? `${product.handle} (not published)` },
    jurisdictions,
  });
  return { product, result, badge: mayDisplayBadge(result) && isLive(product) };
}

export function scanCatalogue(
  products: ProductCopy[],
  jurisdictions: Jurisdiction[],
  now: () => Date = () => new Date(),
): CatalogueScan {
  const scans = products.map((product) => scanProduct(product, jurisdictions));
  return {
    scannedAt: now().toISOString(),
    jurisdictions: [...new Set(jurisdictions)],
    packVersions: scans[0]?.result.packVersions ?? {},
    products: scans,
    summary: summarise(scans),
  };
}

/**
 * Swaps one product's scan in, or drops it when `next` is null — what a
 * `products/update` or `products/delete` webhook does to a stored scan.
 */
export function withProduct(catalogue: CatalogueScan, gid: string, next: ProductScan | null): CatalogueScan {
  const others = catalogue.products.filter((p) => p.product.gid !== gid);
  const products = next ? [...others, next] : others;
  return { ...catalogue, products, summary: summarise(products) };
}

export function summarise(scans: ProductScan[]): CatalogueSummary {
  const byBand: Record<ScoreBand, number> = { clear: 0, review: 0, rework: 0 };
  let unread = 0;
  let badges = 0;
  let weakest: CatalogueSummary["weakest"] = null;

  for (const { product, result, badge } of scans) {
    if (badge) badges += 1;
    if (result.readChars === 0) {
      unread += 1;
      continue;
    }
    byBand[result.score.band] += 1;
    if (!weakest || result.score.value < weakest.score) {
      weakest = { gid: product.gid, handle: product.handle, title: product.title, score: result.score.value };
    }
  }

  return { products: scans.length, byBand, unread, badges, weakest };
}

function isLive(product: ProductCopy): boolean {
  return product.status === "ACTIVE" && product.url !== null;
}
