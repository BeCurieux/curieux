import { marginColour, marginPct, type Calculator, type Colour } from "./types";

// 3. Price Ladder (module0). SPEC.md → Calculator specs: up to five
// comparable products and her true cost → market low, median, high; her
// margin % at each; a recommended position, where margin under 40% is red,
// 40–55% amber and over 55% green (a physical product sold direct).
//
// The recommendation is the lowest of the three market points that's green,
// so she competes on price only as far as the margin allows; failing that,
// the lowest amber point; failing that, none.

export interface PriceLadderInputs {
  [key: string]: unknown;
  true_cost: number;
  comparables: { price: number; note?: string }[];
}

type Position = "low" | "median" | "high";

export interface PriceLadderOutputs {
  [key: string]: unknown;
  market_low: number;
  market_median: number;
  market_high: number;
  margin_low: number;
  margin_median: number;
  margin_high: number;
  colour_low: Colour;
  colour_median: Colour;
  colour_high: Colour;
  recommended_position: Position | null;
  recommended_price: number | null;
  verdict: Colour;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const POSITION_LABEL: Record<Position, string> = {
  low: "the market low",
  median: "the median",
  high: "the market high",
};

export const priceLadder: Calculator<PriceLadderInputs, PriceLadderOutputs> = {
  slug: "price-ladder",
  name: "Price Ladder",
  description: "Where your price can sit against what's already selling.",
  minTier: "module0",
  moduleNumber: 0,
  fields: [
    {
      key: "true_cost",
      label: "Your true cost per unit",
      kind: "money",
      help: "From Landed Cost.",
    },
    {
      key: "comparables",
      label: "Comparable products",
      kind: "rows",
      item: "comparable",
      minRows: 1,
      maxRows: 5,
      fields: [
        { key: "price", label: "Price", kind: "money", min: 0.01 },
        { key: "note", label: "Quality note", kind: "text", optional: true, maxLength: 120 },
      ],
    },
  ],
  outputs: [
    { key: "market_low", label: "Market low", kind: "money" },
    { key: "margin_low", label: "Your margin at the low", kind: "percent" },
    { key: "market_median", label: "Market median", kind: "money" },
    { key: "margin_median", label: "Your margin at the median", kind: "percent" },
    { key: "market_high", label: "Market high", kind: "money" },
    { key: "margin_high", label: "Your margin at the high", kind: "percent" },
    { key: "recommended_price", label: "Recommended price", kind: "money" },
    { key: "verdict", label: "At that price", kind: "colour" },
  ],
  prefill: { true_cost: { from: "landed-cost", output: "true_cost" } },
  compute(i) {
    const prices = i.comparables.map((c) => c.price);
    const points: Record<Position, number> = {
      low: Math.min(...prices),
      median: median(prices),
      high: Math.max(...prices),
    };
    const margins = {
      low: marginPct(points.low, i.true_cost),
      median: marginPct(points.median, i.true_cost),
      high: marginPct(points.high, i.true_cost),
    };
    const colours = {
      low: marginColour(margins.low),
      median: marginColour(margins.median),
      high: marginColour(margins.high),
    };
    const order: Position[] = ["low", "median", "high"];
    const recommended =
      order.find((p) => colours[p] === "green") ??
      order.find((p) => colours[p] === "amber") ??
      null;
    return {
      market_low: points.low,
      market_median: points.median,
      market_high: points.high,
      margin_low: margins.low,
      margin_median: margins.median,
      margin_high: margins.high,
      colour_low: colours.low,
      colour_median: colours.median,
      colour_high: colours.high,
      recommended_position: recommended,
      recommended_price: recommended ? points[recommended] : null,
      verdict: recommended ? colours[recommended] : "red",
    };
  },
  sentence(o, money) {
    if (!o.recommended_position)
      return "Even at the market high your margin is under 40%. The market doesn't leave room for this product at your cost.";
    const where = POSITION_LABEL[o.recommended_position];
    return o.verdict === "green"
      ? `Price at ${where}, ${money(o.recommended_price!)}: your margin is over 55% there.`
      : `The best you can do is ${where}, ${money(o.recommended_price!)}, with a margin of 40–55%. Workable, not comfortable.`;
  },
  verdict: (o) => o.verdict,
};
