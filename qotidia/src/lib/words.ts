// Small humane formatters.
//
// The difference between an archive and a database, on screen, is mostly
// this: "2028-03-14" is a record, "14 March" is a day something happened.
// The parent is looking at their own child's year; it should not read back
// to them in ISO 8601.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A date as a person would say it. The year is dropped when it is the
 * current one, because nobody says "the fourteenth of March, 2028" about
 * something that happened this year.
 */
export function friendlyDate(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  return d.getFullYear() === now.getFullYear()
    ? `${day} ${month}`
    : `${day} ${month} ${d.getFullYear()}`;
}

/** Just the month, for grouping. */
export function monthName(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : MONTHS[d.getMonth()];
}

const SMALL = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
];

/**
 * Small numbers as words, larger ones as digits — the ordinary typographic
 * convention, and it stops copy reading like a dashboard metric.
 */
export function spell(n: number): string {
  return n >= 0 && n < SMALL.length ? SMALL[n] : String(n);
}

/** "one thing" / "four things" / "213 things" */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${spell(n)} ${n === 1 ? singular : plural}`;
}
