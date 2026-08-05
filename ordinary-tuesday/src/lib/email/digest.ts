// The daily sweep.
//
// Two things get decided here, once a day, for every archive.
//
// What is waiting. A grandparent uploading forty photographs on a Sunday
// must produce one message, not forty — so the batch is keyed by day, and a
// parent who has already been told today is not told again.
//
// Whether the year is closing. This is the ritual: the one message a year
// that asks for something, dated to the child's birthday. Annual cadence is
// the weakest kind — twelve months is long enough to be forgotten and short
// enough that no habit forms — so this is the beat that has to land.

import type { SupabaseClient } from "@supabase/supabase-js";
import { contributionsWaiting, yearClosing } from "./messages";
import { dailyKey, optOutToken, sendOnce } from "./send";

/** How far ahead of the birthday the year-closing note goes out. */
export const CLOSING_WEEKS = 3;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Whole weeks until the next birthday. Calendar arithmetic, not division of
 * milliseconds — the same mistake that once had the dashboard and the book
 * disagreeing about how old a child was.
 */
export function weeksUntilBirthday(dateOfBirth: string, now: Date): number {
  const dob = new Date(dateOfBirth);
  const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  if (next.getTime() < startOfDay(now).getTime()) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next.getTime() - startOfDay(now).getTime()) / (7 * DAY));
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Whether today is the day to warn that the year is closing. Exactly one day
 * a year qualifies, so a retried job cannot turn the ritual into a nag.
 */
export function isClosingDay(dateOfBirth: string, now: Date): boolean {
  return weeksUntilBirthday(dateOfBirth, now) === CLOSING_WEEKS;
}

export interface DigestSubject {
  id: string;
  displayName: string;
  dateOfBirth: string | null;
  familyId: string;
  pendingCount: number;
  owner: { userId: string; email: string } | null;
}

/**
 * Send what today calls for, for one archive. Split out from the job handler
 * so the decisions can be tested without a database.
 */
export async function runDigestFor(
  db: SupabaseClient,
  subject: DigestSubject,
  now: Date
): Promise<{ waiting: boolean; closing: boolean }> {
  const out = { waiting: false, closing: false };
  if (!subject.owner) return out;

  const token = await optOutToken(db, subject.owner.userId);

  if (subject.pendingCount > 0) {
    const result = await sendOnce(db, {
      kind: "contributions_waiting",
      dedupeKey: dailyKey("contributions_waiting", subject.id, now),
      userId: subject.owner.userId,
      subjectId: subject.id,
      message: contributionsWaiting({
        to: { email: subject.owner.email },
        childName: subject.displayName,
        count: subject.pendingCount,
        subjectId: subject.id,
        optOutToken: token,
      }),
    });
    out.waiting = result.sent;
  }

  if (subject.dateOfBirth && isClosingDay(subject.dateOfBirth, now)) {
    const result = await sendOnce(db, {
      kind: "year_closing",
      // Keyed by year: once, ever, per year.
      dedupeKey: `year_closing-${subject.id}-${now.getFullYear()}`,
      userId: subject.owner.userId,
      subjectId: subject.id,
      message: yearClosing({
        to: { email: subject.owner.email },
        childName: subject.displayName,
        subjectId: subject.id,
        weeksLeft: CLOSING_WEEKS,
        optOutToken: token,
      }),
    });
    out.closing = result.sent;
  }

  return out;
}
