import { marginPct, type Calculator } from "./types";

// Offer Margin (course). SPEC.md: bundle contents and discount → margin per
// bundle vs. single units.
//   bundle price = unit price × units × (1 − discount)
//   bundle margin = bundle price − true cost × units
//   compared with selling the same units one at a time

export interface OfferMarginInputs {
  [key: string]: unknown;
  unit_price: number;
  true_cost: number;
  bundle_units: number;
  discount_pct: number;
}

export interface OfferMarginOutputs {
  [key: string]: unknown;
  bundle_price: number;
  bundle_margin: number;
  bundle_margin_pct: number;
  singles_margin: number;
  singles_margin_pct: number;
  difference: number;
}

export const offerMargin: Calculator<OfferMarginInputs, OfferMarginOutputs> = {
  slug: "offer-margin",
  name: "Offer Margin",
  description: "What a bundle discount leaves you, against selling the same units singly.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    { key: "unit_price", label: "Single-unit price", kind: "money" },
    { key: "true_cost", label: "True cost per unit", kind: "money", help: "From Landed Cost." },
    { key: "bundle_units", label: "Units in the bundle", kind: "integer", min: 2, default: 3 },
    { key: "discount_pct", label: "Bundle discount", kind: "percent", default: 10, max: 100 },
  ],
  outputs: [
    { key: "bundle_price", label: "Bundle price", kind: "money" },
    { key: "bundle_margin", label: "Margin per bundle", kind: "money" },
    { key: "bundle_margin_pct", label: "Bundle margin", kind: "percent" },
    { key: "singles_margin", label: "Margin on the same units sold singly", kind: "money" },
    { key: "difference", label: "The bundle costs you", kind: "money" },
  ],
  prefill: { true_cost: { from: "landed-cost", output: "true_cost" } },
  compute(i) {
    const bundle_price = i.unit_price * i.bundle_units * (1 - i.discount_pct / 100);
    const bundle_cost = i.true_cost * i.bundle_units;
    const singles_price = i.unit_price * i.bundle_units;
    const bundle_margin = bundle_price - bundle_cost;
    const singles_margin = singles_price - bundle_cost;
    return {
      bundle_price,
      bundle_margin,
      bundle_margin_pct: marginPct(bundle_price, bundle_cost),
      singles_margin,
      singles_margin_pct: marginPct(singles_price, bundle_cost),
      difference: singles_margin - bundle_margin,
    };
  },
  sentence: (o, money) =>
    `The bundle keeps ${money(o.bundle_margin)}, ${money(o.difference)} less than selling the same units one at a time.`,
};
