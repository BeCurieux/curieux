// Charging for next year's book without being asked.
//
// The mechanism is easy — a saved card and an off-session charge. What is
// hard is doing it without becoming the kind of company people describe as
// "that thing that charged me again". Three rules follow from that, and each
// exists because of a specific way this goes wrong:
//
//   1. ANNOUNCED, NEVER SILENT. The charge is dated, disclosed, and the date
//      is far enough away to act on. A A$199 charge nobody remembers agreeing
//      to twelve months ago is a chargeback, and chargebacks above roughly
//      0.65% put an account into card-scheme monitoring. This is also what
//      Australian Consumer Law expects of an auto-renewal.
//
//   2. CANCELLABLE UNTIL IT HAPPENS. One click, no email to write, no reason
//      required. A renewal that is hard to stop is a refund plus a dispute
//      plus the customer, rather than just the customer.
//
//   3. NEVER CHARGE FOR A THIN YEAR. If the family barely used the archive,
//      the book would be poor — and charging A$199 for a poor book about
//      someone's child is the single worst thing this product could do. That
//      is the year to send nothing and charge nothing. It also removes the
//      disputes most likely to actually be upheld.
//
// Rule 3 is the one that costs money in the short run and is the reason to
// trust the rest.

import { FORMAT } from "@/lib/book/format";

/** Days between telling someone and charging them. */
export const NOTICE_DAYS = 14;

/** A second, quieter reminder this many days before the charge. */
export const REMINDER_DAYS = 3;

/**
 * Below this, a year has not produced a book worth printing or charging for.
 * Anchored to the format's own floor: fewer memories than this cannot fill
 * the minimum extent without padding, and padding a child's year is exactly
 * what this product refuses to do.
 */
export const MIN_MEMORIES_FOR_A_BOOK = 25;

export type RenewalStatus =
  | "scheduled"   // announced, waiting out the notice period
  | "cancelled"   // the family stopped it
  | "charged"     // paid, going to print
  | "skipped"     // too thin a year — deliberately not charged
  | "failed";     // the card was declined

export interface RenewalDecision {
  proceed: boolean;
  reason: "ok" | "too_thin" | "cancelled" | "already_done" | "not_due" | "no_card";
}

export interface RenewalCandidate {
  status: RenewalStatus;
  scheduledFor: Date;
  approvedMemories: number;
  estimatedPages: number;
  hasSavedCard: boolean;
}

/**
 * Whether to charge, right now, for a scheduled renewal. Pure, so every
 * branch is testable — this function decides whether to take someone's money
 * and should never require a Stripe key to reason about.
 */
export function decideRenewal(c: RenewalCandidate, now: Date): RenewalDecision {
  if (c.status === "cancelled") return { proceed: false, reason: "cancelled" };
  if (c.status === "charged" || c.status === "skipped") {
    return { proceed: false, reason: "already_done" };
  }
  if (now.getTime() < c.scheduledFor.getTime()) return { proceed: false, reason: "not_due" };

  // Rule 3, checked at the moment of charging rather than when scheduled —
  // a family might add a great deal during the notice period, or nothing.
  if (
    c.approvedMemories < MIN_MEMORIES_FOR_A_BOOK ||
    c.estimatedPages < FORMAT.minInteriorPages
  ) {
    return { proceed: false, reason: "too_thin" };
  }

  if (!c.hasSavedCard) return { proceed: false, reason: "no_card" };
  return { proceed: true, reason: "ok" };
}

/** When to charge, given the day the year closes. */
export function chargeDateFor(yearCloses: Date): Date {
  const d = new Date(yearCloses);
  d.setDate(d.getDate() + NOTICE_DAYS);
  return d;
}

/** Whether today is the day to send the quieter second reminder. */
export function isReminderDay(scheduledFor: Date, now: Date): boolean {
  const remind = new Date(scheduledFor);
  remind.setDate(remind.getDate() - REMINDER_DAYS);
  return sameDay(remind, now);
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Whole days from now until the charge, for saying so in plain words. */
export function daysUntil(scheduledFor: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(scheduledFor) - start(now)) / (24 * 60 * 60 * 1000));
}
