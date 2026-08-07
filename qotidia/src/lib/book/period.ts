// Which twelve months a book is about.
//
// One implementation, because there were three: the create-book action
// worked it out from a date of birth, the book-so-far projection had its own
// fallback, and onboarding had startingYear(). Three places computing the
// same fact is three places to disagree, and this codebase has paid that
// bill twice already — a price in five places, a tagline in two. A
// projection of a different year than the book being collected is the worst
// version of the bug, because it looks right.
//
// A child's year runs birthday to birthday: "the year you were two" is the
// twelve months between their second and third birthdays. A household's runs
// January to December, because a family has no birthday and every other
// convention would be arbitrary.

import { startingYear } from "@/lib/onboarding/start";
import { titleFor, type SubjectType } from "@/lib/subjects/config";
import { todayIso } from "@/lib/time";

export interface BookPeriod {
  /** Years of life. Null for anything not anchored to a birth date. */
  yearNumber: number | null;
  /** Jan–Dec. Null for a child's book. */
  calendarYear: number | null;
  start: string;
  end: string;
  title: string;
  /** False while the period is still being lived through. */
  complete: boolean;
}

export interface PeriodSubject {
  display_name: string;
  subject_type: SubjectType;
  date_of_birth?: string | null;
}

export function periodFor(
  subject: PeriodSubject,
  opts: { today?: string; calendarYear?: number | null } = {}
): BookPeriod {
  const today = opts.today ?? todayIso();

  if (subject.subject_type === "child" && subject.date_of_birth) {
    const year = startingYear(subject.date_of_birth, new Date(`${today}T00:00:00Z`));
    return {
      yearNumber: year.yearNumber,
      calendarYear: null,
      start: year.startDate,
      end: year.endDate,
      complete: year.complete,
      title: titleFor("child", {
        displayName: subject.display_name,
        yearNumber: year.yearNumber,
        calendarYear: null,
      }),
    };
  }

  // A household, or a life told in eras but collected a year at a time.
  const year = opts.calendarYear ?? Number(today.slice(0, 4));
  return {
    yearNumber: null,
    calendarYear: year,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    complete: `${year}-12-31` < today,
    title: titleFor(subject.subject_type, {
      displayName: subject.display_name,
      yearNumber: null,
      calendarYear: year,
    }),
  };
}
