import type { Calculator } from "./types";

// 2. Unit Economics (free). SPEC.md → Calculator specs, exactly:
//   contribution margin per unit = price + shipping charged − true cost − shipping cost
//   margin % of price
//   break-even units per month = fixed costs ÷ contribution
//   units needed for target = (fixed + target) ÷ contribution
//   maximum affordable CAC = contribution × 0.5
// Units are whole sales, so the two unit counts round up. With nothing left
// per sale (contribution ≤ 0) no number of sales breaks even: those are null.

export interface UnitEconomicsInputs {
  [key: string]: unknown;
  sale_price: number;
  true_cost: number;
  shipping_charged: number;
  shipping_cost: number;
  fixed_monthly: number;
  target_monthly: number;
}

export interface UnitEconomicsOutputs {
  [key: string]: unknown;
  contribution: number;
  margin_pct: number;
  break_even_units: number | null;
  units_for_target: number | null;
  max_cac: number;
}

const salesNeeded = (amount: number, contribution: number) =>
  contribution > 0 ? Math.ceil(amount / contribution - 1e-9) : null;

export const unitEconomics: Calculator<UnitEconomicsInputs, UnitEconomicsOutputs> = {
  slug: "unit-economics",
  name: "Unit Economics",
  description: "What you keep from each sale, and how many sales a month cover your costs.",
  minTier: "free",
  moduleNumber: 0,
  fields: [
    { key: "sale_price", label: "Sale price", kind: "money" },
    { key: "true_cost", label: "True cost per unit", kind: "money", help: "From Landed Cost." },
    {
      key: "shipping_charged",
      label: "Shipping charged to the customer",
      kind: "money",
      default: 0,
    },
    { key: "shipping_cost", label: "Shipping cost to you", kind: "money", default: 0 },
    {
      key: "fixed_monthly",
      label: "Fixed monthly costs",
      kind: "money",
      help: "Shopify plan, apps, domain, insurance.",
    },
    { key: "target_monthly", label: "Target monthly take-home", kind: "money", default: 0 },
  ],
  outputs: [
    { key: "contribution", label: "Contribution per sale", kind: "money" },
    { key: "margin_pct", label: "Margin (of price)", kind: "percent" },
    { key: "break_even_units", label: "Break-even sales a month", kind: "integer" },
    { key: "units_for_target", label: "Sales a month for your target", kind: "integer" },
    {
      key: "max_cac",
      label: "Most you can spend to win a first order",
      kind: "money",
      help: "Never more than half the contribution.",
    },
  ],
  prefill: { true_cost: { from: "landed-cost", output: "true_cost" } },
  compute(i) {
    const contribution = i.sale_price + i.shipping_charged - i.true_cost - i.shipping_cost;
    return {
      contribution,
      margin_pct: i.sale_price > 0 ? (contribution / i.sale_price) * 100 : 0,
      break_even_units: salesNeeded(i.fixed_monthly, contribution),
      units_for_target: salesNeeded(i.fixed_monthly + i.target_monthly, contribution),
      max_cac: Math.max(0, contribution * 0.5),
    };
  },
  // The spec's sentence: "At this price you keep A$X per sale. You need N
  // sales a month before you earn anything."
  sentence(o, money) {
    if (o.contribution <= 0)
      return `At this price you lose ${money(-o.contribution)} on every sale, so no number of sales covers your costs.`;
    return `At this price you keep ${money(o.contribution)} per sale. You need ${o.break_even_units} sale${
      o.break_even_units === 1 ? "" : "s"
    } a month before you earn anything.`;
  },
};
