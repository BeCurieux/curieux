// What was happening a year ago.
//
// The archive has been write-only. Prompts push things in; the book pulls
// them out once a year; in between there has been no reason to open the app
// at all. This is the reason — the single mechanic that has kept every photo
// product's daily habit alive, and the one this product is best placed to do
// well, because it already knows which forty things out of four thousand
// mattered.
//
// Two design constraints, and the second is the one that makes or breaks it.
//
//   The rule from everywhere else applies: nothing is invented. A look-back
//   shows what the family wrote, on the day they wrote it. No generated
//   captions, no "you must have been so happy".
//
//   **Most days a year ago are empty.** A family keeps perhaps sixty things
//   in a year, so an exact-date match fires on maybe one day in six. A
//   look-back that works one day in six is not a habit, it is an
//   occasional pleasant surprise — so this widens its search in steps until
//   it finds something real, and says plainly when there is nothing rather
//   than padding the day out with something that isn't a memory.
//
// Deterministic on the date, so the app and the morning email agree, and so
// refreshing the page does not reshuffle a memory out from under someone.
//
// Pure and synchronous. Every branch is testable without a database.

import { canSeeMemory, type ContributionStatus, type FamilyRole, type MemoryVisibility } from "@/lib/family/roles";

export type LookBackKind =
  | "same_day"
  | "same_week"
  | "same_month"
  | "little_thing"
  | "quiet";

export interface LookBackCandidate {
  id: string;
  /** ISO date, YYYY-MM-DD. Memories without one cannot be looked back on. */
  date: string | null;
  type: string;
  text: string | null;
  hasPhoto: boolean;
  contributionStatus: ContributionStatus;
  createdBy: string;
  visibility?: MemoryVisibility;
}

export interface LookBackMemory {
  id: string;
  date: string;
  type: string;
  text: string | null;
  hasPhoto: boolean;
  yearsAgo: number;
}

export interface LookBack {
  kind: LookBackKind;
  /** Shown in the app. May reference what the family wrote. */
  headline: string;
  /**
   * Shown in email. Never quotes the archive.
   *
   * The same rule the prompt engine follows: an email passes through a third
   * party and sits in an inbox for ever, so it points at the thing rather
   * than carrying it.
   */
  emailHeadline: string;
  memories: LookBackMemory[];
  /** A little thing, when that is what was found. */
  littleThing: { category: string; value: string; monthsOld: number } | null;
}

/** Most that is ever shown at once. Beyond this it stops being a moment. */
export const MAX_SHOWN = 3;

/** How far either side of the date counts as "this week". */
const WEEK_DAYS = 3;

/** A little thing is only worth resurfacing once it has had time to change. */
export const STALE_LITTLE_THING_MONTHS = 6;

// ------------------------------------------------------------------ dates

function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Whole days between two ISO dates, ignoring time and time zones entirely. */
function daysApart(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return Number.POSITIVE_INFINITY;
  const ms = Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round(ms / 86_400_000);
}

/**
 * The same calendar day in an earlier year, allowing for 29 February.
 *
 * A child born on a leap day has a birthday every year in every way that
 * matters to their parents, and a look-back that silently skips it three
 * years in four would be a small cruelty.
 */
function sameCalendarDay(memory: { m: number; d: number }, today: { m: number; d: number }): boolean {
  if (memory.m === today.m && memory.d === today.d) return true;
  const leapDay = memory.m === 2 && memory.d === 29;
  return leapDay && today.m === 2 && today.d === 28;
}

/** Days between the two dates ignoring which year each falls in. */
function daysApartInYear(memoryIso: string, todayIso: string): number {
  const pm = parts(memoryIso);
  const pt = parts(todayIso);
  if (!pm || !pt) return Number.POSITIVE_INFINITY;
  // Project the memory onto this year, then measure. Also try the adjacent
  // years so a date in late December is close to one in early January.
  return Math.min(
    ...[pt.y - 1, pt.y, pt.y + 1].map((y) =>
      Math.abs(daysApart(`${y}-${memoryIso.slice(5)}`, todayIso))
    )
  );
}

function yearsBetween(memoryIso: string, todayIso: string): number {
  const pm = parts(memoryIso);
  const pt = parts(todayIso);
  if (!pm || !pt) return 0;
  return pt.y - pm.y;
}

// ------------------------------------------------------------- selection

/**
 * A stable number for a date, so the choice rotates day to day but never
 * within a day.
 *
 * Math.random would give a different memory on every render — the parent
 * would see one thing, share it with someone, refresh, and find it gone.
 */
function seedFor(iso: string): number {
  let h = 0;
  for (const ch of iso) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Rotate a list deterministically, then take the first few. */
function pick<T>(items: T[], seed: number, count: number): T[] {
  if (items.length <= count) return items;
  const start = seed % items.length;
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length]);
}

