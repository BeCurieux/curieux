import { z } from "zod";

// The Ads Profitability Calculator (Ads That Actually Sell, Module 1).
//
// Deterministic and dependency-free: the same inputs always give the same
// answer, in the browser and in tests. Money is in one currency per
// scenario (AUD by default); rates are fractions (0.1 = 10%).
//
// Every number is per order unless it says otherwise. One order is one
// customer buying the main product, with an upsell taken on `upsell.takeRate`
// of orders (so per-order figures are expected values).
//
// A figure that isn't mathematically defined, such as break-even ROAS when
// every sale loses money, is `null` with a reason in `notes`, never
// Infinity or NaN. Formulas are in docs and in `FORMULAS` below.

const money = z.number().finite().min(0).max(10_000_000);
const rate = z.number().finite().min(0).max(1);

export const calculatorInputSchema = z.object({
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("AUD"),
  /** Listed price of the main product, as the customer sees it. */
  price: money,
  discount: z
    .object({ kind: z.enum(["amount", "percent"]), value: money })
    .default({ kind: "amount", value: 0 }),
  /**
   * not_registered: no GST charged or remitted.
   * inclusive: the price already includes GST.
   * exclusive: GST is added on top of the price at checkout.
   */
  gst: z
    .object({
      mode: z.enum(["not_registered", "inclusive", "exclusive"]),
      rate: rate.default(0.1),
    })
    .default({ mode: "not_registered", rate: 0.1 }),
  /** Payment or platform fees on what the customer pays. */
  fees: z.object({ percent: rate, fixed: money }).default({ percent: 0, fixed: 0 }),
  /** Per-order costs: production, delivery, licences, anything that scales with sales. */
  fulfilmentCost: money.default(0),
  otherVariableCost: money.default(0),
  /** Share of orders refunded. Fees aren't returned and costs are still incurred. */
  refundRate: rate.default(0),
  /** Per-order allowance for chargebacks and disputes. */
  chargebackAllowance: money.default(0),
  upsell: z
    .object({ price: money, takeRate: rate, cost: money.default(0) })
    .default({ price: 0, takeRate: 0, cost: 0 }),
  /** The period being looked at. */
  ads: z
    .object({
      spend: money.default(0),
      orders: z.number().int().min(0).max(10_000_000).default(0),
      /** Revenue Meta reports, if known. Otherwise it's estimated from orders. */
      reportedRevenue: money.optional(),
      /** Purchases per visit (landing page view), if known. */
      conversionRate: rate.optional(),
    })
    .default({ spend: 0, orders: 0 }),
  /** Uncertain: extra contribution a customer brings later. Shown separately. */
  laterContribution: money.optional(),
});

export type CalculatorInput = z.input<typeof calculatorInputSchema>;
type Parsed = z.output<typeof calculatorInputSchema>;

export interface CalculatorResult {
  currency: string;
  perOrder: {
    /** Price after discount, before GST is added (if exclusive). */
    salePrice: number;
    /** What the customer pays, upsell included (the figure ad platforms usually report). */
    customerPays: number;
    gst: number;
    /** Revenue after GST and refunds. */
    netRevenue: number;
    fees: number;
    variableCosts: number;
    /** Net revenue − fees − variable costs. What's left to pay for ads and profit. */
    contribution: number;
  };
  breakEven: {
    /** Most you can spend on ads per order before losing money. */
    cac: number | null;
    /** Reported revenue ÷ ad spend at which you break even. */
    roas: number | null;
    /** Most you can pay per visit, at your conversion rate. */
    costPerVisit: number | null;
    /** With the uncertain later contribution added. */
    cacWithLater: number | null;
    /** Ad spend that breaks even at 1, 2, 5, 10 and 20 orders. */
    spendByOrders: { orders: number; spend: number }[];
  };
  ads: {
    spend: number;
    orders: number;
    cac: number | null;
    roas: number | null;
    /** Contribution from the period's orders, before ads. */
    contributionBeforeAds: number;
    /** After ad spend: the period's profit or loss on these orders. */
    contributionAfterAds: number;
    /** Orders needed for this spend to break even. */
    ordersToBreakEven: number | null;
  };
  notes: string[];
}

/** a ÷ b, or null when b is zero or the result isn't a finite number. */
export function divide(a: number, b: number): number | null {
  if (b === 0) return null;
  const v = a / b;
  return Number.isFinite(v) ? v : null;
}

const exGst = (amount: number, mode: Parsed["gst"]["mode"], r: number) =>
  mode === "inclusive" ? amount / (1 + r) : amount;
