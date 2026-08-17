/**
 * Is this store a kill-test target, or a different test?
 *
 * Finding thirty merchants is two jobs pretending to be one. The first is
 * judgement — whose audience arrives off Instagram, who runs two campaigns a
 * month, who has no developer — and no tool can do it; it is why the targets
 * file is written by a person.
 *
 * The second is arithmetic. Is the feed open, are there enough products to
 * merchandise, is anything actually in stock, and is the photography good
 * enough to flatter or bad enough to be worth testing against. That half is
 * mechanical, it is tedious across sixty candidates, and getting it wrong is
 * expensive in a way that only shows up mid-run: a store whose feed is closed
 * falls through to the browser rung, which is slower and lossier, and a store
 * with eleven products has nothing to select from — so the shop it produces
 * tests the renderer rather than the merchandiser, which is the wrong question
 * asked in the direction that kills the product.
 *
 * So this screens a candidate and says which of those it is. It does not decide
 * anything: `verdict` is advice printed next to the numbers it came from, and
 * the person with the list makes the call.
 *
 * The thresholds are the ones already written in `targets.example.txt`. They
 * live here as named constants so the file and the tool cannot drift apart.
 */

import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";

/** From the product standard, §1, and from `targets.example.txt`. */
export const MIN_PRODUCTS = 20;
export const MAX_PRODUCTS = 500;

/**
 * Above this, the Genome reads a prefix rather than the catalogue.
 *
 * Not a rejection — a large store is still a valid target — but it changes what
 * the merchandiser was given, and that is worth knowing before the run rather
 * than inferring afterwards from a shop that ignored half the catalogue.
 */
export const GENOME_READS = 160;

/** Under this share in stock, a shop is mostly a museum. */
export const MIN_AVAILABLE_SHARE = 0.5;

export type Screen = "good" | "workable" | "wrong-test";

export interface ScreenResult {
  storeUrl: string;
  /** Null when nothing could be read at all. */
  catalogue: Catalogue | null;
  productCount: number;
  availableCount: number;
  /** Products carrying two or more images. The renderer has options for these. */
  richImagery: number;
  /** Products with no image at all. `BrokenImagery` territory. */
  noImagery: number;
  priceRange: { min: number; max: number } | null;
  verdict: Screen;
  /** Why, in the order a person would want to read them. */
  notes: string[];
  /** The line to paste into `killtest/targets.txt`, comment and all. */
  line: string;
}

export function screen(storeUrl: string, catalogue: Catalogue | null): ScreenResult {
  const products = catalogue?.products ?? [];
  const available = products.filter((p) => p.available);
  const notes: string[] = [];

  const base = {
    storeUrl,
    catalogue,
    productCount: products.length,
    availableCount: available.length,
    richImagery: products.filter((p) => p.images.length >= 2).length,
    noImagery: products.filter((p) => p.images.length === 0).length,
    priceRange: priceRange(products),
  };

  if (!catalogue || products.length === 0) {
    return {
      ...base,
      verdict: "wrong-test",
      notes: ["nothing readable — feed closed, or not Shopify"],
      line: `# ${storeUrl}  # NOTHING READABLE — check by hand before including`,
    };
  }

  let verdict: Screen = "good";
  const demote = (to: Screen, why: string) => {
    notes.push(why);
    // "wrong-test" is terminal; "workable" never upgrades back to "good".
    if (verdict !== "wrong-test") verdict = to;
  };

  if (products.length < MIN_PRODUCTS) {
    demote("wrong-test", `only ${products.length} products — nothing to merchandise`);
  } else if (products.length > MAX_PRODUCTS) {
    demote("workable", `${products.length} products — larger than the standard's range`);
  }

  if (products.length > GENOME_READS) {
    demote("workable", `Genome will read the first ${GENOME_READS} of ${products.length}`);
  }

  const share = products.length === 0 ? 0 : available.length / products.length;
  if (share < MIN_AVAILABLE_SHARE) {
    demote("workable", `only ${available.length} of ${products.length} in stock`);
  }

  if (base.noImagery > 0) {
    demote("workable", `${base.noImagery} products with no image`);
  }

  // The photography rule, inverted. A catalogue of single studio cut-outs is
  // the renderer's easiest case; the brief asks for a handful of hard ones, so
  // a thin-imagery store is a *reason to include*, flagged rather than demoted.
  if (base.richImagery === 0 && products.length > 0) {
    notes.push("one image per product — a candidate for the mediocre-photography sample");
  }

  if (!catalogue.currency) {
    notes.push("no currency in the feed — prices will render bare unless the homepage is read");
  }

  if (catalogue.truncated) {
    demote("workable", "feed was truncated — the catalogue is larger than what was read");
  }

  return { ...base, verdict, notes, line: targetLine(storeUrl, base, verdict, notes) };
}

function priceRange(products: IngestedProduct[]): { min: number; max: number } | null {
  if (products.length === 0) return null;
  return {
    min: Math.min(...products.map((p) => p.price.min)),
    max: Math.max(...products.map((p) => p.price.max)),
  };
}

/**
 * The line for the targets file.
 *
 * Commented out when it is the wrong test, so a screened batch can be pasted
 * wholesale and the rejects are visible rather than dropped — a target that
 * vanished silently is one nobody reconsiders.
 */
function targetLine(
  storeUrl: string,
  base: Pick<ScreenResult, "productCount" | "richImagery">,
  verdict: Screen,
  notes: string[],
): string {
  const parts = [`~${base.productCount} products`];
  if (base.richImagery === 0) parts.push("POOR PHOTOGRAPHY");
  if (verdict === "workable" && notes.length > 0) parts.push(notes[0]!);

  const url = storeUrl.padEnd(42);
  return verdict === "wrong-test"
    ? `# ${url} # SKIPPED: ${notes[0] ?? "does not fit"}`
    : `${url} # ${parts.join(", ")}`;
}
