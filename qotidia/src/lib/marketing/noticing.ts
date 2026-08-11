// What the product would say, said by the product.
//
// The landing page describes Qotidia and never demonstrates it. The single
// most distinctive thing here is not a layout or a colour, it is a sentence:
// *Bun Bun hasn't appeared since April.* Nothing else in this category can
// produce that, and until now a visitor had to take our word for it.
//
// So the page runs the real thing. These observations come out of
// noticeThisWeek() — the same function the weekly note calls, with the same
// thresholds, the same ranking and the same refusal to interpret. Nothing
// below is a string a copywriter chose. If the engine changes its mind about
// what is worth mentioning, the landing page changes with it, which is the
// point: a marketing claim that cannot drift from the product.
//
// Two rules this is held to, and they are not negotiable.
//
// **It is a fixture, and it says so.** Florence is the fictional family in
// the seed — a made-up two-year-old with a made-up rabbit. The section
// carries that on its face. A page that implied these were a real child's
// memories would be doing the exact thing the product promises never to do.
//
// **It is computed from today.** The mentions are offsets in days, not fixed
// dates, so "since April" is right in April and right in November. A
// hard-coded month would be a lie eight months of the year, and the kind
// nobody notices because it still looks fine.

import { noticeThisWeek, type Observation } from "@/lib/graph/notice";
import type { Entity } from "@/lib/graph/presence";
import { shiftDays, todayIso } from "@/lib/time";

/** A run of mentions, given as days before today. */
function mentions(today: string, id: string, daysAgo: number[]) {
  return daysAgo.map((d, i) => ({ memoryId: `${id}-${i}`, date: shiftDays(today, -d) }));
}

/**
 * The demonstration family.
 *
 * Florence, two, from scripts/seed.mjs — the blue rabbit, the yellow boots,
 * the garbage trucks, and one sentence she says constantly. The shapes are
 * chosen to be the ones a real year actually contains: something that
 * stopped, something that came back, and something that is everywhere right
 * now. More entities than the engine will use, so the page demonstrates the
 * choosing as well as the counting.
 */
export function florence(today: string): Entity[] {
  return [
    {
      id: "bunbun",
      kind: "thing",
      label: "Bun Bun",
      // Everywhere last year, and then not. The observation nothing else
      // in the product can make.
      mentions: mentions(today, "bunbun", [140, 155, 168, 181, 196, 210, 224]),
    },
    {
      id: "boots",
      kind: "thing",
      // Plural on purpose. Every sentence the engine builds has to survive a
      // label the family typed, and families type plurals.
      label: "the yellow boots",
      mentions: mentions(today, "boots", [2, 5, 138, 152, 166]),
    },
    {
      id: "byself",
      kind: "phrase",
      // A transcript. Never tidied, never corrected — see lineFor().
      label: "I do it my byself",
      mentions: mentions(today, "byself", [1, 2, 3, 5, 6, 20, 34]),
    },
    {
      id: "trucks",
      kind: "thing",
      label: "garbage trucks",
      mentions: mentions(today, "trucks", [4, 11, 18, 25, 32, 39]),
    },
    {
      id: "swimming",
      kind: "ritual",
      label: "swimming",
      mentions: mentions(today, "swimming", [3, 10, 17, 24, 31, 38, 45]),
    },
  ];
}

/** The lines the landing page shows. Never more than three; often three. */
export function whatItNoticed(today: string = todayIso()): Observation[] {
  return noticeThisWeek({ today, entities: florence(today) });
}

/**
 * The disclosure that runs under them.
 *
 * Kept beside the fixture rather than in the page, so it is impossible to
 * ship the observations without it.
 */
export const NOTICING_CAPTION =
  "Florence is the made-up family in our own test data — the rabbit, the " +
  "boots and the sentence are inventions. What isn't invented is the " +
  "arithmetic: these lines were counted by the same code that would read " +
  "your archive, not written for this page.";
