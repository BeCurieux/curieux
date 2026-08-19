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

/**
 * Below this share of primary images sharing one shape, the catalogue was not
 * shot to a template.
 *
 * A studio session produces one crop repeated: every card is 4:5, or every card
 * is square. A merchant photographing on a kitchen table produces a mix of
 * portrait, landscape and square, and that mix is what forces the renderer to
 * cope rather than to be flattered by its input. 0.7 is loose on purpose — a
 * studio catalogue with a few lifestyle shots still clears it.
 */
export const FRAMING_CONSISTENCY = 0.7;

/**
 * Under this longest edge, a primary image cannot fill a phone card cleanly.
 *
 * 1000px is roughly a 390pt viewport at 2x with nothing spare. Below it the
 * renderer is upscaling, which is the other half of "mediocre photography" and
 * is invisible in a product count.
 */
export const LOW_RESOLUTION = 1000;

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
  /**
   * Share of measurable primary images sharing the catalogue's commonest shape.
   * Null when the feed carried no dimensions to compare.
   */
  framingConsistency: number | null;
  /** Median longest edge of the primary images, in pixels. Null if unmeasurable. */
  medianLongEdge: number | null;
  /** True when this catalogue looks like a hard case for the renderer to flatter. */
  hardPhotography: boolean;
  priceRange: { min: number; max: number } | null;
  verdict: Screen;
  /** Why, in the order a person would want to read them. */
  notes: string[];
  /** The line to paste into `killtest/targets.txt`, comment and all. */
  line: string;
}

/**
 * The candidate list, as a person wrote it.
 *
 * One store per line; blank lines and `#` comments ignored, so a rough list can
 * be pasted in and annotated as it is worked through. Both a whole-line comment
 * and a note after a URL are stripped.
 *
 * **Split on `\r?\n`, and that is the entire reason this function exists.**
 * It was three chained calls inline in `scripts/screen.ts`, splitting on `"\n"`
 * alone, and it broke the day the candidate files were committed. Git for
 * Windows converts line endings on checkout — this repository asks it to, in
 * `.gitattributes` — so every line arrived with a trailing carriage return. In
 * a JavaScript regex `.` does not match `\r`, and `$` without the `m` flag
 * matches only the true end of the string, so `/#.*$/` found nothing to strip
 * and quietly returned the line unchanged.
 *
 * The failure was total and looked like a network problem: comment-only lines
 * became candidates, every URL kept its trailing note, and the screener
 * reported 123 unreachable stores out of 123 with `Not a URL` beside each one.
 * Nothing in that output pointed at line endings.
 *
 * `readTargets` in `scripts/killtest.ts` was never affected — it trims before
 * testing for `#`, which removes the carriage return first. That is luck rather
 * than design, and it is why this one is tested.
 */
export function parseCandidates(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
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
    framingConsistency: framingConsistency(products),
    medianLongEdge: medianLongEdge(products),
    priceRange: priceRange(products),
  };

  if (!catalogue || products.length === 0) {
    return {
      ...base,
      hardPhotography: false,
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

  /*
   * The photography rule, inverted — and widened, because the first version of
   * it did not work.
   *
   * It asked one question: does any product carry two images? Sixty candidates
   * later the answer was yes for every single one, so the sample the brief asks
   * for came back empty. That is not a shortage of badly-photographed
   * merchants. It is a count of *uploads*, and a merchant who shoots four
   * mediocre pictures on a phone scores identically to a studio.
   *
   * So it now reads shape and size as well. None of these measures whether a
   * photograph is any good — nothing readable from a feed can. What they catch
   * is a catalogue that was not shot to a template: mixed crops, small files,
   * or a single image per product. Each is a *reason to include*, flagged
   * rather than demoted, and each is printed with the number it came from so a
   * person can overrule it by looking at the store.
   */
  const hard: string[] = [];
  if (base.richImagery === 0) hard.push("one image per product");
  if (base.framingConsistency !== null && base.framingConsistency < FRAMING_CONSISTENCY) {
    hard.push(`only ${Math.round(base.framingConsistency * 100)}% of images share a crop`);
  }
  if (base.medianLongEdge !== null && base.medianLongEdge < LOW_RESOLUTION) {
    hard.push(`images around ${base.medianLongEdge}px — the card will upscale them`);
  }
  if (hard.length > 0) {
    notes.push(`${hard.join("; ")} — a candidate for the mediocre-photography sample`);
  }

  if (!catalogue.currency) {
    notes.push("no currency in the feed — prices will render bare unless the homepage is read");
  }

  if (catalogue.truncated) {
    demote("workable", "feed was truncated — the catalogue is larger than what was read");
  }

  const hardPhotography = hard.length > 0;
  return {
    ...base,
    hardPhotography,
    verdict,
    notes,
    line: targetLine(storeUrl, { ...base, hardPhotography }, verdict, notes),
  };
}

function priceRange(products: IngestedProduct[]): { min: number; max: number } | null {
  if (products.length === 0) return null;
  return {
    min: Math.min(...products.map((p) => p.price.min)),
    max: Math.max(...products.map((p) => p.price.max)),
  };
}

/**
 * The primary images, which are the ones the grid shows.
 *
 * Dimensions are optional in the feed and often absent, so everything below
 * returns null rather than a made-up number when there is nothing to measure —
 * an unmeasured store must not read as a well-photographed one.
 */
function primaries(products: IngestedProduct[]): { width: number; height: number }[] {
  return products.flatMap((product) => {
    const image = product.images[0];
    return image?.width && image.height ? [{ width: image.width, height: image.height }] : [];
  });
}

/** Bucketed to 0.05, which keeps 3:4 and 4:5 apart without splitting a crop in two. */
function shape(image: { width: number; height: number }): number {
  return Math.round((image.width / image.height) * 20) / 20;
}

function framingConsistency(products: IngestedProduct[]): number | null {
  const images = primaries(products);
  if (images.length === 0) return null;

  const counts = new Map<number, number>();
  for (const image of images) counts.set(shape(image), (counts.get(shape(image)) ?? 0) + 1);
  return Math.max(...counts.values()) / images.length;
}

function medianLongEdge(products: IngestedProduct[]): number | null {
  const edges = primaries(products)
    .map((image) => Math.max(image.width, image.height))
    .sort((a, b) => a - b);
  return edges.length === 0 ? null : edges[Math.floor(edges.length / 2)]!;
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
  base: Pick<ScreenResult, "productCount" | "hardPhotography">,
  verdict: Screen,
  notes: string[],
): string {
  const parts = [`~${base.productCount} products`];
  if (base.hardPhotography) parts.push("POOR PHOTOGRAPHY");
  if (verdict === "workable" && notes.length > 0) parts.push(notes[0]!);

  const url = storeUrl.padEnd(42);
  return verdict === "wrong-test"
    ? `# ${url} # SKIPPED: ${notes[0] ?? "does not fit"}`
    : `${url} # ${parts.join(", ")}`;
}
