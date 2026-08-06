// Which year a family starts with.
//
// The product's biggest weakness was its shape: pay now, receive an object
// in twelve months, and in between keep a habit going with nothing to show
// for it. The look-back was built to fill that gap and cannot — it needs a
// year of history to fire, so the people it would help most are precisely
// the ones it cannot reach. New families churn in months two to four, long
// before either the book or the look-back arrives.
//
// The fix is not a new feature. It is starting somewhere else.
//
// A parent whose child is over one already has a completed year sitting in
// their camera roll. If the first thing they do is empty it in here, then:
// the archive has history on day one, the look-back works immediately, the
// clustering has something to find, a book can be printed within days rather
// than months, and the twelve-month wait becomes a twelve-month *next* year
// rather than the whole proposition.
//
// This module decides which year that is, and — the part that matters — when
// there isn't one.

/** Completed years of life at a date, by the calendar. */
function completedYears(dob: Date, at: Date): number {
  let years = at.getFullYear() - dob.getFullYear();
  const before =
    at.getMonth() < dob.getMonth() ||
    (at.getMonth() === dob.getMonth() && at.getDate() < dob.getDate());
  if (before) years -= 1;
  return years;
}

export interface StartingYear {
  /** Which year of life. 1 = the year they were one, i.e. age 0 to 1. */
  yearNumber: number;
  /** Inclusive ISO date range of that year. */
  startDate: string;
  endDate: string;
  /**
   * Whether that year is finished.
   *
   * The whole backfill pitch depends on this. A family with a four-month-old
   * has no completed year and cannot be offered one — telling them to "empty
   * last year's camera roll" would be describing a year that has not
   * happened, which is both useless and the kind of small wrongness that
   * says nobody is really paying attention.
   */
  complete: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The year to offer a family at signup.
 *
 * For a child over one, the most recently *completed* year — the one they
 * can fill from photographs that already exist. For a child under one, the
 * year in progress, because that is the only year there is.
 */
export function startingYear(dateOfBirth: string, today: Date = new Date()): StartingYear {
  const dob = new Date(dateOfBirth);
  const done = completedYears(dob, today);

  // Under one: the year in progress. Year 1 either way, but not complete,
  // and the difference decides everything downstream.
  const yearNumber = Math.max(1, done);

  const startDate = new Date(dob);
  startDate.setFullYear(dob.getFullYear() + yearNumber - 1);
  const endDate = new Date(dob);
  endDate.setFullYear(dob.getFullYear() + yearNumber);
  endDate.setDate(endDate.getDate() - 1);

  return {
    yearNumber,
    startDate: iso(startDate),
    endDate: iso(endDate),
    complete: done >= 1,
  };
}

/** Whether there is a finished year to backfill at all. */
export function canBackfill(dateOfBirth: string, today: Date = new Date()): boolean {
  return startingYear(dateOfBirth, today).complete;
}

// ------------------------------------------------------------------ words

/**
 * How the offer reads.
 *
 * Two genuinely different sentences, not one sentence with a value swapped
 * in. A family with photographs already taken is being asked to do something
 * they can finish this afternoon; a family with a newborn is being asked to
 * begin something. Those are different invitations and should not pretend to
 * be the same one.
 */
export interface StartCopy {
  headline: string;
  body: string;
  action: string;
  /** The quieter alternative, always offered. Nobody is trapped in a path. */
  alternative: string;
}

export function startCopy(input: {
  childName: string;
  year: StartingYear;
  ageWord: string;
}): StartCopy {
  const { childName, year, ageWord } = input;

  if (!year.complete) {
    return {
      headline: `Start with ${childName}'s first year`,
      body:
        `It's happening now, so there's nothing to catch up on. Add things as ` +
        `they occur to you — a photo, something they did, a day you don't want ` +
        `to lose — and we'll shape it into a book when the year closes.`,
      action: "Add the first thing",
      alternative: "Look around first",
    };
  }

  return {
    headline: `Start with the year ${childName} was ${ageWord}`,
    body:
      `That year has already happened, and most of it is already on your ` +
      `phone. Empty it in here this afternoon and you'll have the book in a ` +
      `couple of weeks — not next year. Then this year builds itself while ` +
      `you get on with it.`,
    action: `Fill the year they were ${ageWord}`,
    alternative: "Start from today instead",
  };
}

/**
 * Roughly how many photographs make a year worth printing.
 *
 * Shown as encouragement during a backfill, never as a gate. The real gate
 * is MIN_MEMORIES_FOR_A_BOOK in the renewal policy, and it is deliberately
 * lower — this number is what a good year looks like, not what is allowed.
 */
export const A_GOOD_YEAR = 120;

/** Where a backfill has got to, in words rather than a progress bar. */
export function backfillProgress(kept: number, childName: string): string {
  if (kept === 0) return `Nothing yet. Start anywhere — the middle of the year is fine.`;
  if (kept < 25) return `${kept} so far. Keep going — this is about a fortnight of the year.`;
  if (kept < A_GOOD_YEAR) return `${kept} so far. Enough to make a book already, and it gets better the more you add.`;
  return `${kept} kept. That's a full year of ${childName}. Make the book whenever you're ready.`;
}
