import type { Calculator } from "./types";

// Cash Cycle (module0: the Product Verdict reads it). SPEC.md: deposit %,
// balance %, lead time days, sell-through days → cash tied up and days to
// recovery. The order's cost is needed to turn percentages into cash.
//   cash tied up = deposit + balance (both paid before the stock sells)
//   days to recovery = lead time + sell-through (from paying the deposit
//     to selling the last unit)

export interface CashCycleInputs {
  [key: string]: unknown;
  order_cost: number;
  deposit_pct: number;
  balance_pct: number;
  lead_time_days: number;
  sell_through_days: number;
}

export interface CashCycleOutputs {
  [key: string]: unknown;
  deposit: number;
  balance: number;
  cash_tied_up: number;
  days_to_recovery: number;
}

export const cashCycle: Calculator<CashCycleInputs, CashCycleOutputs> = {
  slug: "cash-cycle",
  name: "Cash Cycle",
  description: "How much cash the first order ties up, and for how long.",
  minTier: "module0",
  moduleNumber: 0,
  fields: [
    {
      key: "order_cost",
      label: "First order cost",
      kind: "money",
      help: "Stock, freight and duty for the whole order.",
    },
    { key: "deposit_pct", label: "Deposit", kind: "percent", default: 30, max: 100 },
    {
      key: "balance_pct",
      label: "Balance before shipping",
      kind: "percent",
      default: 70,
      max: 100,
    },
    {
      key: "lead_time_days",
      label: "Lead time",
      kind: "days",
      help: "From paying the deposit to stock arriving.",
    },
    {
      key: "sell_through_days",
      label: "Sell-through",
      kind: "days",
      help: "From stock arriving to the last unit sold.",
    },
  ],
  outputs: [
    { key: "deposit", label: "Deposit", kind: "money" },
    { key: "balance", label: "Balance", kind: "money" },
    { key: "cash_tied_up", label: "Cash tied up", kind: "money" },
    { key: "days_to_recovery", label: "Days to recovery", kind: "days" },
  ],
  validate: (i) =>
    i.deposit_pct + i.balance_pct > 100
      ? ["Deposit and balance can't add up to more than 100%."]
      : [],
  compute(i) {
    const deposit = i.order_cost * (i.deposit_pct / 100);
    const balance = i.order_cost * (i.balance_pct / 100);
    return {
      deposit,
      balance,
      cash_tied_up: deposit + balance,
      days_to_recovery: i.lead_time_days + i.sell_through_days,
    };
  },
  sentence: (o, money) =>
    `The first order ties up ${money(o.cash_tied_up)} for about ${o.days_to_recovery} days before it comes back.`,
};
