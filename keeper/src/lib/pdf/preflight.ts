// Automated preflight (brief §18).
// Runs before any print PDF is approved for submission. Prefers hard
// rejection over a bad physical book. Pure functions — fully unit-testable.

import { BOOK_SPEC } from "@/lib/book/structure";
import {
  MIN_SPINE_TEXT_INCHES, spineTakesText,
  type CoverGeometry, type PaperStock,
} from "./cover";

export interface PlacedImage {
  assetId: string;
  pixelWidth: number;
  pixelHeight: number;
  /** physical placement size on the page, in inches */
  placedWidthInches: number;
  placedHeightInches: number;
  missing?: boolean;
}

export interface PreflightInput {
  pageCount: number;
  images: PlacedImage[];
  fontsEmbedded: boolean;
  /** page indexes where content overflowed its frame during layout */
  overflowPages: number[];
  provider?: {
    minPages: number;
    maxPages: number;
    requiresEvenPages: boolean;
  };
}

export interface PreflightIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface PreflightResult {
  passed: boolean;
  issues: PreflightIssue[];
}

export function effectiveDpi(img: PlacedImage): number {
  const dpiW = img.pixelWidth / img.placedWidthInches;
  const dpiH = img.pixelHeight / img.placedHeightInches;
  return Math.min(dpiW, dpiH);
}

export function runPreflight(input: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = [];

  // Page count within product spec and even (books are printed in spreads).
  if (input.pageCount < BOOK_SPEC.minPages || input.pageCount > BOOK_SPEC.maxPages) {
    issues.push({
      severity: "error",
      code: "page_count_out_of_range",
      message: `page count ${input.pageCount} outside ${BOOK_SPEC.minPages}–${BOOK_SPEC.maxPages}`,
    });
  }
  if (input.pageCount % 2 !== 0) {
    issues.push({ severity: "error", code: "page_count_odd", message: "page count must be even" });
  }

  // Provider-specific trim/count constraints.
  if (input.provider) {
    if (input.pageCount < input.provider.minPages || input.pageCount > input.provider.maxPages) {
      issues.push({
        severity: "error",
        code: "provider_page_count",
        message: `provider requires ${input.provider.minPages}–${input.provider.maxPages} pages`,
      });
    }
  }

  // Image resolution + missing assets.
  for (const img of input.images) {
    if (img.missing) {
      issues.push({ severity: "error", code: "asset_missing", message: `asset ${img.assetId} is missing` });
      continue;
    }
    const dpi = effectiveDpi(img);
    if (dpi < BOOK_SPEC.minEffectiveDpi) {
      issues.push({
        severity: "error",
        code: "dpi_too_low",
        message: `asset ${img.assetId} effective ${Math.round(dpi)}dpi < ${BOOK_SPEC.minEffectiveDpi}dpi minimum`,
      });
    } else if (dpi < BOOK_SPEC.targetEffectiveDpi) {
      issues.push({
        severity: "warning",
        code: "dpi_below_target",
        message: `asset ${img.assetId} effective ${Math.round(dpi)}dpi below ${BOOK_SPEC.targetEffectiveDpi}dpi target`,
      });
    }
  }

  if (!input.fontsEmbedded) {
    issues.push({ severity: "error", code: "fonts_not_embedded", message: "fonts failed to embed" });
  }

  for (const page of input.overflowPages) {
    issues.push({ severity: "error", code: "overflow", message: `content overflow on page ${page}` });
  }

  return { passed: !issues.some((i) => i.severity === "error"), issues };
}

// ------------------------------------------------------------------ cover

export interface CoverPreflightInput {
  pageCount: number;
  stock: PaperStock;
  geometry: CoverGeometry;
  /** Longest string set on the spine, if any. */
  spineText?: string;
  /** Provider limits on the flat printed sheet, if known. */
  provider?: { maxSheetWidthInches: number; maxSheetHeightInches: number };
}

/**
 * A wrong cover is more expensive than a wrong page: the whole run is
 * unusable, because the spine lands off-centre on every copy.
 */
export function runCoverPreflight(input: CoverPreflightInput): PreflightResult {
  const issues: PreflightIssue[] = [];
  const { geometry: geo, stock } = input;

  // The single most dangerous unknown in the whole print path.
  if (!stock.measured) {
    issues.push({
      severity: "warning",
      code: "caliper_unmeasured",
      message:
        `paper caliper for "${stock.name}" is published, not measured — ` +
        `spine width ${geo.spineWidthInches}in is provisional until a sample is checked`,
    });
  }

  if (input.pageCount % 2 !== 0) {
    issues.push({ severity: "error", code: "page_count_odd", message: "page count must be even" });
  }

  // A spine narrower than its type is a spine with unreadable type on it.
  if (input.spineText && !spineTakesText(geo.spineWidthInches)) {
    issues.push({
      severity: "error",
      code: "spine_too_narrow_for_text",
      message: `spine is ${geo.spineWidthInches}in; text needs at least ${MIN_SPINE_TEXT_INCHES}in`,
    });
  }

  // Spine type must fit along the spine's height, not just its width.
  if (input.spineText) {
    // ~11pt Georgia averages 0.075in per character set vertically.
    const needed = input.spineText.length * 0.075;
    const available = geo.boardHeightInches - 2 * geo.turnInInches;
    if (needed > available) {
      issues.push({
        severity: "error",
        code: "spine_text_too_long",
        message: `spine text needs ~${needed.toFixed(2)}in of ${available.toFixed(2)}in available`,
      });
    }
  }

  if (geo.turnInInches <= 0) {
    issues.push({
      severity: "error",
      code: "no_turn_in",
      message: "cover sheet has no turn-in allowance to fold around the board",
    });
  }

  if (input.provider) {
    if (geo.sheetWidthInches > input.provider.maxSheetWidthInches) {
      issues.push({
        severity: "error",
        code: "cover_too_wide",
        message: `cover sheet ${geo.sheetWidthInches}in exceeds provider maximum ${input.provider.maxSheetWidthInches}in`,
      });
    }
    if (geo.sheetHeightInches > input.provider.maxSheetHeightInches) {
      issues.push({
        severity: "error",
        code: "cover_too_tall",
        message: `cover sheet ${geo.sheetHeightInches}in exceeds provider maximum ${input.provider.maxSheetHeightInches}in`,
      });
    }
  }

  return { passed: !issues.some((i) => i.severity === "error"), issues };
}
