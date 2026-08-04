// Automated preflight (brief §18).
// Runs before any print PDF is approved for submission. Prefers hard
// rejection over a bad physical book. Pure functions — fully unit-testable.

import { BOOK_SPEC } from "@/lib/book/structure";

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
