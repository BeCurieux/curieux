/**
 * `price_band_references` — hand-seeded for V1 (HANDOFF §11: "hand-seed for
 * V1").
 *
 * **These numbers are a first cut to be reviewed by the owner, not researched
 * figures.** They are ceilings on the default variant's pre-discount price:
 * at or below `budgetMax` is budget, at or below `midMax` is mid, at or below
 * `premiumMax` is premium, above that is luxury. They are written down here,
 * versioned with the taxonomy, and seeded into the database from this file, so
 * that a band is auditable ("mid, because $89 ≤ the apparel mid ceiling of
 * $120 AUD") rather than asserted.
 *
 * A currency with no row for a category gives `unknown`, never a converted
 * guess. Exchange rates move and a band built on yesterday's rate is a
 * different band. Add the row instead.
 */

import type { ParentCategory } from "./taxonomy";

export interface PriceBandReference {
  parentCategory: ParentCategory;
  currency: string;
  budgetMax: number;
  midMax: number;
  premiumMax: number;
}

type Ceilings = [budgetMax: number, midMax: number, premiumMax: number];

/** USD ceilings per parent category. AUD and GBP are hand-set beside them, not converted at runtime. */
const TABLE: Record<ParentCategory, { USD: Ceilings; AUD: Ceilings; GBP: Ceilings }> = {
  apparel: { USD: [35, 90, 250], AUD: [50, 130, 350], GBP: [30, 75, 200] },
  footwear: { USD: [50, 130, 300], AUD: [70, 190, 450], GBP: [40, 110, 250] },
  jewellery_accessories: { USD: [30, 100, 400], AUD: [45, 150, 600], GBP: [25, 85, 330] },
  bags_luggage: { USD: [40, 150, 450], AUD: [60, 220, 650], GBP: [35, 125, 380] },
  beauty_personal_care: { USD: [20, 50, 120], AUD: [30, 75, 180], GBP: [15, 40, 100] },
  home_living: { USD: [30, 100, 300], AUD: [45, 150, 450], GBP: [25, 85, 250] },
  kitchen_dining: { USD: [25, 80, 250], AUD: [35, 120, 380], GBP: [20, 65, 200] },
  food_drink: { USD: [15, 40, 100], AUD: [20, 60, 150], GBP: [12, 35, 85] },
  outdoor_sports: { USD: [40, 150, 450], AUD: [60, 220, 650], GBP: [35, 125, 380] },
  tools_hardware: { USD: [30, 120, 350], AUD: [45, 180, 520], GBP: [25, 100, 300] },
  kids_baby: { USD: [20, 60, 150], AUD: [30, 90, 220], GBP: [15, 50, 125] },
  stationery_books_gifts: { USD: [15, 40, 100], AUD: [20, 60, 150], GBP: [12, 35, 85] },
  tech_electronics: { USD: [40, 150, 500], AUD: [60, 220, 750], GBP: [35, 125, 420] },
  pets: { USD: [20, 60, 150], AUD: [30, 90, 220], GBP: [15, 50, 125] },
  other: { USD: [25, 80, 250], AUD: [35, 120, 380], GBP: [20, 65, 200] },
};

export const PRICE_BAND_REFERENCES: readonly PriceBandReference[] = Object.entries(TABLE).flatMap(
  ([parentCategory, byCurrency]) =>
    Object.entries(byCurrency).map(([currency, [budgetMax, midMax, premiumMax]]) => ({
      parentCategory: parentCategory as ParentCategory,
      currency,
      budgetMax,
      midMax,
      premiumMax,
    })),
);

export function referenceFor(
  parentCategory: ParentCategory | null,
  currency: string | null,
  references: readonly PriceBandReference[] = PRICE_BAND_REFERENCES,
): PriceBandReference | null {
  if (!parentCategory || !currency) return null;
  return references.find((r) => r.parentCategory === parentCategory && r.currency === currency.toUpperCase()) ?? null;
}
