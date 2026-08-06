// The book, as it stands today.
//
// The annual should not appear in December like a surprise. A family that
// can watch it assemble — three photographs of the yellow boots becoming a
// chapter about the yellow boots, some time around August — has a reason to
// open the product in the eleven months when there is no book to make, and
// that is the entire subscription case.
//
// Two rules make this honest rather than a progress bar.
//
// **It is a projection, not a book.** Nothing here writes a row, calls a
// model or reserves a page. Generating the artefact early would mean the
// finished book is a thing the family has already read, and the whole point
// is that it is not finished. This reads the archive and works out what the
// real generator would do with it today.
//
// **It uses the real thresholds.** Every "one more and it's a chapter" here
// is the actual number proposeStructure() applies, imported rather than
// restated — because a screen that promises a chapter at three and a
// generator that wants four is a screen that lies to somebody for a month.

import type { LittleThing, Memory, MemoryCluster, SectionDraft, Subject } from "@/lib/types";
import { proposeStructure, type StructureInput } from "./structure";
import { configFor } from "@/lib/subjects/config";

/**
 * The thresholds the generator actually applies.
 *
 * Stated once, here, and read by both the projection and its tests. They are
 * duplicated from proposeStructure only in the sense that a constant is
 * duplicated from the place it is used: if these drift, the screen starts
 * promising chapters that never arrive.
 */
export const BECOMES_A_CHAPTER = {
  /** Memories in a confirmed cluster, before it is worth a chapter. */
  cluster: 3,
  /** Quotes, before "Things you said" exists. */
  quotes: 3,
  /** Little things, before that chapter exists. */
  littleThings: 3,
  /** Memories with people in them, before "Your people" exists. */
  people: 3,
  /** Unclaimed photographs, before "Ordinary days" exists. */
  ordinary: 4,
} as const;

export interface FormedChapter {
  title: string;
  sectionType: string;
  /** How many things are in it. Zero for chapters built from little things. */
  count: number;
}

export interface FormingChapter {
  title: string;
  /** What it has now. */
  count: number;
  /** What it needs. Always at least one, or it would not be forming. */
  needs: number;
  /**
   * Why it is not a chapter yet, in the family's terms.
   *
   * Never "below threshold". A person reading this should learn what to do,
   * and in most cases the answer is genuinely "nothing, keep going".
   */
  note: string;
}

export interface EmptyStretch {
  /** ISO month, e.g. "2026-03". */
  month: string;
  label: string;
}

export interface BookSoFar {
  title: string;
  subtitle?: string;
  chapters: FormedChapter[];
  forming: FormingChapter[];
  /** Months inside the period with nothing in them at all. */
  quiet: EmptyStretch[];
  /** Everything kept for this period. */
  kept: number;
  /** True when there is not yet enough for the book to have a shape. */
  tooEarly: boolean;
}

/**
 * Enough for a table of contents to mean anything.
 *
 * Below this the honest answer is that the book has not started, and saying
 * so plainly beats showing a page of empty promises — which is exactly the
 * shape a progress bar would take.
 */
export const A_BOOK_HAS_A_SHAPE = 15;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface SoFarInput extends StructureInput {
  /** Clusters our side has proposed but nobody has confirmed. */
  suggestedClusters?: MemoryCluster[];
  /** The period the book covers, so quiet months can be named. */
  periodStart?: string | null;
  periodEnd?: string | null;
  /** Today, so a month that has not happened is not called quiet. */
  today?: string;
}

/**
 * What the book looks like right now, and what is nearly in it.
 *
 * The forming list is the part that earns the screen. A finished contents
 * page is pleasant; "Swimming — 2 things. One more and it's a chapter" is
 * the sentence that makes somebody open their camera roll.
 */
