// Nanna & Me.
//
// The first book that is not a year. A family archive that knows who Nanna
// is — because somebody told it, on the who's-who page — can be asked a
// question no photo library can answer: *show me the whole of these two
// together*. Five years of Thursdays, in one volume, made from memories that
// are already sitting in five different annual books.
//
// This is where the entity work pays for itself. Before resolutions the
// question was unanswerable: "Margaret" and "Maggie" were two words and the
// book would have contained half of it. It is also the reason the archive
// belongs to the family rather than to a child — the same afternoon is a
// page in Florence's year and a page in this.
//
// The judgement here is not "can we build it" — a query can always run. It
// is *should we offer it*, and three rules decide, all of them about not
// selling somebody a disappointment.
//
//   **It has to be more than a chapter.** If every memory of Nanna sits
//   inside a single year, this book is a subset of a book they already have.
//   The whole distinguishing claim is longitudinal, so a relationship that
//   has not yet crossed years is not offered — it will be, next year.
//
//   **It has to have words in it.** Thirty photographs of a grandmother with
//   nothing written about any of them is a photo dump with a hard cover,
//   which is precisely what the product says it is not. A relationship book
//   leans harder on this than an annual one, because it has no chronology to
//   carry it.
//
//   **The person has to be confirmed.** Only entities the family has
//   resolved, or that arrived as a named family member, are offered. Guessing
//   a relationship into existence and then printing it is the worst version
//   of this feature.

import type { Entity } from "@/lib/graph/presence";
import { daysBetween } from "@/lib/graph/presence";

/**
 * Enough for a relationship book.
 *
 * Lower than the 25 an annual volume needs, and deliberately. A year has to
 * account for itself — twelve months of a child's life with twenty pages in
 * it is a year badly kept. A relationship is whatever it is: eighteen real
 * moments with a grandmother across four years is a book worth having, and
 * the alternative is refusing to make it because a rule written for a
 * different kind of book said no.
 */
export const ENOUGH_FOR_A_PERSON = 18;

/**
 * How far apart the first and last have to be.
 *
 * Eighteen months, so it has certainly crossed a book year. Below this
 * everything in it is already in one annual volume, and selling the same
 * pages twice is not a second product.
 */
export const MUST_SPAN_DAYS = 548;

/**
 * How much of it has to have been written about.
 *
 * A third. Not a majority — most photographs in any archive have nothing
 * written on them, and demanding otherwise would offer this to nobody. But a
 * book with nothing said in it cannot be the thing this product claims to
 * make.
 */
export const MUST_HAVE_WORDS = 1 / 3;

export interface PersonStory {
  /** The resolved entity's id. Durable — see lib/graph/identity-store. */
  entityId: string;
  /** As the family calls them. Never our tidy-up. */
  personLabel: string;
  /** As it will be printed on the cover. */
  title: string;
  /** What it is, in facts rather than adjectives. */
  subtitle: string;
  memoryIds: string[];
  firstDate: string;
  lastDate: string;
  spanDays: number;
  /** How many carry any writing at all. */
  withWords: number;
  ready: boolean;
  /**
   * Why not, in the family's terms. Null when it is ready.
   *
   * Shown on the picker, because "not yet" without a reason reads as the
   * product being broken.
   */
  notYet: string | null;
}

const asDate = (m: { date: string }) => m.date;

/**
 * The title, in the child's voice.
 *
 * The books address the child — "This was you at two", "You lived in the
 * grey house". So the cover is theirs too: Nanna & Me, not "Florence and
 * Margaret", which is how a registry office would put it.
 */
export function titleFor(personLabel: string): string {
  return `${personLabel} & Me`;
}

/** Years touched, as a plain range. "2024–2028", or "2028" for one. */
function yearsIn(first: string, last: string): string {
  const a = first.slice(0, 4);
  const b = last.slice(0, 4);
  return a === b ? a : `${a}–${b}`;
}

export interface PersonStoryInput {
  person: Entity;
  /** Memory ids that carry any writing. From memoriesWithWords(). */
  wordy: Set<string>;
  /** True when the family confirmed who this is, or named them themselves. */
  confirmed: boolean;
}

/**
 * Whether a person is a book, and what it would be called.
 *
 * Returns a story either way. A caller showing a picker needs to know what
 * is nearly ready as much as what is ready — "one more year and this is a
 * book" is a reason to keep going, and hiding it is how a feature stays
 * invisible until somebody stumbles on it.
 */
export function personStory(input: PersonStoryInput): PersonStory | null {
  const { person, wordy, confirmed } = input;
  if (person.kind !== "person") return null;

  const dated = person.mentions
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date))
    .sort((a, b) => asDate(a).localeCompare(asDate(b)));
  if (dated.length === 0) return null;

  const memoryIds = [...new Set(dated.map((m) => m.memoryId))];
  const firstDate = dated[0].date;
  const lastDate = dated[dated.length - 1].date;
  const spanDays = daysBetween(lastDate, firstDate);
  const withWords = memoryIds.filter((id) => wordy.has(id)).length;

  // Reported in the order a person would hit them, so the reason given is
  // the one they can most readily act on.
  let notYet: string | null = null;
  if (!confirmed) {
    notYet = "Tell us who this is first, and we can make it.";
  } else if (memoryIds.length < ENOUGH_FOR_A_PERSON) {
    const more = ENOUGH_FOR_A_PERSON - memoryIds.length;
    notYet = `About ${more} more moment${more === 1 ? "" : "s"} together and there's a book here.`;
  } else if (spanDays < MUST_SPAN_DAYS) {
    notYet =
      "So far this is all within one year, so it's already in that year's " +
      "book. Give it another year and it becomes its own.";
  } else if (withWords < memoryIds.length * MUST_HAVE_WORDS) {
    notYet =
      "Plenty of photographs, but almost nothing written down yet. A book " +
      "about a person needs a few of the stories.";
  }

  return {
    entityId: person.id,
    personLabel: person.label,
    title: titleFor(person.label),
    subtitle: `${memoryIds.length} moments together, ${yearsIn(firstDate, lastDate)}`,
    memoryIds,
    firstDate,
    lastDate,
    spanDays,
    withWords,
    ready: notYet === null,
    notYet,
  };
}

/**
 * Every person in this archive who is, or is nearly, a book.
 *
 * Ready ones first, then the nearly ones by how close they are — which is
 * the order somebody scanning the page cares about.
 */
export function peopleWorthABook(
  people: Entity[],
  wordy: Set<string>,
  confirmedIds: Set<string>
): PersonStory[] {
  return people
    .map((p) => personStory({ person: p, wordy, confirmed: confirmedIds.has(p.id) }))
    .filter((s): s is PersonStory => s !== null)
    .sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      return b.memoryIds.length - a.memoryIds.length;
    });
}
