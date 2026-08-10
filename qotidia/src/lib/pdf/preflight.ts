// Automated preflight (brief §17).
//
// A book cannot reach "approve for print" if any of these fail. The rules
// encode Prodigi's actual production constraints, including three that
// commonly ruin runs: manually added bleed, odd page counts, and content
// inside the 10mm safe area or designed across the PUR gutter.

import { FORMAT, TIER_MIN_DPI, type ImageTier } from "@/lib/book/format";
import { coverContrastOk, type AgeColour } from "@/lib/book/colours";
import type { HostVerdict } from "@/lib/listen/host";

export interface PlacedImage {
  assetId: string;
  pixelWidth: number;
  pixelHeight: number;
  /** Printed placement on the page, in mm. */
  placedWidthMm: number;
  placedHeightMm: number;
  /** The tier this placement is claiming. */
  tier: Exclude<ImageTier, "unprintable">;
  missing?: boolean;
}

export interface PreflightIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  page?: number;
}

export interface PreflightResult {
  passed: boolean;
  issues: PreflightIssue[];
}

export interface PreflightInput {
  /** Interior pages only — covers are counted separately. */
  interiorPages: number;
  /** Exact page size supplied to the printer, in mm. */
  pageWidthMm: number;
  pageHeightMm: number;
  /** True if our renderer added its own bleed. Must be false. */
  bleedAdded: boolean;
  cropMarksAdded: boolean;
  images: PlacedImage[];
  fontsEmbedded: boolean;
  colourSpace: string;
  transparencyFlattened: boolean;
  /** Pages where content overflowed its frame. */
  overflowPages: number[];
  /** Pages where content sits inside the 10mm safe area. */
  safeAreaViolations: number[];
  /** Pages designed as one image across the spine. Always fatal. */
  spreadPages: number[];
  /** Pages with no content at all. */
  blankPages: number[];
  /** AI-drafted blocks that arrived without provenance. */
  uncitedBlocks: number;
  /**
   * The verdict on the host the "Hear this moment" codes point at, when this
   * book has any. Passed in rather than looked up, because that is a network
   * call and everything else in here is arithmetic on a file. See
   * lib/listen/host.ts for why a print path is worth asking the network.
   */
  listenHost?: HostVerdict;
  cover?: {
    colour: AgeColour;
    spineWidthMm: number;
    spineAuthoritative: boolean;
  };
}

/** How far a produced page may sit from nominal trim before it is rejected. */
export const DIMENSION_TOLERANCE_MM = 0.5;

export function effectiveDpi(img: PlacedImage): number {
  const dpiW = img.pixelWidth / (img.placedWidthMm / 25.4);
  const dpiH = img.pixelHeight / (img.placedHeightMm / 25.4);
  return Math.min(dpiW, dpiH);
}

