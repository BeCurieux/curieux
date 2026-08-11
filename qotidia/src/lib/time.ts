// What day it is, where the family lives.
//
// Its own module, with no imports, because everything that reasons about
// dates needs it and some of those things sit underneath the database layer.
// It used to live next to the look-back, which meant the demo fixture could
// not reach it without a cycle — so the fixture built its dates in UTC while
// the product read them in Sydney, and for the ten hours a day those two
// disagree the fixture was off by one. A hat photographed four times read as
// three, in the evening only.

/** Today where the family lives, not where the server is. */
export function todayIso(now: Date = new Date(), timeZone = "Australia/Sydney"): string {
  // en-CA renders ISO order, which is the one formatting shortcut here that
  // is not a hack: it is the documented output for that locale.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * A date some number of days from an ISO one.
 *
 * Arithmetic at UTC midnight, which is safe precisely because both ends are
 * already plain dates: no clock, no daylight saving, nothing to shift.
 */
export function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
