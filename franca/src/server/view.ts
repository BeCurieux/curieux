/**
 * A stored catalogue scan, reduced to what the embedded page shows.
 *
 * The page is a list of products with a score each; the full findings stay on
 * the server until a product is opened (a later stage renders the existing
 * result page for it). The disclaimer travels with the view, as it travels
 * with every `ScanResult` — a surface that drops it is this product asserting
 * something it does not assert.
 */

import { DISCLAIMER, citationLabel } from "../engine/framing.js";
import { SEVERITY_WEIGHT, type Finding, type ScoreBand } from "../engine/types.js";
import type { CatalogueScan, CatalogueSummary, ProductScan } from "../shopify/catalogue.js";

export type ProductView = {
  gid: string;
  handle: string;
  title: string;
  status: string;
  url: string | null;
  /** Null when the product had no copy: unread is not a score. */
  score: number | null;
  band: ScoreBand | null;
  badge: boolean;
  stale: boolean;
  findings: number;
  /** The finding to lead with: the heaviest, then the earliest. */
  top: { headline: string; market: string; phrase: string; citation: string } | null;
};

export type CatalogueView = {
  scannedAt: string;
  markets: string[];
  packVersions: Record<string, string>;
  summary: CatalogueSummary;
  truncated: boolean;
  /** Weakest first — the order a merchant should work in. */
  products: ProductView[];
  disclaimer: string;
};

export function catalogueView(catalogue: CatalogueScan): CatalogueView {
  const products = catalogue.products.map(productView).sort(weakestFirst);
  return {
    scannedAt: catalogue.scannedAt,
    markets: catalogue.jurisdictions,
    packVersions: catalogue.packVersions,
    summary: catalogue.summary,
    truncated: catalogue.truncated ?? false,
    products,
    disclaimer: DISCLAIMER,
  };
}

export function productView({ product, result, badge, stale }: ProductScan): ProductView {
  const unread = result.readChars === 0;
  const top = leading(result.findings);
  return {
    gid: product.gid,
    handle: product.handle,
    title: product.title || product.handle,
    status: product.status,
    url: product.url,
    score: unread ? null : result.score.value,
    band: unread ? null : result.score.band,
    badge,
    stale: stale ?? false,
    findings: result.findings.length,
    top: top
      ? { headline: top.headline, market: top.jurisdiction, phrase: top.trigger.text, citation: citationLabel(top.citation) }
      : null,
  };
}

function leading(findings: Finding[]): Finding | undefined {
  return [...findings].sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || a.trigger.span.start - b.trigger.span.start,
  )[0];
}

/** Scored products weakest first; unread products after them, then by title. */
function weakestFirst(a: ProductView, b: ProductView): number {
  if (a.score === null && b.score === null) return a.title.localeCompare(b.title);
  if (a.score === null) return 1;
  if (b.score === null) return -1;
  return a.score - b.score || a.title.localeCompare(b.title);
}
