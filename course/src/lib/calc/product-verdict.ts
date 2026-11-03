import { marginColour, type Calculator, type Colour } from "./types";

// 4. Product Verdict (module0). SPEC.md → Calculator specs, exactly:
//   red   if margin % < 40, or break-even units > 150/month for a first
//         product, or cash available < need, or compliance not done
//   amber if margin 40–55, or break-even 80–150, or no demand signal
//   green otherwise
// Margin and break-even come from her latest Unit Economics run (the
// /verdict page pulls them; the server re-reads them before saving), with
// Price Ladder and Cash Cycle shown beside them. Output: the verdict, the
// reasons as plain sentences, and what would turn it green.

export interface ProductVerdictInputs {
  [key: string]: unknown;
  product_name: string;
  margin_pct: number;
  /** Null when nothing she sells covers the fixed costs (no contribution). */
  break_even_units: number | null;
  demand_signal: boolean;
  compliance_done: boolean;
  cash_covers_first_order: boolean;
}

export interface ProductVerdictOutputs {
  [key: string]: unknown;
  verdict: Colour;
  reasons: string[];
  to_green: string[];
}

const pct = (value: number) => `${Math.round(value * 10) / 10}%`;

export interface VerdictFacts {
  margin_pct: number;
  break_even_units: number | null;
  demand_signal: boolean;
  compliance_done: boolean;
  cash_covers_first_order: boolean;
}

export function judge(i: VerdictFacts): ProductVerdictOutputs {
  const red: string[] = [];
  const amber: string[] = [];
  const good: string[] = [];
  const fixes: string[] = [];

  const margin = marginColour(i.margin_pct);
  if (margin === "red") {
    red.push(`Your margin is ${pct(i.margin_pct)}, under the 40% floor.`);
    fixes.push("Raise the price, lower the true cost, or both, until the margin is over 55%.");
  } else if (margin === "amber") {
    amber.push(`Your margin is ${pct(i.margin_pct)}: workable, but not over 55%.`);
    fixes.push("Get the margin over 55%: a higher price, a cheaper landed cost, or both.");
  } else good.push(`Your margin is ${pct(i.margin_pct)}, over 55%.`);

  const units = i.break_even_units;
  if (units === null) {
    red.push("Each sale loses money, so no number of sales covers your fixed costs.");
    fixes.push("Get the contribution per sale above zero first.");
  } else if (units > 150) {
    red.push(`You need ${units} sales a month to break even, more than 150 for a first product.`);
    fixes.push(
      "Cut fixed costs or raise the contribution per sale until break-even is under 80 sales a month.",
    );
  } else if (units >= 80) {
    amber.push(
      `You need ${units} sales a month to break even: possible, but a stretch for a first product.`,
    );
    fixes.push("Get break-even under 80 sales a month.");
  } else good.push(`You break even at ${units} sale${units === 1 ? "" : "s"} a month.`);

  if (!i.cash_covers_first_order) {
    red.push("The cash you have doesn't cover the first order.");
    fixes.push("Find a smaller first order, a lower deposit or more cash, so it's covered.");
  } else good.push("Your cash covers the first order.");

  if (!i.compliance_done) {
    red.push("The compliance check isn't done.");
    fixes.push("Finish the compliance check for where you'll sell.");
  } else good.push("The compliance check is done.");

  if (!i.demand_signal) {
    amber.push("You haven't found a demand signal yet.");
    fixes.push("Find a demand signal before you order stock.");
  } else good.push("You've found a demand signal.");

  const verdict: Colour = red.length ? "red" : amber.length ? "amber" : "green";
  return {
    verdict,
    reasons: [...red, ...amber, ...good],
    to_green: verdict === "green" ? [] : fixes,
  };
}

export const productVerdict: Calculator<ProductVerdictInputs, ProductVerdictOutputs> = {
  slug: "product-verdict",
  name: "Product Verdict",
  description:
    "Green, amber or red for this product, with the reasons and what would turn it green.",
  minTier: "module0",
  moduleNumber: 0,
  fields: [
    { key: "product_name", label: "Product", kind: "text", maxLength: 200 },
    {
      key: "margin_pct",
      label: "Margin",
      kind: "percent",
      min: -1000,
      max: 100,
      help: "From Unit Economics.",
    },
    {
      key: "break_even_units",
      label: "Break-even sales a month",
      kind: "integer",
      optional: true,
      help: "From Unit Economics. Blank when each sale loses money.",
    },
    { key: "demand_signal", label: "Have you found a demand signal?", kind: "yesno" },
    { key: "compliance_done", label: "Is the compliance check done?", kind: "yesno" },
    {
      key: "cash_covers_first_order",
      label: "Does the cash you have cover the first order's cash need?",
      kind: "yesno",
      help: "Cash Cycle shows the cash the first order ties up.",
    },
  ],
  outputs: [{ key: "verdict", label: "Verdict", kind: "colour" }],
  compute: (i) =>
    judge({
      margin_pct: i.margin_pct,
      break_even_units: i.break_even_units ?? null,
      demand_signal: i.demand_signal,
      compliance_done: i.compliance_done,
      cash_covers_first_order: i.cash_covers_first_order,
    }),
  verdict: (o) => o.verdict,
};
