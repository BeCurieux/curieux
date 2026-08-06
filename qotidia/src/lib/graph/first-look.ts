// The first ten minutes.
//
// A parent empties part of a camera roll into Qotidia and, within a minute,
// gets told something about their own family they had not put into words:
// that there is a blue rabbit in fourteen photographs, that Grandma turns up
// on Sundays, that the yellow boots started when she was fourteen months old.
// Nothing else the product does matters if this moment does not land, because
// this is where somebody decides whether it is an archivist or a folder.
//
// It is deliberately not the weekly note. The weekly note is about change,
// and change needs two windows to compare — a freshly backfilled year has no
// "this week" and never will. What a backfill has instead is *shape over a
// whole year*, which is the one thing a camera roll cannot show you and the
// one thing this reads out.
//
// Every line is still a count or a date. "Grandma turns up most Sundays" is
// arithmetic over dates the family recorded. "Florence adores her Grandma" is
// a claim about a child, and the moment this product starts making those it
// has stopped being an archive and started being an opinion.

import { ageWhen, daysBetween, type Entity } from "./presence";
import { gapsWorthAsking, monthOf, type Gap } from "./notice";

export interface FirstObservation {
  entityId: string;
  line: string;
  /** Every memory this was computed from. The provenance rule, applied here. */
  memoryIds: string[];
  weight: number;
}

