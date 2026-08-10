// "A story I found in your year."
//
// The first artefact, made in the first session, from a batch of
// photographs and one sentence the parent typed. It is the moment the
// product either earns eighteen years or does not.
//
// ## The title, which is the whole argument
//
// The brief's example title is *The Summer You Learned to Love the Water*.
// That is a lovely line and this product cannot write it. It asserts a
// season, a child's inner state, and a change over time — three claims about
// a family, from a system that has seen some timestamps and one sentence.
// It is precisely the invented memory the archive exists not to produce,
// and producing one in the first five minutes would be the worst possible
// time: everything after it is being judged against whether the first thing
// we said was true.
//
// So a story is titled one of two ways, and never a third:
//
//   **What the parent said.** If they answered the question, their own words
//   are the title. "Bun Bun's first swim" is a better line than anything a
//   model would write, and it is *theirs*.
//
//   **What the archive can count.** "One Saturday in March." Flat, factual,
//   and it never claims anything. This is the fallback, not a failure —
//   plenty of days are best titled by their date.
//
// The subtitle is always arithmetic. It is what makes the artefact feel
// found rather than generated: the parent can check every word of it.
//
// ## What a story is not
//
// Not a summary, not a caption for each photograph, not narration. The
// photographs are the content; this module decides which ones, in what
// order, under what title. Everything it adds is either counted or quoted.

import type { Discovery } from "./discover";

export interface Story {
  title: string;
  /** Where the title came from. Shown to nobody; asserted by tests. */
  titleFrom: "the family" | "the calendar";
  /** The arithmetic under the title. Always checkable. */
  subtitle: string;
  /** Oldest first. */
  shotIds: string[];
  from: string;
  to: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const monthOf = (iso: string) => MONTHS[new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCMonth()];
const weekdayOf = (iso: string) => DAYS[new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay()];
const yearOf = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCFullYear();

/**
 * How much of an answer becomes a title.
 *
 * The first sentence, and only if it is short enough to set large. A parent
 * who writes a paragraph has given us something better than a title — it
 * goes in the archive whole, and the title falls back to the date.
 */
const TITLE_FITS = 52;

export function titleFrom(answer: string | null): { title: string; from: "the family" } | null {
  const said = (answer ?? "").trim();
  if (!said) return null;

  // First sentence, trailing full stop removed. Question marks and
  // exclamation marks are kept — they are how the person wrote it.
  const firstSentence = said.split(/(?<=[.!?])\s/)[0].trim().replace(/\.$/, "");
  if (!firstSentence || firstSentence.length > TITLE_FITS) return null;

  return { title: firstSentence, from: "the family" };
}

/** A title that claims nothing: the day, the months, or the years. */
export function titleFromCalendar(discovery: Discovery): string {
  if (discovery.finding === "a_day") {
    return `One ${weekdayOf(discovery.from)} in ${monthOf(discovery.from)}`;
  }

  // A span's subtitle already reads "…across nine months, August to May",
  // so titling it "August to May" prints the same phrase twice, one above
  // the other. The years are the one thing the subtitle does not say.
  if (discovery.finding === "a_span") {
    const from = yearOf(discovery.from);
    const to = yearOf(discovery.to);
    return from === to ? String(from) : `${from}–${to}`;
  }

  const start = monthOf(discovery.from);
  const end = monthOf(discovery.to);
  return start === end ? start : `${start} to ${end}`;
}

/**
 * Build the artefact.
 *
 * `shots` is the ordered list available; the story keeps the ones the
 * discovery pointed at, in the order they were taken, capped so that a day
 * with two hundred photographs becomes a sequence rather than a contact
 * sheet.
 */
export const MOST_IN_A_STORY = 12;

export function storyFrom(input: {
  discovery: Discovery;
  answer: string | null;
}): Story | null {
  const { discovery, answer } = input;

  // A gap has no photographs in it by definition. There is nothing to show,
  // and inventing something to show is the failure mode this module is
  // written against.
  if (discovery.shotIds.length === 0) return null;

  const said = titleFrom(answer);

  return {
    title: said ? said.title : titleFromCalendar(discovery),
    titleFrom: said ? "the family" : "the calendar",
    subtitle: discovery.because,
    shotIds: evenly(discovery.shotIds, MOST_IN_A_STORY),
    from: discovery.from,
    to: discovery.to,
  };
}

/**
 * Pick n across the sequence rather than the first n.
 *
 * Taking the first twelve of a day gives twelve photographs of arriving. An
 * even spread gives the shape of the day, which is the thing that makes a
 * sequence read as a story rather than as a folder.
 *
 * The first and last are always kept.
 */
export function evenly<T>(items: T[], n: number): T[] {
  if (items.length <= n) return [...items];
  const step = (items.length - 1) / (n - 1);
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.round(i * step)]);
  return out;
}
