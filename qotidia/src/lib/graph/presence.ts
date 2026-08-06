// What comes and goes in a family's life.
//
// The archive already knows *that* things happened. This is the layer that
// knows how they moved: that Bun Bun was everywhere at two, went to France
// at three, and had mostly gone by four. That shape is the compounding
// asset — a photograph is replaceable, six years of knowing which rabbit
// mattered is not.
//
// Three rules govern the whole module.
//
// **Only what the family recorded.** An entity exists because someone tagged
// it, named a person, wrote a word, or confirmed a cluster. Nothing here
// infers a person from a face or a place from a background. The privacy
// brief said not to build face recognition unless we actually need it, and
// an entity model assembled from what people typed is both sufficient and
// the version a parent would be comfortable reading about.
//
// **Count, never interpret.** "The dinosaur hat, four times this week" is a
// fact about the archive. "Florence loves the dinosaur hat" is a claim about
// a child, and we do not get to make those. Every observation this produces
// is arithmetic over things the family put there, and carries the memory ids
// it was computed from — the same provenance rule the book runs on.
//
// **Absence is data.** Half the value is in what stopped. A thing that was
// everywhere and is now gone is the single most affecting thing this can
// notice, and it is invisible to anything that only looks at what is there.

export type EntityKind = "person" | "thing" | "place" | "phrase" | "ritual";

export interface Mention {
  memoryId: string;
  /** ISO date. Undated memories cannot contribute to a shape. */
  date: string;
}

export interface Entity {
  id: string;
  kind: EntityKind;
  /** As the family wrote it. Never our paraphrase. */
  label: string;
  mentions: Mention[];
}

// ------------------------------------------------------------------ time

const DAY = 86_400_000;

const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Whole days between two ISO dates. Negative when a is before b. */
export function daysBetween(a: string, b: string): number {
  return Math.round((at(a) - at(b)) / DAY);
}

function sorted(mentions: Mention[]): Mention[] {
  return [...mentions]
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date))
    .sort((x, y) => x.date.localeCompare(y.date));
}

// -------------------------------------------------------------- presence

export interface Presence {
  first: string | null;
  last: string | null;
  total: number;
  /** Mentions inside the window ending today. */
  recent: number;
  /** Mentions in the window before that one, for comparison. */
  previous: number;
  /** Days since the most recent mention. */
  daysSinceLast: number | null;
  /** Days between the first two mentions and the last two — i.e. is it speeding up. */
  spanDays: number;
}

/**
 * How much of an entity there is, now versus before.
 *
 * Two equal windows rather than a trend line. A trend over sixty memories a
 * year is noise dressed as signal; "more this fortnight than last" is a
 * thing a person can check against their own recollection, which is the
 * only test that matters here.
 */
export function presenceOf(entity: Entity, today: string, windowDays = 7): Presence {
  const ms = sorted(entity.mentions);
  if (ms.length === 0) {
    return { first: null, last: null, total: 0, recent: 0, previous: 0, daysSinceLast: null, spanDays: 0 };
  }

  const first = ms[0].date;
  const last = ms[ms.length - 1].date;

  const inWindow = (m: Mention, from: number, to: number) => {
    const age = daysBetween(today, m.date);
    return age >= from && age < to;
  };

  return {
    first,
    last,
    total: ms.length,
    recent: ms.filter((m) => inWindow(m, 0, windowDays)).length,
    previous: ms.filter((m) => inWindow(m, windowDays, windowDays * 2)).length,
    daysSinceLast: daysBetween(today, last),
    spanDays: daysBetween(last, first),
  };
}

// ----------------------------------------------------------------- shape

export type Shape =
  /** Showed up for the first time, in the window. */
  | "arrived"
  /** Back after a long absence. */
  | "returned"
  /** Noticeably more of it than the window before. */
  | "surging"
  /** Was a fixture, and has not appeared for a long time. */
  | "faded"
  /** Present, unremarkably. */
  | "steady"
  /** Nothing in either window. */
  | "quiet";

