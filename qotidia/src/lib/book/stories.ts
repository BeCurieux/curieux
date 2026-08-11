// What story would you like to tell?
//
// A family has one archive. A book is a question asked of it, and this
// module is the list of questions worth offering — plus the one judgement
// that makes the screen more than a menu: which of them this family
// currently has the material to answer.
//
// The judgement matters because the alternative is a screen that offers four
// beautiful books to somebody with forty photographs, three of which produce
// something worth printing. Offering all four equally is how a product
// becomes the thing that sold you a disappointment.

import { periodFor, type BookPeriod } from "./period";
import { MIN_MEMORIES_FOR_A_BOOK } from "@/lib/renewal/policy";

export type StoryKind = "person" | "household";

export interface StoryOption {
  subjectId: string;
  kind: StoryKind;
  /** "Florence at two", "The Wilsons in 2028". */
  label: string;
  /** The book's own title, as it will be printed. */
  title: string;
  period: BookPeriod;
  /** Approved memories inside the period. */
  material: number;
  /** Whether there is enough to make a book worth reading. */
  ready: boolean;
  /** True when this subject already has a book for this period. */
  alreadyStarted: boolean;
  bookId?: string | null;
}

export interface StoryPicker {
  options: StoryOption[];
  /** The one we would pick, or null when nothing is ready yet. */
  suggested: StoryOption | null;
  /** Why, in the family's terms. Null when there is no suggestion. */
  because: string | null;
  /**
   * True when there is material for a book and every one of them is already
   * under way.
   *
   * A third state, and not the same as "nothing is ready" — which is what it
   * was collapsed into, producing "about -21 more and there's a book worth
   * reading" on a screen where two books were already being made. A family
   * who has done everything right should not be counted down at.
   */
  allStarted: boolean;
}

export interface StoryInput {
  subjectId: string;
  displayName: string;
  subjectType: "child" | "family" | "life";
  dateOfBirth?: string | null;
  material: number;
  alreadyStarted?: boolean;
  bookId?: string | null;
  /** For a household, which calendar year has the material. */
  calendarYear?: number | null;
  today?: string;
}

const first = (name: string) => name.split(/\s+/)[0] ?? name;

/**
 * How a family would describe the book, rather than how the book titles
 * itself.
 *
 * "Florence at two" is what somebody says out loud when choosing. "The Year
 * You Were Two" is what is printed on the cover, and putting the cover text
 * in a chooser makes four options that all start with the same three words.
 */
function labelFor(input: StoryInput, period: BookPeriod): string {
  if (input.subjectType === "child") {
    return `${first(input.displayName)} at ${period.yearNumber ?? 1}`;
  }
  return `${input.displayName} in ${period.calendarYear}`;
}

export function buildStories(inputs: StoryInput[]): StoryPicker {
  const options: StoryOption[] = inputs.map((input) => {
    const period = periodFor(
      {
        display_name: input.displayName,
        subject_type: input.subjectType,
        date_of_birth: input.dateOfBirth ?? null,
      },
      { today: input.today, calendarYear: input.calendarYear ?? null }
    );

    return {
      subjectId: input.subjectId,
      kind: input.subjectType === "child" ? "person" : "household",
      label: labelFor(input, period),
      title: period.title,
      period,
      material: input.material,
      ready: input.material >= MIN_MEMORIES_FOR_A_BOOK,
      alreadyStarted: input.alreadyStarted ?? false,
      bookId: input.bookId ?? null,
    };
  });

  // Whichever has the most to work with, among the ones not already begun.
  // Deliberately not "the child who has been in the product longest" or any
  // other proxy: the question is which book would be good today, and the
  // honest answer to that is which one has the most in it.
  const candidates = options.filter((o) => o.ready && !o.alreadyStarted);
  const suggested = candidates.length
    ? candidates.reduce((best, o) => (o.material > best.material ? o : best))
    : null;

  return {
    options,
    suggested,
    because: suggested ? because(suggested) : null,
    allStarted: !suggested && options.some((o) => o.ready && o.alreadyStarted),
  };
}

function because(o: StoryOption): string {
  const things = `${o.material} things`;
  return o.kind === "household"
    ? `There are ${things} from ${o.period.calendarYear} in the archive — more than any one person's year.`
    : `There are ${things} about ${o.label.split(" at ")[0]} in that year, more than anything else you could make right now.`;
}

/**
 * What to say when nothing is ready.
 *
 * Named rather than left to the screen, because the honest version of this
 * message is easy to get wrong in two directions: a chirpy "keep going!"
 * that ignores how much work has already gone in, or a bare threshold that
 * reads as a paywall.
 */
export function nothingReadyYet(best: StoryOption | undefined): string {
  if (!best || best.material === 0) {
    return "Nothing in here yet. Add some photographs and a book will start taking shape on its own.";
  }
  // Clamped, because this is also reached with a full archive when every
  // book that could be made already has been.
  const short = Math.max(1, MIN_MEMORIES_FOR_A_BOOK - best.material);
  return `The fullest year has ${best.material} things in it. About ${short} more and there's a book worth reading — and everything you add counts towards whichever one you choose.`;
}

/** What to say when every book worth making is already being made. */
export const EVERYTHING_UNDER_WAY =
  "Every book this archive could make is already under way. Keep adding — " +
  "they're all still open, and nothing is printed until you've read it through.";
