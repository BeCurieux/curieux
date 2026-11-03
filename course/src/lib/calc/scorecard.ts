import { marginColour, type Calculator, type Colour } from "./types";

// Working / Not Working scorecard (course). SPEC.md: three months of actuals
// vs. the Module 0 thresholds → continue, change or stop, with the reasons.
//
// Each month is judged by the Module 0 thresholds: red if the margin is
// under 40% or sales didn't reach break-even, amber if the margin is
// 40–55%, green otherwise. Then:
//   stop     the last two months are both red
//   continue the latest month is green and neither of the last two is red
//   change   anything else

export interface ScorecardInputs {
  [key: string]: unknown;
  months: { units_sold: number; margin_pct: number; contribution: number; fixed_costs: number }[];
}

type Decision = "continue" | "change" | "stop";

export interface ScorecardOutputs {
  [key: string]: unknown;
  months: {
    month: number;
    units_sold: number;
    break_even_units: number | null;
    margin_pct: number;
    status: Colour;
  }[];
  decision: Decision;
  reasons: string[];
}

const pct = (value: number) => `${Math.round(value * 10) / 10}%`;

export const scorecard: Calculator<ScorecardInputs, ScorecardOutputs> = {
  slug: "scorecard",
  name: "Working / Not Working",
  description:
    "Three months of real numbers against the Module 0 thresholds: continue, change or stop.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    {
      key: "months",
      label: "Your last three months, oldest first",
      kind: "rows",
      item: "month",
      minRows: 3,
      maxRows: 3,
      fields: [
        { key: "units_sold", label: "Sales", kind: "integer" },
        { key: "margin_pct", label: "Margin", kind: "percent", min: -1000, max: 100 },
        { key: "contribution", label: "Contribution per sale", kind: "money", min: -100000 },
        { key: "fixed_costs", label: "Fixed costs", kind: "money" },
      ],
    },
  ],
  outputs: [{ key: "decision", label: "Decision", kind: "text" }],
  tables: [
    {
      key: "months",
      label: "Month by month",
      columns: [
        { key: "month", label: "Month", kind: "integer" },
        { key: "units_sold", label: "Sales", kind: "integer" },
        { key: "break_even_units", label: "Break-even", kind: "integer" },
        { key: "margin_pct", label: "Margin", kind: "percent" },
        { key: "status", label: "", kind: "colour" },
      ],
    },
  ],
  compute(i) {
    const reasons: string[] = [];
    const months = i.months.map((m, index) => {
      const month = index + 1;
      const break_even_units =
        m.contribution > 0 ? Math.ceil(m.fixed_costs / m.contribution - 1e-9) : null;
      const covered = break_even_units !== null && m.units_sold >= break_even_units;
      const margin = marginColour(m.margin_pct);
      const status: Colour = margin === "red" || !covered ? "red" : margin;
      return {
        month,
        units_sold: m.units_sold,
        break_even_units,
        margin_pct: m.margin_pct,
        status,
      };
    });
    for (const m of months) {
      if (m.margin_pct < 40)
        reasons.push(`Month ${m.month}: margin ${pct(m.margin_pct)}, under 40%.`);
      else if (m.margin_pct <= 55)
        reasons.push(`Month ${m.month}: margin ${pct(m.margin_pct)}, under 55%.`);
      if (m.break_even_units === null) reasons.push(`Month ${m.month}: each sale lost money.`);
      else if (m.units_sold < m.break_even_units)
        reasons.push(
          `Month ${m.month}: ${m.units_sold} sales, short of the ${m.break_even_units} needed to break even.`,
        );
    }
    const [, second, third] = months as [
      ScorecardOutputs["months"][0],
      ScorecardOutputs["months"][0],
      ScorecardOutputs["months"][0],
    ];
    const decision: Decision =
      second.status === "red" && third.status === "red"
        ? "stop"
        : third.status === "green" && second.status !== "red"
          ? "continue"
          : "change";
    if (!reasons.length) reasons.push("Every month cleared the Module 0 thresholds.");
    return { months, decision, reasons };
  },
  sentence: (o) =>
    ({
      continue: "Continue: it's working.",
      change: "Change something: it isn't working yet, but it isn't failing.",
      stop: "Stop: the last two months both missed the Module 0 thresholds.",
    })[o.decision],
  verdict: (o): Colour =>
    ({ continue: "green", change: "amber", stop: "red" })[o.decision] as Colour,
};