// ------------------------------------------------------------------ words

function yearsWord(n: number): string {
  if (n <= 1) return "A year";
  if (n === 2) return "Two years";
  if (n === 3) return "Three years";
  if (n === 4) return "Four years";
  if (n === 5) return "Five years";
  return `${n} years`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ------------------------------------------------------------------ main

export interface LookBackInput {
  /** Today, as an ISO date. Passed in so the whole thing stays pure. */
  today: string;
  memories: LookBackCandidate[];
  littleThings: { category: string; value: string; monthsOld: number }[];
  /** Who is looking. Governs what they are allowed to be shown. */
  viewer: { userId: string; role: FamilyRole | null };
}

/**
 * The one thing worth showing today.
 *
 * Widens in steps — exact day, that week, that month — and stops at the
 * first step that finds anything. Falls back to a little thing, which is a
 * different and quieter pleasure: not "here is a day" but "this is what they
 * were like". Returns `quiet` rather than inventing a fifth option.
 */
export function lookBackFor(input: LookBackInput): LookBack {
  const today = parts(input.today);
  const quiet: LookBack = {
    kind: "quiet",
    headline: "Nothing from this day in other years — yet.",
    emailHeadline: "Nothing from this day in other years — yet.",
    memories: [],
    littleThing: null,
  };
  if (!today) return quiet;

  // Everything this viewer is allowed to see, dated, and genuinely in the
  // past. A memory added today is not a look-back.
  const eligible = input.memories.filter((m) => {
    if (!m.date || !parts(m.date)) return false;
    if (yearsBetween(m.date, input.today) < 1) return false;
    return canSeeMemory(
      input.viewer.role,
      { contributionStatus: m.contributionStatus, createdBy: m.createdBy, visibility: m.visibility },
      input.viewer.userId
    );
  });

  const toShown = (m: LookBackCandidate): LookBackMemory => ({
    id: m.id,
    date: m.date!,
    type: m.type,
    text: m.text,
    hasPhoto: m.hasPhoto,
    yearsAgo: yearsBetween(m.date!, input.today),
  });

  const seed = seedFor(input.today);

  // ---- 1. this exact day
  const sameDay = eligible.filter((m) => {
    const p = parts(m.date!)!;
    return sameCalendarDay(p, today);
  });
  if (sameDay.length > 0) {
    const shown = pick(sameDay, seed, MAX_SHOWN).map(toShown);
    const years = Math.min(...shown.map((s) => s.yearsAgo));
    return {
      kind: "same_day",
      headline: `${yearsWord(years)} ago today`,
      emailHeadline: `${yearsWord(years)} ago today`,
      memories: shown,
      littleThing: null,
    };
  }

  // ---- 2. this week
  const sameWeek = eligible.filter((m) => daysApartInYear(m.date!, input.today) <= WEEK_DAYS);
  if (sameWeek.length > 0) {
    const shown = pick(sameWeek, seed, MAX_SHOWN).map(toShown);
    const years = Math.min(...shown.map((s) => s.yearsAgo));
    return {
      kind: "same_week",
      headline: `${yearsWord(years)} ago, around now`,
      emailHeadline: `${yearsWord(years)} ago, around now`,
      memories: shown,
      littleThing: null,
    };
  }

  // ---- 3. this month
  const sameMonth = eligible.filter((m) => parts(m.date!)!.m === today.m);
  if (sameMonth.length > 0) {
    const shown = pick(sameMonth, seed, MAX_SHOWN).map(toShown);
    const years = Math.min(...shown.map((s) => s.yearsAgo));
    const month = MONTHS[today.m - 1];
    return {
      kind: "same_month",
      headline: `${month}, ${yearsWord(years).toLowerCase()} ago`,
      emailHeadline: `${month}, ${yearsWord(years).toLowerCase()} ago`,
      memories: shown,
      littleThing: null,
    };
  }

  // ---- 4. something that was true back then
  const stale = input.littleThings.filter((t) => t.monthsOld >= STALE_LITTLE_THING_MONTHS);
  if (stale.length > 0) {
    const thing = pick(stale, seed, 1)[0];
    return {
      kind: "little_thing",
      // The app may quote it; the email may not.
      headline: `${thing.monthsOld} months ago, this was true`,
      emailHeadline: "Something you recorded a while ago",
      memories: [],
      littleThing: thing,
    };
  }

  return quiet;
}

/**
 * Whether there is anything worth putting in front of someone.
 *
 * Used by the email so a quiet day sends nothing at all. A daily message
 * that says "nothing today" every day is how a product teaches people to
 * filter it.
 */
export function worthSending(look: LookBack): boolean {
  return look.kind !== "quiet";
}
