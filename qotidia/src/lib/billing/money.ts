// Money, and a second way of counting it.
//
// Two jobs, and they belong together because the second is only honest if it
// runs on the same numbers as the first.
//
// **Formatting.** There were four implementations of "cents to A$" — on the
// landing page, the pricing page, the billing settings and the checkout —
// and they had already drifted: two rounded, one truncated. Nothing had gone
// visibly wrong yet, which is the only reason it survived. One here.
//
// **Scale.** A hardcover book of a year of a child's life costs A$199, and
// A$199 is a real amount of money on the day you spend it. The honest way to
// make that feel proportionate is not a discount, a countdown or a struck-
// through price — it is arithmetic the reader can check, presented next to
// the thing it is arithmetic about.
//
// So everything below divides. Nothing here compares us to a competitor,
// invents a "value", or describes the price as small. It states what the
// number is per day and per year of keeping, and the page it feeds is
// required to also state the counterweight — that the plan which looks
// cheapest per day costs more across a year than buying once. A page that
// only divides is an advert.

// ------------------------------------------------------------ formatting

/** Whole dollars: A$199. For prices, which are always whole here. */
export function aud(cents: number): string {
  return `A$${Math.round(cents / 100)}`;
}

/**
 * Dollars and cents, dropping the cents when there are none: A$6.63, A$7.
 *
 * Used for derived figures, which are the only place fractions arise. A
 * derived figure printed as "A$6.6300000000000001" is the kind of thing that
 * makes a reader doubt the rest of the page.
 */
export function audExact(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `A$${dollars}` : `A$${dollars.toFixed(2)}`;
}

/** Under a dollar reads better in cents: 62c. Above it, as dollars. */
export function small(cents: number): string {
  const c = Math.round(cents);
  return c < 100 ? `${c}c` : audExact(c);
}

// -------------------------------------------------- another way to count

/**
 * The average length of a month, in days.
 *
 * 365.25/12 rather than 30, because a monthly price divided by 30 overstates
 * the daily cost by about two per cent, and a figure that flatters us by
 * accident is still a figure that flatters us.
 */
const DAYS_IN_A_MONTH = 365.25 / 12;

/** What a monthly price works out at per day, in cents. */
export function aDay(centsAMonth: number): number {
  return Math.round(centsAMonth / DAYS_IN_A_MONTH);
}

/**
 * How long a book is kept, for the purpose of the second sum.
 *
 * Thirty years, because that is the promise the landing page already makes —
 * "one book you'll still have when they're thirty" — and a marketing page
 * that quietly assumes a different number than the one beside it is doing
 * something worse than exaggerating.
 *
 * It is a statement of what the object is for, not a guarantee. Nothing in
 * the product depends on it; only this sentence does.
 */
export const YEARS_A_BOOK_IS_KEPT = 30;

/** What a book costs per year, if it is kept that long. In cents. */
export function aYearOfKeeping(
  bookCents: number,
  years = YEARS_A_BOOK_IS_KEPT
): number {
  if (years <= 0) return bookCents;
  return Math.round(bookCents / years);
}

/**
 * What a year on the monthly plan costs against buying the book once.
 *
 * Positive means monthly costs more, which it does — deliberately, because
 * monthly is a financing convenience and a live service for the eleven
 * months a one-off customer gets nothing.
 *
 * This exists so the page cannot show the per-day figure without being able
 * to show its counterweight from the same module. See plans.ts, which sets
 * the policy this reports on.
 */
export function moreThanBuyingOnce(
  centsAMonth: number,
  oneOffCents: number
): number {
  return centsAMonth * 12 - oneOffCents;
}
