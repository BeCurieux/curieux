import { aovLever } from "./aov-lever";
import { cacCeiling } from "./cac-ceiling";
import { cashCycle } from "./cash-cycle";
import { landedCost } from "./landed-cost";
import { ninetyDayCash } from "./ninety-day-cash";
import { offerMargin } from "./offer-margin";
import { priceLadder } from "./price-ladder";
import { productVerdict } from "./product-verdict";
import { reorderPoint } from "./reorder-point";
import { scorecard } from "./scorecard";
import { shippingRate } from "./shipping-rate";
import type { Calculator } from "./types";
import { unitEconomics } from "./unit-economics";

// All twelve, in the order the tool library lists them.
export const CALCULATORS = [
  landedCost,
  unitEconomics,
  priceLadder,
  cashCycle,
  productVerdict,
  cacCeiling,
  offerMargin,
  aovLever,
  shippingRate,
  reorderPoint,
  ninetyDayCash,
  scorecard,
] as unknown as Calculator[];

export function calculator(slug: string): Calculator | undefined {
  return CALCULATORS.find((calc) => calc.slug === slug);
}
