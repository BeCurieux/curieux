import { calculate, type CalculatorInput, type CalculatorResult } from "./calculator";

// The calculator page's form, in the units people type (percentages as
// 0–100, money as decimals), converted to the engine's input. Also the
// plain-English reading of a result: what it does and doesn't tell you.
// Pure, so it's tested without a browser.

export const CURRENCIES = {
  AUD: "A$",
  USD: "US$",
  GBP: "£",
  NZD: "NZ$",
  CAD: "CA$",
} as const;
export type Currency = keyof typeof CURRENCIES;

export interface CalculatorForm {
  currency: Currency;
  price: string;
  discountPct: string;
  gstMode: "not_registered" | "inclusive" | "exclusive";
  gstRatePct: string;
  feePct: string;
  feeFixed: string;
  costs: string;
  refundPct: string;
  upsellPrice: string;
  upsellTakePct: string;
  upsellCost: string;
  adSpend: string;
  orders: string;
  conversionPct: string;
}

/** Module 1's example A: a A$49 bundle, Gumroad-style fees, 3% refunds, A$120 for 2 sales. */
export const DEFAULT_FORM: CalculatorForm = {
  currency: "AUD",
  price: "49",
  discountPct: "",
  gstMode: "not_registered",
  gstRatePct: "10",
  feePct: "10",
  feeFixed: "0.80",
  costs: "",
  refundPct: "3",
  upsellPrice: "",
  upsellTakePct: "",
  upsellCost: "",
  adSpend: "120",
  orders: "2",
  conversionPct: "",
};

export type FormErrors = Partial<Record<keyof CalculatorForm, string>>;

const MAX_MONEY = 10_000_000;

function readNumber(
  raw: string,
  { percent = false, integer = false, required = false } = {},
): { value?: number; error?: string } {
  const text = raw.trim().replace(/,/g, "");
  if (text === "") return required ? { error: "Enter a number." } : { value: undefined };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: "Enter a number, like 49 or 0.80." };
  if (value < 0) return { error: "Can't be negative." };
  if (percent && value > 100) return { error: "Enter a percentage from 0 to 100." };
  if (!percent && value > MAX_MONEY)
    return { error: "That's larger than this calculator handles." };
  if (integer && !Number.isInteger(value)) return { error: "Enter a whole number of sales." };
  return { value };
}

export function toInput(form: CalculatorForm): { input?: CalculatorInput; errors: FormErrors } {
  const errors: FormErrors = {};
  const n = (key: keyof CalculatorForm, opts?: Parameters<typeof readNumber>[1]) => {
    const r = readNumber(String(form[key]), opts);
    if (r.error) errors[key] = r.error;
    return r.value;
  };
  const pct = (key: keyof CalculatorForm) => (n(key, { percent: true }) ?? 0) / 100;

  const price = n("price", { required: true });
  const discount = pct("discountPct");
  const gstRate = pct("gstRatePct");
  const feePercent = pct("feePct");
  const feeFixed = n("feeFixed") ?? 0;
  const costs = n("costs") ?? 0;
  const refund = pct("refundPct");
  const upsellPrice = n("upsellPrice") ?? 0;
  const upsellTake = pct("upsellTakePct");
  const upsellCost = n("upsellCost") ?? 0;
  const spend = n("adSpend") ?? 0;
  const orders = n("orders", { integer: true }) ?? 0;
  const conversion = n("conversionPct", { percent: true });

  if (Object.keys(errors).length > 0 || price === undefined) return { errors };
  return {
    errors,
    input: {
      currency: form.currency,
      price,
      discount: { kind: "percent", value: discount * 100 },
      gst: { mode: form.gstMode, rate: gstRate },
      fees: { percent: feePercent, fixed: feeFixed },
      fulfilmentCost: costs,
      refundRate: refund,
      upsell: { price: upsellPrice, takeRate: upsellTake, cost: upsellCost },
      ads: {
        spend,
        orders,
        conversionRate: conversion === undefined ? undefined : conversion / 100,
      },
    },
  };
}

export function formatMoney(value: number | null, currency: Currency): string {
  if (value === null) return "Not defined";
  const text = `${CURRENCIES[currency]}${Math.abs(value).toFixed(2)}`;
  return value < 0 ? `−${text}` : text;
}

export const formatRatio = (value: number | null) =>
  value === null ? "Not defined" : value.toFixed(2);

/**
 * Fewer sales than this and the page says there isn't enough evidence to
 * judge an ad either way. From Her Little Empire's own rule (Income Fit
 * Test): fewer than 5 real conversations isn't a no.
 */
export const MIN_SALES_TO_JUDGE = 5;

export interface Reading {
  tone: "info" | "warning" | "success" | "danger";
  title: string;
  text: string;
}