export function bookSoFar(input: SoFarInput): BookSoFar {
  const structure = proposeStructure(input);
  const config = configFor(input.subject.subject_type);

  const chapters: FormedChapter[] = structure.sections
    // The bookends are always there and are not news. A contents page that
    // opens with "Chapter one: the opening" is a contents page nobody reads.
    .filter((s) => s.section_type !== "opening" && s.section_type !== "closing")
    .map((s: SectionDraft) => ({
      title: s.title,
      sectionType: s.section_type,
      count: s.memory_ids.length,
    }));

  return {
    title: structure.title,
    subtitle: structure.subtitle,
    chapters,
    forming: forming(input, structure.sections, config.noun),
    quiet: quietMonths(input),
    kept: input.memories.length,
    tooEarly: input.memories.length < A_BOOK_HAS_A_SHAPE,
  };
}

/** Everything that is nearly a chapter, best first. */
function forming(input: SoFarInput, sections: SectionDraft[], noun: string): FormingChapter[] {
  const out: FormingChapter[] = [];
  const already = new Set(sections.map((s) => s.title));

  // Clusters, confirmed and suggested alike. A suggested one is our guess at
  // a thread; saying so is more useful than hiding it, because the family can
  // confirm it and turn it into a chapter today.
  const candidates = [...input.clusters, ...(input.suggestedClusters ?? [])];
  for (const cluster of candidates) {
    if (already.has(cluster.title)) continue;
    const count = cluster.memory_ids.length;
    if (count === 0) continue;

    if (cluster.status !== "confirmed") {
      out.push({
        title: cluster.title,
        count,
        needs: 0,
        note:
          count >= BECOMES_A_CHAPTER.cluster
            ? "We think this is a thread. Say yes and it's a chapter."
            : `We think this is a thread. ${BECOMES_A_CHAPTER.cluster - count} more and it's a chapter.`,
      });
      continue;
    }

    const needs = BECOMES_A_CHAPTER.cluster - count;
    if (needs > 0) {
      out.push({
        title: cluster.title,
        count,
        needs,
        note: needs === 1 ? "One more and it's a chapter." : `${needs} more and it's a chapter.`,
      });
    }
  }

  const near = (
    title: string,
    count: number,
    threshold: number,
    note: (needs: number) => string
  ) => {
    if (already.has(title) || count === 0 || count >= threshold) return;
    out.push({ title, count, needs: threshold - count, note: note(threshold - count) });
  };

  near("Things you said", input.quotes.length, BECOMES_A_CHAPTER.quotes, (n) =>
    n === 1 ? "One more quote and it's a chapter." : `${n} more quotes and it's a chapter.`
  );

  near("The little things", input.littleThings.length, BECOMES_A_CHAPTER.littleThings, (n) =>
    n === 1 ? "One more and it's a chapter." : `${n} more and it's a chapter.`
  );

  const withPeople = input.memories.filter((m) => (m.people?.length ?? 0) > 0).length;
  near("Your people", withPeople, BECOMES_A_CHAPTER.people, () =>
    `Name who's in a couple more photographs and this becomes a chapter about the ${noun}'s people.`
  );

  // Most-formed first: the one closest to becoming real is the one worth
  // reading, and it is usually the one somebody can finish this afternoon.
  return out.sort((a, b) => a.needs - b.needs || b.count - a.count);
}

/**
 * Months inside the period with nothing in them.
 *
 * Shown because a year with a hole in it is a book with a hole in it, and
 * because this is one of the few things a family can still fix — a March
 * with nothing is usually a March that was photographed and never emptied
 * out of a phone, not a March that did not happen.
 *
 * Never includes a month that has not finished. Telling somebody they have
 * been quiet in a month they are still living in is the product not paying
 * attention.
 */
function quietMonths(input: SoFarInput): EmptyStretch[] {
  if (!input.periodStart || !input.periodEnd) return [];

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const seen = new Set(
    input.memories
      .map((m) => m.memory_date?.slice(0, 7))
      .filter(Boolean) as string[]
  );

  const out: EmptyStretch[] = [];
  const start = new Date(`${input.periodStart.slice(0, 7)}-01T00:00:00Z`);
  const last = new Date(`${input.periodEnd.slice(0, 7)}-01T00:00:00Z`);
  const thisMonth = today.slice(0, 7);

  for (let d = start; d <= last; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const month = d.toISOString().slice(0, 7);
    if (month >= thisMonth) break; // still being lived in
    if (seen.has(month)) continue;
    out.push({
      month,
      label: `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
    });
  }

  return out;
}