const paid = (amount: number, mode: Parsed["gst"]["mode"], r: number) =>
  mode === "exclusive" ? amount * (1 + r) : amount;

export function calculate(raw: CalculatorInput): CalculatorResult {
  const i = calculatorInputSchema.parse(raw);
  const notes: string[] = [];
  const { mode, rate: r } = i.gst;

  const discountAmount =
    i.discount.kind === "percent"
      ? (i.price * Math.min(i.discount.value, 100)) / 100
      : i.discount.value;
  if (discountAmount > i.price)
    notes.push("The discount is larger than the price, so the sale price is treated as 0.");
  const salePrice = Math.max(0, i.price - discountAmount);

  const upTake = i.upsell.price > 0 ? i.upsell.takeRate : 0;
  const customerPays = paid(salePrice, mode, r) + upTake * paid(i.upsell.price, mode, r);
  const revenueExGst = exGst(salePrice, mode, r) + upTake * exGst(i.upsell.price, mode, r);
  const gst = customerPays - revenueExGst;

  const netRevenue = revenueExGst * (1 - i.refundRate);
  const fees = customerPays > 0 ? customerPays * i.fees.percent + i.fees.fixed : 0;
  const variableCosts =
    i.fulfilmentCost + i.otherVariableCost + i.chargebackAllowance + upTake * i.upsell.cost;
  const contribution = netRevenue - fees - variableCosts;

  if (i.refundRate === 1) notes.push("Every order is refunded, so no revenue is kept.");
  if (contribution <= 0)
    notes.push(
      "Each order loses money before any ad spend, so no amount of ad spend can break even. Change the price, fees or costs first.",
    );
  if (mode !== "not_registered")
    notes.push(
      "GST is taken out of revenue: it's collected for the tax office, not yours to spend.",
    );

  const positive = contribution > 0 ? contribution : null;
  const cac = positive;
  const roas = positive !== null && customerPays > 0 ? divide(customerPays, positive) : null;
  const cr = i.ads.conversionRate;
  const costPerVisit = positive !== null && cr !== undefined && cr > 0 ? positive * cr : null;
  const laterTotal = contribution + (i.laterContribution ?? 0);
  const cacWithLater = i.laterContribution !== undefined && laterTotal > 0 ? laterTotal : null;
  if (cacWithLater !== null)
    notes.push(
      "The figure with later contribution depends on future purchases that may not happen. Plan on the figure without it.",
    );
  const spendByOrders =
    positive === null
      ? []
      : [1, 2, 5, 10, 20].map((orders) => ({ orders, spend: orders * positive }));

  const { spend, orders } = i.ads;
  const reported = i.ads.reportedRevenue ?? orders * customerPays;
  const adsCac = divide(spend, orders);
  const adsRoas = divide(reported, spend);
  if (spend > 0 && orders === 0) notes.push("No orders yet, so cost per order isn't defined.");
  const contributionBeforeAds = orders * contribution;
  const contributionAfterAds = contributionBeforeAds - spend;
  const ordersToBreakEven =
    positive === null ? null : spend === 0 ? 0 : Math.ceil(divide(spend, positive) ?? 0);

  return {
    currency: i.currency,
    perOrder: { salePrice, customerPays, gst, netRevenue, fees, variableCosts, contribution },
    breakEven: { cac, roas, costPerVisit, cacWithLater, spendByOrders },
    ads: {
      spend,
      orders,
      cac: adsCac,
      roas: adsRoas,
      contributionBeforeAds,
      contributionAfterAds,
      ordersToBreakEven,
    },
    notes,
  };
}

/** Plain-English formulas, shown next to each figure. */
export const FORMULAS = {
  salePrice: "Listed price − discount (never below 0)",
  customerPays: "Sale price (+ GST if added at checkout) + upsell price × upsell take rate",
  netRevenue: "What the customer pays, less GST, less the share refunded",
  fees: "What the customer pays × fee % + fixed fee per order",
  contribution: "Net revenue − fees − per-order costs",
  breakEvenCac: "Contribution per order (only if it's above 0)",
  breakEvenRoas: "What the customer pays ÷ contribution per order",
  costPerVisit: "Contribution per order × conversion rate",
  cac: "Ad spend ÷ orders",
  roas: "Reported revenue ÷ ad spend (revenue, not profit)",
  contributionAfterAds: "Orders × contribution per order − ad spend",
} as const;

/** Run the same scenario with changes, e.g. low, base and high. */
export function compare(
  base: CalculatorInput,
  variants: { name: string; change: (input: CalculatorInput) => CalculatorInput }[],
) {
  return variants.map((v) => ({
    name: v.name,
    result: calculate(v.change(structuredClone(base))),
  }));
}