/** A gap this long, then a reappearance, is a return rather than a rhythm. */
export const RETURN_AFTER_DAYS = 60;

/** Below this many total mentions, an entity has no shape worth reporting. */
export const ESTABLISHED_AT = 4;

/** A fixture that has been silent this long has faded. */
export const FADED_AFTER_DAYS = 90;

/**
 * The one word for what this entity is doing.
 *
 * Ordered by how much it would surprise the person who lived it, because
 * that is what makes the difference between a product that is paying
 * attention and a product that is counting.
 */
export function shapeOf(entity: Entity, today: string, windowDays = 7): Shape {
  const p = presenceOf(entity, today, windowDays);
  if (p.total === 0) return "quiet";

  const ms = sorted(entity.mentions);
  const appearedNow = p.recent > 0;

  // First ever appearance, and it is in this window.
  if (appearedNow && p.total === p.recent) return "arrived";

  if (appearedNow) {
    // The gap immediately before the recent run.
    const before = ms.filter((m) => daysBetween(today, m.date) >= windowDays);
    if (before.length > 0) {
      const gap = daysBetween(ms[ms.length - p.recent].date, before[before.length - 1].date);
      if (gap >= RETURN_AFTER_DAYS) return "returned";
    }
    // Meaningfully more than the window before. Doubling rather than +1, so
    // two mentions against one is not announced as a surge.
    if (p.previous > 0 && p.recent >= p.previous * 2 && p.recent >= 3) return "surging";
    if (p.previous === 0 && p.recent >= 3) return "surging";
    return "steady";
  }

  if (p.total >= ESTABLISHED_AT && (p.daysSinceLast ?? 0) >= FADED_AFTER_DAYS) return "faded";
  return "quiet";
}

// ------------------------------------------------------------ the shelf

export interface YearPresence {
  yearNumber: number;
  count: number;
}

/**
 * An entity across the years of a life, which is the thing no camera roll
 * can answer: "when was the rabbit?"
 *
 * Keyed by year of life rather than calendar year, because that is how a
 * parent remembers it and how the books are numbered.
 */
export function byYearOfLife(
  entity: Entity,
  dateOfBirth: string
): YearPresence[] {
  const counts = new Map<number, number>();
  for (const m of sorted(entity.mentions)) {
    const days = daysBetween(m.date, dateOfBirth);
    if (days < 0) continue; // before they were born; a wrong date, not a memory
    const yearNumber = Math.floor(days / 365.25) + 1;
    counts.set(yearNumber, (counts.get(yearNumber) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([yearNumber, count]) => ({ yearNumber, count }))
    .sort((a, b) => a.yearNumber - b.yearNumber);
}

/** The year of life an entity mattered most. Null when it never really did. */
export function peakYear(entity: Entity, dateOfBirth: string): YearPresence | null {
  const years = byYearOfLife(entity, dateOfBirth);
  if (years.length === 0) return null;
  return years.reduce((best, y) => (y.count > best.count ? y : best));
}

/**
 * The silence immediately before an entity came back.
 *
 * Not the same as the span from first to last mention, which is what a first
 * pass at this reached for and is a different number entirely: a rabbit
 * mentioned across three years has a span of three years and may have been
 * absent for two months. The line "back after two months" is only true if it
 * is measuring the gap.
 *
 * Returns null when there is nothing recent, or nothing before it.
 */
export function gapBeforeReturn(entity: Entity, today: string, windowDays = 7): number | null {
  const ms = sorted(entity.mentions);
  const recent = ms.filter((m) => daysBetween(today, m.date) < windowDays);
  const before = ms.filter((m) => daysBetween(today, m.date) >= windowDays);
  if (recent.length === 0 || before.length === 0) return null;
  return daysBetween(recent[0].date, before[before.length - 1].date);
}