export function runPreflight(input: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = [];
  const err = (code: string, message: string, page?: number) =>
    issues.push({ severity: "error", code, message, page });
  const warn = (code: string, message: string, page?: number) =>
    issues.push({ severity: "warning", code, message, page });

  // --- physical dimensions -------------------------------------------------
  // Measured from the produced file. A tolerance is used rather than exact
  // equality because no HTML renderer lands on the millimetre — Chromium
  // routes page size through CSS pixels and comes out 0.11mm under A4. That
  // is far inside any press tolerance; a whole millimetre would not be.
  const dW = Math.abs(input.pageWidthMm - FORMAT.trimWidthMm);
  const dH = Math.abs(input.pageHeightMm - FORMAT.trimHeightMm);
  if (dW > DIMENSION_TOLERANCE_MM || dH > DIMENSION_TOLERANCE_MM) {
    err("wrong_dimensions",
      `pages measure ${input.pageWidthMm.toFixed(2)}×${input.pageHeightMm.toFixed(2)}mm; ` +
      `${FORMAT.trimWidthMm}×${FORMAT.trimHeightMm}mm required ` +
      `(tolerance ±${DIMENSION_TOLERANCE_MM}mm)`);
  }

  // Prodigi adds bleed and crop marks itself. Ours would mis-trim every page.
  if (input.bleedAdded) {
    err("bleed_added", "artwork includes bleed; Prodigi generates its own and requires exact trim");
  }
  if (input.cropMarksAdded) {
    err("crop_marks_added", "artwork includes crop marks; Prodigi adds these itself");
  }

  // --- extent --------------------------------------------------------------
  if (input.interiorPages % 2 !== 0) {
    err("page_count_odd", `interior extent is ${input.interiorPages}; must be even`);
  }
  if (input.interiorPages < FORMAT.minInteriorPages || input.interiorPages > FORMAT.maxInteriorPages) {
    err("page_count_out_of_range",
      `interior extent ${input.interiorPages} outside ${FORMAT.minInteriorPages}–${FORMAT.maxInteriorPages}`);
  }
  const drift = Math.abs(input.interiorPages - FORMAT.targetInteriorPages);
  if (drift > 24) {
    warn("extent_drift",
      `interior extent ${input.interiorPages} is ${drift} pages from the ${FORMAT.targetInteriorPages}-page ` +
      `house standard; volumes will not line up on the shelf`);
  }

  // --- imagery -------------------------------------------------------------
  for (const img of input.images) {
    if (img.missing) {
      err("asset_missing", `asset ${img.assetId} is missing`);
      continue;
    }
    const dpi = effectiveDpi(img);
    const required = TIER_MIN_DPI[img.tier];
    if (dpi < required) {
      err("resolution_below_tier",
        `asset ${img.assetId} is ${Math.round(dpi)}dpi at its ${img.tier} placement; ` +
        `needs ${required}dpi — place it smaller rather than enlarging it`);
    }
  }

  // --- typography and colour ----------------------------------------------
  if (!input.fontsEmbedded) err("fonts_not_embedded", "fonts are not embedded in the PDF");
  if (input.colourSpace !== FORMAT.colourSpace) {
    err("wrong_colour_space", `PDF is ${input.colourSpace}; Prodigi expects ${FORMAT.colourSpace}`);
  }
  if (!input.transparencyFlattened) {
    err("transparency_not_flattened", `transparency must be flattened for ${FORMAT.pdfStandard}`);
  }

  // --- layout integrity ----------------------------------------------------
  for (const p of input.overflowPages) err("overflow", `content overflows its frame on page ${p}`, p);
  for (const p of input.safeAreaViolations) {
    err("safe_area", `content sits inside the ${FORMAT.safeMarginMm}mm safe area on page ${p}`, p);
  }
  for (const p of input.spreadPages) {
    err("designed_spread",
      `page ${p} is designed across the spine; PUR binding hides about ` +
      `${FORMAT.gutterLossMm}mm at the gutter`, p);
  }
  for (const p of input.blankPages) err("unintended_blank", `page ${p} is blank`, p);

  // --- editorial integrity -------------------------------------------------
  if (input.uncitedBlocks > 0) {
    err("missing_provenance",
      `${input.uncitedBlocks} generated block(s) have no supporting memory`);
  }

  // --- what the printed codes point at -------------------------------------
  // Only present when the book carries "Hear this moment" marks. Every other
  // rule here protects the object; this one protects what the object promises
  // — a code is the one thing on the page that has to keep working after the
  // book leaves us, and it cannot be reprinted when it stops.
  if (input.listenHost && !input.listenHost.ok) {
    err(`listen_host_${input.listenHost.code}`, input.listenHost.message);
  }

  // --- cover ---------------------------------------------------------------
  if (input.cover) {
    if (!input.cover.spineAuthoritative) {
      err("spine_not_authoritative",
        "spine width was estimated locally; query the provider before rendering the cover");
    }
    if (input.cover.spineWidthMm <= 0) {
      err("spine_width_invalid", `spine width ${input.cover.spineWidthMm}mm is not usable`);
    }
    if (!coverContrastOk(input.cover.colour)) {
      warn("cover_contrast",
        `${input.cover.colour.name} does not clear the contrast floor; uncoated stock will ` +
        `flatten it further and the name may not read across a room`);
    }
  }

  return { passed: !issues.some((i) => i.severity === "error"), issues };
}
