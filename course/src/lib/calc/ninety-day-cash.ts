import type { Calculator, Colour } from "./types";

// 90-Day Cash (course). SPEC.md: opening cash, orders/month, AOV, margin,
// fixed costs, reorder dates → month-end cash for three months, with a flag
// on any month below zero. Reorders are entered by month (1, 2 or 3) with
// their cost.
//   month-end = last month-end + orders × AOV × margin − fixed − reorders

export interface NinetyDayCashInputs {
  [key: string]: unknown;
  opening_cash: number;
  orders_per_month: number;
  aov: number;
  margin_pct: number;
  fixed_monthly: number;
  reorders: { month: number; amount: number }[];
}

export interface NinetyDayCashOutputs {
  [key: string]: unknown;
  months: {
    month: number;
    contribution: number;
    reorders: number;
    month_end: number;
    below_zero: boolean;
  }[];
  lowest: number;
  any_below_zero: boolean;
}

export const ninetyDayCash: Calculator<NinetyDayCashInputs, NinetyDayCashOutputs> = {
  slug: "ninety-day-cash",
  name: "90-Day Cash",
  description: "Cash at the end of each of the next three months, and whether any dips below zero.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    { key: "opening_cash", label: "Cash today", kind: "money" },
    { key: "orders_per_month", label: "Orders per month", kind: "number" },
    { key: "aov", label: "Average order value", kind: "money" },
    { key: "margin_pct", label: "Margin", kind: "percent", max: 100, help: "From Unit Economics." },
    { key: "fixed_monthly", label: "Fixed costs per month", kind: "money" },
    {
      key: "reorders",
      label: "Reorders",
      kind: "rows",
      item: "reorder",
      minRows: 0,
      maxRows: 6,
      fields: [
        { key: "month", label: "Month (1–3)", kind: "integer", min: 1, max: 3 },
        { key: "amount", label: "Cost", kind: "money" },
      ],
    },
  ],
  outputs: [{ key: "lowest", label: "Lowest month-end cash", kind: "money" }],
  tables: [
    {
      key: "months",
      label: "Month by month",
      columns: [
        { key: "month", label: "Month", kind: "integer" },
        { key: "contribution", label: "In from sales", kind: "money" },
        { key: "reorders", label: "Reorders", kind: "money" },
        { key: "month_end", label: "Month-end cash", kind: "money" },
        { key: "below_zero", label: "Below zero?", kind: "yesno" },
      ],
    },
  ],
  prefill: { margin_pct: { from: "unit-economics", output: "margin_pct" } },
  compute(i) {
    const contribution = i.orders_per_month * i.aov * (i.margin_pct / 100);
    let cash = i.opening_cash;
    const months = [1, 2, 3].map((month) => {
      const reorders = i.reorders
        .filter((r) => r.month === month)
        .reduce((sum, r) => sum + r.amount, 0);
      cash = cash + contribution - i.fixed_monthly - reorders;
      return { month, contribution, reorders, month_end: cash, below_zero: cash < 0 };
    });
    const lowest = Math.min(...months.map((m) => m.month_end));
    return { months, lowest, any_below_zero: lowest < 0 };
  },
  sentence(o, money) {
    const low = o.months.filter((m) => m.below_zero).map((m) => `month ${m.month}`);
    return low.length
      ? `Cash goes below zero in ${low.join(" and ")}. Move a reorder or cut costs before then.`
      : `Cash stays above zero for all three months; the lowest point is ${money(o.lowest)}.`;
  },
  verdict: (o): Colour => (o.any_below_zero ? "red" : "green"),
};
