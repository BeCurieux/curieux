import type { Calculator } from "./types";

// AOV Lever (course). SPEC.md: current AOV, margin, shipping cost →
// recommended free-shipping threshold (AOV × 1.25, rounded, only if margin
// covers it).
//   threshold = AOV × 1.25, rounded to the nearest whole unit of currency
//   "margin covers it": the extra margin on an order that reaches the
//   threshold pays for the shipping she now gives away:
//     (threshold − AOV) × margin ≥ shipping cost

export interface AovLeverInputs {
  [key: string]: unknown;
  current_aov: number;
  margin_pct: number;
  shipping_cost: number;
}

export interface AovLeverOutputs {
  [key: string]: unknown;
  threshold: number;
  extra_margin: number;
  covered: boolean;
  recommended_threshold: number | null;
}

export const aovLever: Calculator<AovLeverInputs, AovLeverOutputs> = {
  slug: "aov-lever",
  name: "AOV Lever",
  description: "Whether a free-shipping threshold pays for itself, and where to set it.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    { key: "current_aov", label: "Current average order value", kind: "money", min: 0.01 },
    { key: "margin_pct", label: "Margin", kind: "percent", max: 100, help: "From Unit Economics." },
    { key: "shipping_cost", label: "Shipping cost per order", kind: "money" },
  ],
  outputs: [
    { key: "threshold", label: "Threshold at AOV × 1.25", kind: "money" },
    { key: "extra_margin", label: "Extra margin when an order reaches it", kind: "money" },
    { key: "covered", label: "Does it cover the shipping?", kind: "yesno" },
    { key: "recommended_threshold", label: "Recommended free-shipping threshold", kind: "money" },
  ],
  prefill: { margin_pct: { from: "unit-economics", output: "margin_pct" } },
  compute(i) {
    const threshold = Math.round(i.current_aov * 1.25);
    const extra_margin = (threshold - i.current_aov) * (i.margin_pct / 100);
    const covered = extra_margin >= i.shipping_cost;
    return { threshold, extra_margin, covered, recommended_threshold: covered ? threshold : null };
  },
  sentence: (o, money) =>
    o.covered
      ? `Offer free shipping from ${money(o.threshold)}: the extra margin covers it.`
      : `At ${money(o.threshold)} the extra margin is ${money(o.extra_margin)}, not enough to cover shipping. Don't offer it yet.`,
};
