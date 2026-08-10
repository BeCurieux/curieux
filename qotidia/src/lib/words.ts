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

/**
 * Two dates as one range.
 *
 * Exists because friendlyDate drops the year for the current one, and a
 * range that crosses new year therefore printed "19 August 2025 – 17 May" —
 * two different formats in a single line. Either both ends carry a year or
 * neither does, decided by whether they share one.
 */
export function dateRange(
  from: string | Date,
  to: string | Date,
  now: Date = new Date()
): string {
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";

  const sameDay = a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  if (sameDay) return friendlyDate(a, now);

  // A range spanning two calendar years needs the year on both ends. Forcing
  // `now` to a year neither end shares is how both get one.
  const straddles = a.getFullYear() !== b.getFullYear();
  const clock = straddles ? new Date(Date.UTC(a.getFullYear() - 1, 0, 1)) : now;
  return `${friendlyDate(a, clock)} \u2013 ${friendlyDate(b, clock)}`;
}

/**
 * A set of dates shown side by side, formatted consistently.
 *
 * The same fault dateRange exists to fix, one dimension further out. A grid
 * of thumbnails under an observation printed "27 November 2025", "1 January",
 * "12 February" — three captions in a row, two of them missing the year,
 * because friendlyDate drops it for the current one and half the evidence
 * happened to fall this side of new year. Read as a set, it looks like a
 * formatting bug rather than a list of days.
 *
 * So: either they all carry a year or none do, decided by whether they all
 * fall in the same one — and if that year is this year, none do.
 */
export function dateList(
  values: (string | Date | null | undefined)[],
  now: Date = new Date()
): string[] {
  const years = new Set<number>();
  for (const v of values) {
    if (!v) continue;
    const d = v instanceof Date ? v : new Date(v);
    if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
  }

  // More than one year in the set means every caption needs one. Forcing the
  // clock to a year none of them shares is how they all get it — the same
  // trick as dateRange, for the same reason.
  const clock = years.size > 1 ? new Date(Date.UTC(Math.min(...years) - 1, 0, 1)) : now;
  return values.map((v) => friendlyDate(v, clock));
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
