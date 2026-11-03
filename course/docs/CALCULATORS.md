# Calculators

All twelve from SPEC.md → Calculator specs. Each is a typed file in
`src/lib/calc/<slug>.ts`: a form schema (stored in `calculators.schema_json`
and drawing the form), a pure `compute` function, and worked-example tests in
`tests/unit/calc.test.ts`. Formulas live only in code.

- **Money** is entered in her currency (AUD in Australia and when unknown,
  USD elsewhere) and saved with that currency. No tax line anywhere.
- **Percentages** are whole numbers: `2.9` is 2.9%.
- **Autosave:** results update as she types. A second after she stops, the
  server re-checks the inputs, recomputes, and saves a run. The browser's
  numbers are never what's saved. Her latest run fills the form when she
  comes back. With no run yet, some fields start from her other tools (true
  cost from Landed Cost, contribution and margin from Unit Economics).
- **Access:** each tool's page checks her tier on the server, and row level
  security refuses a saved run on a tool her tier doesn't reach.

## The core four (exactly as specified)

| Tool                         | Tier    | What it does                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landed Cost                  | free    | landed = unit cost + freight/units + duty on (unit cost + freight share) + packaging + misc/units; fees = sale price × fee% + fixed fee; returns = sale price × return% × 0.5; true cost = landed + fees + returns. Defaults: fee 2.9% + 0.30, returns 5%.                                                                                                                                      |
| Unit Economics               | free    | contribution = price + shipping charged − true cost − shipping cost; margin % of price; break-even = fixed ÷ contribution; target = (fixed + target) ÷ contribution, both rounded up to whole sales; max CAC = contribution × 0.5. The spec's sentence: "At this price you keep A$X per sale. You need N sales a month before you earn anything." If each sale loses money, it says so instead. |
| Price Ladder                 | module0 | Up to five comparables. Market low, median (middle two averaged for an even count), high, and her margin at each. Under 40% red, 40–55% amber, over 55% green.                                                                                                                                                                                                                                  |
| Product Verdict (`/verdict`) | module0 | Red if margin < 40, break-even > 150 a month, cash doesn't cover the first order, or compliance not done. Amber if margin 40–55, break-even 80–150, or no demand signal. Otherwise green. Lists the reasons (red first) and what would turn it green.                                                                                                                                           |

## Decisions the spec left open: please check these

1. **Landed Cost needs the sale price.** The spec computes fees and returns
   "at the intended sale price", so the form asks for it.
2. **Price Ladder's recommended position** is the cheapest of low, median
   and high that's green, then the cheapest amber, otherwise none. That
   means competing on price only as far as the margin allows.
3. **Product Verdict's margin and break-even come from Unit Economics.**
   Price Ladder's recommendation and Cash Cycle's cash tied up are shown
   beside them for context. "Cash available ≥ first order cash need" stays
   the yes/no question the spec lists. The server re-reads her latest Unit
   Economics run when saving, so the browser can't supply the numbers.
4. **Cash Cycle is Module 0, not course,** because the verdict reads it and
   Module 0 includes "all Module 0 lessons and tools". It asks for the first
   order's cost, which the spec doesn't list, to turn percentages into cash.
   Cash tied up = deposit + balance; days to recovery = lead time +
   sell-through.
5. **Which module each tool belongs to:** the core five are Module 0. The
   spec doesn't say for the other seven, so they have no module yet.

## The other eight: how each one-line spec was read

| Tool                  | Tier    | Formula                                                                                                                                                                                                                                                           |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash Cycle            | module0 | See above. Deposit + balance can't exceed 100%.                                                                                                                                                                                                                   |
| CAC Ceiling           | course  | max CAC = contribution × 0.5. Cost per click = CPC, or CPM ÷ 1000 ÷ click-through rate. Benchmark CAC = cost per click ÷ conversion rate. Ads allowed only if benchmark CAC < max.                                                                                |
| Offer Margin          | course  | Bundle price = unit price × units × (1 − discount). Margin per bundle = bundle price − true cost × units, against selling the same units singly.                                                                                                                  |
| AOV Lever             | course  | Threshold = AOV × 1.25, rounded to the nearest whole dollar. "Margin covers it" = (threshold − AOV) × margin ≥ shipping cost: the extra margin pays for the shipping given away. Otherwise no threshold is recommended.                                           |
| Shipping Rate         | course  | Per zone: charge = (carrier rate + packaging) ÷ (1 − payment fee), so the fee on the shipping charge is covered too.                                                                                                                                              |
| Reorder Point         | course  | Reorder at velocity × (lead time + safety days); order velocity × 60. Both rounded up to whole units.                                                                                                                                                             |
| 90-Day Cash           | course  | Each month: last month-end + orders × AOV × margin − fixed − that month's reorders. Reorders are entered by month (1–3), not by date. Flags any month below zero.                                                                                                 |
| Working / Not Working | course  | Each month: red if margin < 40% or sales below break-even (fixed ÷ contribution); amber if margin 40–55%; else green. **Stop** if the last two months are both red; **continue** if the latest is green and neither of the last two is red; otherwise **change**. |

The scorecard's continue/change/stop rule is the biggest interpretation
here. The spec names the outcome, not the rule, so tell me if Module 0
teaches a different one.