/** What this result does and doesn't show, worst news first. Never a prediction. */
export function interpret(result: CalculatorResult, currency: Currency): Reading[] {
  const out: Reading[] = [];
  const { perOrder, breakEven, ads } = result;
  const money = (v: number | null) => formatMoney(v, currency);

  if (perOrder.contribution <= 0) {
    out.push({
      tone: "danger",
      title: "Each sale loses money before any ads",
      text: `After fees, tax, refunds and costs, each sale leaves ${money(perOrder.contribution)}. No ad budget can fix that. Look at the price, fees or costs first.`,
    });
  }

  const hasPeriod = ads.spend > 0 || ads.orders > 0;
  if (!hasPeriod && perOrder.contribution > 0) {
    out.push({
      tone: "info",
      title: "Add a real ad period to compare",
      text: `You can spend up to ${money(breakEven.cac)} in ads per sale and break even. Add what you spent and the sales it brought to see where a real period sits.`,
    });
  }

  if (hasPeriod && ads.roas !== null && ads.roas >= 1 && ads.contributionAfterAds < 0) {
    out.push({
      tone: "warning",
      title: "A ROAS above 1 can still be a loss",
      text: `This period's ROAS is ${formatRatio(ads.roas)}, but you need ${formatRatio(breakEven.roas)} to break even, because ROAS counts revenue, not what you keep. After ads, these sales are ${money(ads.contributionAfterAds)}.`,
    });
  } else if (hasPeriod && ads.contributionAfterAds < 0 && perOrder.contribution > 0) {
    out.push({
      tone: "warning",
      title: "Below break-even for this period",
      text: `After ads, these sales are ${money(ads.contributionAfterAds)}. This spend needed ${ads.ordersToBreakEven ?? "more"} sales to break even.`,
    });
  } else if (hasPeriod && ads.contributionAfterAds >= 0 && ads.orders > 0) {
    out.push({
      tone: "success",
      title: "At or above break-even for this period",
      text: `After ads, these sales are ${money(ads.contributionAfterAds)}. That's this period only, before your own time; it doesn't say what the next period does.`,
    });
  }

  if (hasPeriod && ads.orders < MIN_SALES_TO_JUDGE) {
    out.push({
      tone: "info",
      title: "Not enough evidence yet, either way",
      text: `${ads.orders === 0 ? "No sales" : `${ads.orders} ${ads.orders === 1 ? "sale" : "sales"}`} is too few to judge whether this ad works. With under ${MIN_SALES_TO_JUDGE} sales, chance can swing the result. Treat this as where break-even is, not as a verdict on the ad.`,
    });
  }

  const fixed = result.perOrder.fees > 0 && perOrder.customerPays > 0;
  if (fixed) {
    const share = perOrder.fees / perOrder.customerPays;
    if (share >= 0.15)
      out.push({
        tone: "info",
        title: "Fees take a large share of this price",
        text: `Fees are ${(share * 100).toFixed(0)}% of what the customer pays. Fixed fees hurt small prices most; an upsell or a bundle gives an ad more room.`,
      });
  }

  return out;
}

export function toCsv(form: CalculatorForm, result: CalculatorResult): string {
  const sym = form.currency;
  const rows: [string, string | number][] = [
    ["Currency", sym],
    ["Price", form.price],
    ["Discount %", form.discountPct || 0],
    ["GST or VAT", form.gstMode],
    ["GST or VAT rate %", form.gstRatePct || 0],
    ["Fee %", form.feePct || 0],
    ["Fixed fee per sale", form.feeFixed || 0],
    ["Costs per order", form.costs || 0],
    ["Refund %", form.refundPct || 0],
    ["Upsell price", form.upsellPrice || 0],
    ["Upsell take %", form.upsellTakePct || 0],
    ["Upsell cost", form.upsellCost || 0],
    ["Ad spend", form.adSpend || 0],
    ["Sales from ads", form.orders || 0],
    ["Conversion rate %", form.conversionPct || ""],
    ["Customer pays per order", result.perOrder.customerPays.toFixed(2)],
    ["Tax in that", result.perOrder.gst.toFixed(2)],
    ["Fees per order", result.perOrder.fees.toFixed(2)],
    ["Contribution per order", result.perOrder.contribution.toFixed(2)],
    ["Break-even cost per sale", result.breakEven.cac?.toFixed(2) ?? "Not defined"],
    ["Break-even ROAS", result.breakEven.roas?.toFixed(2) ?? "Not defined"],
    ["Most you can pay per visit", result.breakEven.costPerVisit?.toFixed(2) ?? ""],
    ["Cost per sale this period", result.ads.cac?.toFixed(2) ?? "Not defined"],
    ["ROAS this period", result.ads.roas?.toFixed(2) ?? "Not defined"],
    ["After ads, this period", result.ads.contributionAfterAds.toFixed(2)],
    ["Sales needed to break even", result.ads.ordersToBreakEven ?? "Not defined"],
  ];
  const cell = (v: string | number) => {
    const s = String(v);
    // Quote everything and neutralise spreadsheet formulas.
    const formula = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s);
    return `"${(formula ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return [
    "Her Little Empire · Ads Profitability Calculator · estimates from your own numbers",
    ...rows.map(([k, v]) => `${cell(k)},${cell(v)}`),
  ].join("\n");
}

export function run(form: CalculatorForm) {
  const { input, errors } = toInput(form);
  if (!input) return { errors, result: null };
  return { errors, result: calculate(input) };
}
