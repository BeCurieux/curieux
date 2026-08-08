// Money.
//
// There were four implementations of "cents to A$" — on the landing page,
// the pricing page, the billing settings and the checkout — and they had
// already drifted: two rounded, one truncated. Nothing had gone visibly
// wrong yet, which is the only reason it survived. One here.
//
// This module used to carry a second half: a set of functions for dividing
// the price into smaller ones — per day, per year of keeping — with a long
// argument about how to do that honestly. The argument was sound and the
// device was still wrong. A page that prints "about 62c a day" is doing it
// for exactly one reason, and a reader can tell. It was deleted along with
// the section of the pricing page that used it.
//
// What remains of that idea, and the only part worth keeping: where a plan
// costs more over a year than buying once, the page says so in plain words,
// computed from the real prices. See planCopy() in plans.ts, which builds
// that sentence and is tested.

/** Whole dollars: A$199. Prices in this product are always whole. */
export function aud(cents: number): string {
  return `A$${Math.round(cents / 100)}`;
}
