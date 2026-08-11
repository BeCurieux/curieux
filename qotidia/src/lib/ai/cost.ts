// What the model costs, and the ceiling it may not go through.
//
// Two jobs, and the second is the one that matters at three in the morning.
//
//   **Know what it costs.** A product whose margin depends on an API bill
//   nobody measures is a product whose margin is a guess. This is per family
//   as well as in total, because the number that decides whether A$19 a month
//   works is the cost of one family's year, not the cost of last Tuesday.
//
//   **Stop before it costs too much.** Logging alone is a smoke alarm with no
//   batteries: it tells you afterwards. A retry loop that re-analyses the
//   same four hundred photographs, or one family uploading a hundred
//   thousand images, is a bill nobody agreed to — and the honest version of
//   this product refuses rather than absorbing it silently and then
//   discovering it cannot afford the printing.
//
// ## Failing expensive, not free
//
// The one design decision worth arguing about. If AI_MODEL is set to
// something this table has never heard of, the cost must not read as zero.
// Zero is the number that makes every ceiling infinite and every dashboard
// green, and it arrives by changing one environment variable.
//
// So an unknown model is priced at UNKNOWN_MODEL, which is deliberately
// higher than anything we would actually run. The failure mode of being too
// expensive is a ceiling that stops early and somebody investigating. The
// failure mode of being free is a bill.
//
// ## Prices are a fact about the world, not about this codebase
//
// They change, and they are not ours to assert. PRICES is a default that
// must be checked against the provider's current pricing before it is
// trusted, and every entry can be overridden from the environment. A test
// asserts they are all non-zero — which is the only property this file can
// honestly guarantee about them.

/**
 * Micro-cents, so nothing here ever meets a floating-point rounding error.
 * A hundred thousand micro-cents is one dollar.
 */
export const PER_DOLLAR = 100_000;

export interface Price {
  /** Micro-cents per million input tokens. */
  inPerM: number;
  /** Micro-cents per million output tokens. */
  outPerM: number;
}

const dollars = (n: number) => Math.round(n * PER_DOLLAR);

/**
 * Per-million-token prices, as at the time of writing.
 *
 * CHECK THESE against the provider's pricing page before relying on the
 * numbers they produce. They are a starting point and a shape, not a
 * quotation, and they are overridable so that correcting them never needs a
 * deploy.
 */
export const PRICES: Record<string, Price> = {
  "claude-opus-4-5": { inPerM: dollars(5), outPerM: dollars(25) },
  "claude-sonnet-5": { inPerM: dollars(3), outPerM: dollars(15) },
  "claude-haiku-4-5": { inPerM: dollars(1), outPerM: dollars(5) },
};

/**
 * What a model we have never heard of is assumed to cost.
 *
 * High on purpose. See the note at the top: a model that is not in the table
 * must not be free, because free makes every ceiling infinite and arrives by
 * changing one environment variable.
 */
export const UNKNOWN_MODEL: Price = { inPerM: dollars(30), outPerM: dollars(150) };

export function priceOf(model: string): Price {
  const override = process.env[`AI_PRICE_${model.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  if (override) {
    const [inPerM, outPerM] = override.split("/").map((n) => Number(n));
    if (Number.isFinite(inPerM) && Number.isFinite(outPerM)) return { inPerM, outPerM };
  }
  return PRICES[model] ?? UNKNOWN_MODEL;
}

/** What one call cost, in micro-cents. Rounded up, so it is never flattering. */
export function costOf(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceOf(model);
  const input = Math.max(0, inputTokens);
  const output = Math.max(0, outputTokens);
  return Math.ceil((input * price.inPerM + output * price.outPerM) / 1_000_000);
}

/** Micro-cents as money, for a page a person reads. */
export function asMoney(microCents: number): string {
  // Nothing is not "under 1c". The empty dashboard read as though a
  // fraction of a cent had been spent, which is a different claim from no
  // model having been called at all.
  if (microCents <= 0) return "nothing";
  const dollarsValue = microCents / PER_DOLLAR;
  if (dollarsValue >= 1) return `A$${dollarsValue.toFixed(2)}`;
  if (dollarsValue >= 0.01) return `${(dollarsValue * 100).toFixed(1)}c`;
  return "under 1c";
}

// ------------------------------------------------------------- the ceilings

/**
 * What one family's AI may cost in a month.
 *
 * A$2. Set against the plan rather than plucked out of the air: a monthly
 * member pays A$19 and a one-off pays A$199 for a year, so a couple of
 * dollars a month of model time leaves the margin the printing needs. A
 * family who genuinely wants more is a conversation, not a silent overrun —
 * and in practice nothing legitimate gets near it, because the archive reads
 * words rather than photographs.
 */
export const FAMILY_MONTHLY = dollars(2);

/**
 * What everybody's AI may cost in a day.
 *
 * The backstop for the failure the per-family ceiling cannot see: a loop, a
 * retry storm, a bad deploy. It is set to something a solo founder can
 * absorb once while working out what happened.
 */
export const EVERYBODY_DAILY = dollars(20);

/** Say something at four fifths, while there is still time to act. */
export const WARN_AT = 0.8;

export type Refusal = "family over budget" | "everybody over budget";

export interface Budget {
  familyMonth: number;
  everybodyToday: number;
}

export interface Allowed {
  ok: boolean;
  because?: Refusal;
  /** True when this is the call that tips a family into the warning. */
  warn: boolean;
}

/**
 * Whether another call may be made.
 *
 * Both ceilings, and the global one is checked first: when everything is on
 * fire, "which family" is not the interesting question.
 */
export function mayCall(budget: Budget): Allowed {
  if (budget.everybodyToday >= EVERYBODY_DAILY) {
    return { ok: false, because: "everybody over budget", warn: true };
  }
  if (budget.familyMonth >= FAMILY_MONTHLY) {
    return { ok: false, because: "family over budget", warn: true };
  }
  return { ok: true, warn: budget.familyMonth >= FAMILY_MONTHLY * WARN_AT };
}

/**
 * What is never written to the cost log.
 *
 * The same discipline as the analytics table, for a different reason: this
 * one legitimately knows which family a call was for, because cost is an
 * operational fact about an account in the way storage_bytes already is.
 * What it must never know is what was said. A cost log that kept prompts
 * would be a second copy of the archive, held for accounting.
 */
export const NEVER_LOGGED = [
  "the prompt",
  "the model’s reply",
  "any memory text, quote or transcript",
  "a child’s name",
  "photographs, or anything derived from one",
] as const;
