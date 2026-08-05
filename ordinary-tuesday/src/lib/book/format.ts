// Physical format — Prodigi A4 portrait hardcover, PUR bound.
//
// These constants are manufacturing facts, not design preferences. Three of
// them are counter-intuitive and each has ruined print runs elsewhere:
//
//   1. NO BLEED. Prodigi generates bleed and crop marks itself. Interior
//      pages must be supplied at exact trim size. Adding our own bleed makes
//      every page mis-trim.
//   2. NO SPREADS. PUR binding swallows roughly 6mm at the gutter. Pages may
//      relate to each other visually, but nothing important crosses the
//      spine and no image is designed as a single double-page picture.
//   3. SPINE WIDTH IS NOT OURS TO COMPUTE. It depends on page count *and*
//      production location, so it is queried from the provider before the
//      cover is rendered. See PrintProvider.getSpineWidth().

export const MM_PER_INCH = 25.4;

export const mm = (n: number) => n / MM_PER_INCH;

export const FORMAT = {
  id: "a4_portrait_hardcover_pur",
  name: "A4 portrait hardcover, PUR bound",

  /** Exact trim. Supply pages at this size — no bleed added by us. */
  trimWidthMm: 210,
  trimHeightMm: 297,

  /** Nothing critical inside this distance from any edge. */
  safeMarginMm: 10,

  /** PUR binding loses roughly this much into the gutter. */
  gutterLossMm: 6,

  /** Extra inner margin so type never runs into the binding. */
  innerMarginMm: 18,
  outerMarginMm: 16,
  topMarginMm: 16,
  bottomMarginMm: 18,

  /** Interior extent. Kept consistent year to year so the shelf lines up. */
  targetInteriorPages: 80,
  minInteriorPages: 24,
  maxInteriorPages: 120,

  dpi: 300,
  colourSpace: "RGB" as const,
  pdfStandard: "PDF/X-4" as const,

  paper: "Mohawk Superfine Eggshell Ultrawhite 120gsm, uncoated",
  cover: "Matte laminated hardcover, printable spine",
} as const;

export const TRIM_W_IN = mm(FORMAT.trimWidthMm);
export const TRIM_H_IN = mm(FORMAT.trimHeightMm);
export const SAFE_IN = mm(FORMAT.safeMarginMm);

/**
 * Effective-resolution tiers (brief §14).
 * Real parents upload real phone photos. Rather than stretching a poor image
 * to fill a template, the system places it at a size its resolution can
 * actually carry — and gives the page more white space and stronger text
 * instead. A blurry photo of a sleeping child is worth keeping; it is just
 * not worth printing 210mm wide.
 */
export type ImageTier = "hero" | "editorial" | "intimate" | "unprintable";

export const TIER_MIN_DPI = {
  hero: 300,        // full page
  editorial: 200,   // half to two-thirds
  intimate: 150,    // small, deliberately, with white space around it
} as const;

/** Largest printed width, in mm, that a given pixel width can carry per tier. */
export function maxPrintWidthMm(pixelWidth: number, tier: Exclude<ImageTier, "unprintable">): number {
  return (pixelWidth / TIER_MIN_DPI[tier]) * MM_PER_INCH;
}

/**
 * Which tier an image qualifies for at the sizes this format actually uses.
 * Chooses the largest placement the pixels genuinely support.
 */
export function imageTier(pixelWidth: number | null, pixelHeight: number | null): ImageTier {
  if (!pixelWidth || !pixelHeight) return "unprintable";
  const shortest = Math.min(pixelWidth, pixelHeight);

  // Full-page placement spans the full trim width.
  if (maxPrintWidthMm(shortest, "hero") >= FORMAT.trimWidthMm) return "hero";
  // Editorial placement is roughly 60% of trim width.
  if (maxPrintWidthMm(shortest, "editorial") >= FORMAT.trimWidthMm * 0.6) return "editorial";
  // Intimate placement is roughly 35%.
  if (maxPrintWidthMm(shortest, "intimate") >= FORMAT.trimWidthMm * 0.35) return "intimate";
  return "unprintable";
}

/**
 * Prodigi page mapping (brief §16).
 * PDF page 1 is the front cover; page 2 is the first interior page and falls
 * on the right; the final PDF page is the back cover. Inside covers and
 * structural sheets are blank and cannot be printed.
 */
export function totalPdfPages(interiorPages: number): number {
  return interiorPages + 2; // front cover + interior + back cover
}

/** Interior page n (1-based) falls on the right-hand side when odd. */
export function isRightHandPage(interiorPageNumber: number): boolean {
  return interiorPageNumber % 2 === 1;
}

/** Page margins in mm, mirrored so the inner edge always clears the gutter. */
export function pageMarginsMm(interiorPageNumber: number) {
  const right = isRightHandPage(interiorPageNumber);
  return {
    top: FORMAT.topMarginMm,
    bottom: FORMAT.bottomMarginMm,
    // On a right-hand page the gutter is on the left.
    left: right ? FORMAT.innerMarginMm : FORMAT.outerMarginMm,
    right: right ? FORMAT.outerMarginMm : FORMAT.innerMarginMm,
  };
}