export interface FirstLook {
  observations: FirstObservation[];
  /** Two or three, never more. A wall of questions is a form. */
  questions: Gap[];
  /** How much was uploaded, so the copy can be honest about how little. */
  memoryCount: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Enough of an archive for any of this to mean anything.
 *
 * Under this, a "pattern" is three photographs taken on one afternoon, and
 * announcing it would be the product performing insight rather than having
 * any. The screen says so plainly instead.
 */
export const ENOUGH_TO_NOTICE = 12;

/**
 * What share of appearances must land on one weekday to call it a habit.
 *
 * Was a half, which is not "most" and, at exactly four appearances, is two —
 * and two photographs on two Thursdays is a coincidence with a nice name.
 * Four-mention entities were duly promoted over the child's own words.
 */
const HABIT_SHARE = 0.6;

/** And how many appearances there must be before a share means anything. */
const HABIT_MINIMUM = 4;

/** However strong the share, this many on the day or it is not a routine. */
const HABIT_ON_THE_DAY = 3;

/**
 * The weekday an entity keeps landing on, if there is one.
 *
 * The observation behind "Grandma appears most Sundays", and one a parent
 * genuinely may not have put into words — Wednesday at Grandma's is a fact
 * about a life that nobody writes down because everybody involved already
 * knows it. Nobody will know it in thirty years.
 */
export function habitualDay(entity: Entity): { day: string; count: number } | null {
  const counts = new Map<number, number>();
  for (const m of entity.mentions) {
    const t = Date.parse(`${m.date}T00:00:00Z`);
    if (Number.isNaN(t)) continue;
    const d = new Date(t).getUTCDay();
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const dated = [...counts.values()].reduce((n, c) => n + c, 0);
  if (dated < HABIT_MINIMUM) return null;

  const [day, count] = [...counts.entries()].reduce((best, e) => (e[1] > best[1] ? e : best));
  if (count < HABIT_ON_THE_DAY || count / dated < HABIT_SHARE) return null;

  return { day: WEEKDAYS[day], count };
}

/** Whether an entity has been around long enough for its start to be a fact. */
const LONG_ENOUGH_DAYS = 120;

/**
 * First and last dates, and the span between them.
 *
 * presenceOf() answers this too, but only alongside a set of windows ending
 * "today" — and a backfilled year has no today worth comparing against. This
 * is the half of it that does not need one.
 */
function run(entity: Entity): { first: string | null; spanDays: number } {
  const dates = entity.mentions
    .map((m) => m.date)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) return { first: null, spanDays: 0 };
  return { first: dates[0], spanDays: daysBetween(dates[dates.length - 1], dates[0]) };
}

/**
 * "when she was" / "when they were".
 *
 * Absent a stated pronoun, they/them — and the verb has to follow it, or
 * every line reads as a mail merge. The dashboard already does this; a
 * sentence about a specific child should not be the one place that doesn't.
 */
function whenTheyWere(pronoun: string): string {
  if (pronoun.startsWith("he")) return "when he was";
  if (pronoun.startsWith("she")) return "when she was";
  return "when they were";
}

/**
 * How long after the archive's own first memory a thing has to appear before
 * we are willing to call that its beginning.
 *
 * The distinction the first version got wrong. If a rabbit is in the very
 * first photograph we hold, we do not know when the rabbit started — we know
 * when *our records* start, which is a fact about us and not about the child.
 * "Starting when she was fourteen months old" would be the product asserting
 * something it cannot see, which is the same failure as inventing a memory,
 * only harder to spot because it sounds like arithmetic.
 */
const CLEARLY_BEGAN_DAYS = 60;

function lineFor(
  entity: Entity,
  dateOfBirth: string | null,
  pronoun: string,
  archiveStart: string | null
): string {
  const n = entity.mentions.length;
  const p = run(entity);

  if (entity.kind === "person") {
    const habit = habitualDay(entity);
    if (habit) return `${entity.label} turns up most ${habit.day}s.`;
    return `${entity.label} is in ${n} of these.`;
  }

  if (entity.kind === "phrase") {
    return `“${entity.label}” — ${n} times.`;
  }

  // Something whose beginning the archive can actually see, anchored to how
  // old they were. This is the line a camera roll cannot produce: it needs
  // the archive to have worked out that a rabbit two years ago and a rabbit
  // last week are one rabbit.
  const began = p.first && archiveStart ? daysBetween(p.first, archiveStart) : 0;
  if (dateOfBirth && p.first && began >= CLEARLY_BEGAN_DAYS) {
    const age = ageWhen(dateOfBirth, p.first);
    if (age) return `${entity.label} — in ${n} of these, starting ${whenTheyWere(pronoun)} ${age}.`;
  }

  // Otherwise say the span, which is true either way: we know when we have
  // seen it, and we are not claiming that is when it began.
  if (p.first && p.spanDays >= LONG_ENOUGH_DAYS) {
    const last = [...entity.mentions].map((m) => m.date).sort().pop()!;
    return `${entity.label} — in ${n} of these, from ${monthOf(p.first, last)} to ${monthOf(last, last)}.`;
  }

  return `${entity.label} is in ${n} of these.`;
}

/**
 * How interesting an entity is to the person who lived it.
 *
 * Kind of observation first, volume only as a tie-break — the same ordering
 * the weekly note runs on, and for the same reason. Leading with the biggest
 * pile tells a parent what they already know: of course there are a lot of
 * photographs of the boots, they took them. Sundays at Grandma's is the one
 * nobody in the family has ever said out loud, because everybody involved
 * already knows it. Nobody will know it in thirty years.
 *
 * Bands rather than a sum, because a bonus added to a count is a bonus a
 * large enough count always beats — which is how this was written first, and
 * the twenty photographs of the boots duly buried the Sundays.
 */
function weigh(entity: Entity): number {
  const volume = Math.min(entity.mentions.length, 20);
  // Only where the sentence will actually say so. Awarding the habit band to
  // anything with a weekday pattern promoted entities whose line then read as
  // plain volume — the ranking and the sentence have to agree, or the best
  // slot on the page goes to the dullest thing on it.
  if (entity.kind === "person" && habitualDay(entity)) return 200 + volume;
  // The child's own words. Ranked above anything counted from photographs
  // because it is the one thing a camera roll holds none of — a parent can
  // scroll back and see the boots, and cannot scroll back and hear this.
  if (entity.kind === "phrase") return 150 + volume;
  if (run(entity).spanDays >= LONG_ENOUGH_DAYS) return 100 + volume;
  return volume;
}

export interface FirstLookInput {
  entities: Entity[];
  memoriesWithWords: Set<string>;
  memoryCount: number;
  dateOfBirth?: string | null;
  /** As the family stated it. Empty means they/them. */
  pronouns?: string | null;
  /**
   * The earliest memory in the whole archive.
   *
   * Needed to tell "this began here" from "our records begin here" — the
   * difference between an observation and a claim.
   */
  archiveStart?: string | null;
  max?: number;
  maxQuestions?: number;
}

/**
 * What we noticed, on first sight of an archive.
 *
 * Returns nothing when there is not enough to say — the same discipline the
 * weekly note runs on, and more important here: a first impression built out
 * of three photographs is a promise the product cannot keep in week two.
 */
export function firstLook(input: FirstLookInput): FirstLook {
  const max = input.max ?? 3;
  const dateOfBirth = input.dateOfBirth ?? null;

  if (input.memoryCount < ENOUGH_TO_NOTICE) {
    return { observations: [], questions: [], memoryCount: input.memoryCount };
  }

  const scored = input.entities
    .map((entity) => ({ entity, weight: weigh(entity) }))
    .sort((a, b) => b.weight - a.weight);

  const observations: FirstObservation[] = [];
  const spoken: string[][] = [];

  for (const { entity, weight } of scored) {
    if (observations.length >= max) break;

    // Never two lines about the same photographs. On a backfill this matters
    // more than anywhere else — the same afternoon carries a tag, a place and
    // three runs of a quote, and saying all of them is how a first impression
    // turns into noise.
    const ids = new Set(entity.mentions.map((m) => m.memoryId));
    const echo = spoken.some((prior) => {
      const shared = prior.filter((id) => ids.has(id)).length;
      return shared / Math.min(prior.length, ids.size) >= 0.7;
    });
    if (echo) continue;

    observations.push({
      entityId: entity.id,
      line: lineFor(entity, dateOfBirth, input.pronouns ?? "", input.archiveStart ?? null),
      memoryIds: [...ids],
      weight,
    });
    spoken.push([...ids]);
  }

  // Questions come from the same place they always do: people who are
  // everywhere in the photographs and nowhere in the words. Two or three,
  // because a first impression that opens with a form is not an impression.
  const questions = gapsWorthAsking({
    entities: input.entities,
    memoriesWithWords: input.memoriesWithWords,
    // A backfilled year is one upload, so the bar for "a lot of these" is
    // lower than it is for a year of drip-fed weeks.
    minAppearances: 4,
  }).slice(0, input.maxQuestions ?? 3);

  return { observations, questions, memoryCount: input.memoryCount };
}
