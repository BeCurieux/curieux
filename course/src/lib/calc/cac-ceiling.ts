import type { Calculator, Colour } from "./types";

// CAC Ceiling (course). SPEC.md: contribution, expected conversion %,
// benchmark CPM/CPC → max CAC and whether ads are allowed (yes only if the
// benchmark CAC is under the max).
//   max CAC = contribution × 0.5 (as in Unit Economics)
//   cost per click = CPC, or CPM ÷ 1000 ÷ click-through rate
//   benchmark CAC = cost per click ÷ conversion rate

export interface CacCeilingInputs {
  [key: string]: unknown;
  contribution: number;
  conversion_pct: number;
  cpc?: number;
  cpm?: number;
  ctr_pct?: number;
}

export interface CacCeilingOutputs {
  [key: string]: unknown;
  max_cac: number;
  cost_per_click: number;
  benchmark_cac: number;
  ads_allowed: boolean;
}

export const cacCeiling: Calculator<CacCeilingInputs, CacCeilingOutputs> = {
  slug: "cac-ceiling",
  name: "CAC Ceiling",
  description: "Whether paid ads can win a customer for less than you can afford.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    {
      key: "contribution",
      label: "Contribution per sale",
      kind: "money",
      help: "From Unit Economics.",
    },
    {
      key: "conversion_pct",
      label: "Expected conversion rate",
      kind: "percent",
      min: 0.01,
      max: 100,
    },
    { key: "cpc", label: "Benchmark cost per click (CPC)", kind: "money", optional: true },
    {
      key: "cpm",
      label: "Or: benchmark cost per 1,000 views (CPM)",
      kind: "money",
      optional: true,
    },
    {
      key: "ctr_pct",
      label: "…and click-through rate",
      kind: "percent",
      optional: true,
      min: 0.01,
      max: 100,
    },
  ],
  outputs: [
    { key: "max_cac", label: "Most you can spend per first order", kind: "money" },
    { key: "benchmark_cac", label: "What ads would cost per first order", kind: "money" },
    { key: "ads_allowed", label: "Ads allowed?", kind: "yesno" },
  ],
  prefill: { contribution: { from: "unit-economics", output: "contribution" } },
  validate: (i) =>
    i.cpc !== undefined || (i.cpm !== undefined && i.ctr_pct !== undefined)
      ? []
      : ["Enter a CPC, or a CPM with its click-through rate."],
  compute(i) {
    const cost_per_click = i.cpc ?? i.cpm! / 1000 / (i.ctr_pct! / 100);
    const benchmark_cac = cost_per_click / (i.conversion_pct / 100);
    const max_cac = Math.max(0, i.contribution * 0.5);
    return { max_cac, cost_per_click, benchmark_cac, ads_allowed: benchmark_cac < max_cac };
  },
  sentence: (o, money) =>
    o.ads_allowed
      ? `Ads would cost about ${money(o.benchmark_cac)} per first order, under your ${money(o.max_cac)} ceiling.`
      : `Ads would cost about ${money(o.benchmark_cac)} per first order, over your ${money(o.max_cac)} ceiling. Not yet.`,
  verdict: (o): Colour => (o.ads_allowed ? "green" : "red"),
};
