/**
 * The v1 markets (BUILD_BRIEF.md §1). Mirrors the `markets` table's seed rows;
 * `tests/schema.test.ts` asserts the two agree.
 *
 * EU carries German and French because those are the v1 language packs, not
 * because they are the EU's languages — which language a label needs depends
 * on the member state of sale, and that is a `language` rule's job.
 */

import type { MarketCode } from "./rules.js";

export type Market = { code: MarketCode; name: string; languages: string[]; currency: string };

export const MARKETS: Record<MarketCode, Market> = {
  EU: { code: "EU", name: "European Union", languages: ["de", "fr"], currency: "EUR" },
  UK: { code: "UK", name: "United Kingdom", languages: ["en"], currency: "GBP" },
  US: { code: "US", name: "United States", languages: ["en"], currency: "USD" },
};
