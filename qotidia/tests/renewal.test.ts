// Charging automatically.
//
// This is the code that takes someone's money without asking again, so every
// branch is tested — particularly the ones that decide *not* to charge.
// A wrong "no" costs one sale; a wrong "yes" costs the customer, the refund,
// the dispute, and a share of the account's chargeback ratio.

import { describe, expect, it } from "vitest";
import {
  MIN_MEMORIES_FOR_A_BOOK, NOTICE_DAYS, REMINDER_DAYS, chargeDateFor,
  daysUntil, decideRenewal, isReminderDay, type RenewalCandidate,
} from "@/lib/renewal/policy";
import { FORMAT } from "@/lib/book/format";
import {
  renewalPaymentFailed, renewalReminder, renewalScheduled, renewalSkipped,
  containsArchiveContent,
} from "@/lib/email/messages";
import { isTransactional } from "@/lib/email/send";

const at = (s: string) => new Date(`${s}T10:00:00`);

const healthy = (over: Partial<RenewalCandidate> = {}): RenewalCandidate => ({
  status: "scheduled",
  scheduledFor: at("2028-05-01"),
  approvedMemories: 120,
  estimatedPages: 80,
  hasSavedCard: true,
  ...over,
});

describe("charging only when it is right to", () => {
  it("charges a good year on the day", () => {
    expect(decideRenewal(healthy(), at("2028-05-01"))).toEqual({ proceed: true, reason: "ok" });
  });

  it("never charges early", () => {
    expect(decideRenewal(healthy(), at("2028-04-30")).proceed).toBe(false);
    expect(decideRenewal(healthy(), at("2028-04-30")).reason).toBe("not_due");
  });

  it("never charges a cancelled renewal", () => {
    const r = decideRenewal(healthy({ status: "cancelled" }), at("2028-06-01"));
    expect(r).toEqual({ proceed: false, reason: "cancelled" });
  });

  it("never charges twice", () => {
    for (const status of ["charged", "skipped"] as const) {
      expect(decideRenewal(healthy({ status }), at("2028-06-01")).reason).toBe("already_done");
    }
  });

  it("does not charge without a card", () => {
    expect(decideRenewal(healthy({ hasSavedCard: false }), at("2028-05-01")).reason).toBe("no_card");
  });
});

describe("a thin year is not charged for", () => {
  // The rule that costs money on purpose, and the reason to trust the rest.
  it("refuses when barely anything was kept", () => {
    const r = decideRenewal(healthy({ approvedMemories: 4 }), at("2028-05-01"));
    expect(r).toEqual({ proceed: false, reason: "too_thin" });
  });

  it("refuses when the book cannot reach the minimum extent", () => {
    const r = decideRenewal(
      healthy({ estimatedPages: FORMAT.minInteriorPages - 2 }),
      at("2028-05-01")
    );
    expect(r.reason).toBe("too_thin");
  });

  it("charges right at the threshold, not one short of it", () => {
    expect(decideRenewal(healthy({ approvedMemories: MIN_MEMORIES_FOR_A_BOOK }), at("2028-05-01")).proceed).toBe(true);
    expect(decideRenewal(healthy({ approvedMemories: MIN_MEMORIES_FOR_A_BOOK - 1 }), at("2028-05-01")).proceed).toBe(false);
  });

  it("judges thinness at the moment of charging, not when it was scheduled", () => {
    // A family may add a great deal during the notice period. The candidate
    // carries live counts, so a year that was thin when announced and full by
    // the charge date is charged for.
    const filledUp = healthy({ approvedMemories: 200 });
    expect(decideRenewal(filledUp, at("2028-05-01")).proceed).toBe(true);
  });
});

describe("notice", () => {
  it("puts a fortnight between telling someone and charging them", () => {
    expect(NOTICE_DAYS).toBeGreaterThanOrEqual(14);
    const closes = at("2028-04-17");
    expect(daysUntil(chargeDateFor(closes), closes)).toBe(NOTICE_DAYS);
  });

  it("reminds once, a few days out, and not on any other day", () => {
    const due = at("2028-05-01");
    const remindOn = new Date(due);
    remindOn.setDate(remindOn.getDate() - REMINDER_DAYS);
    expect(isReminderDay(due, remindOn)).toBe(true);
    expect(isReminderDay(due, at("2028-04-29"))).toBe(false);
    expect(isReminderDay(due, at("2028-05-01"))).toBe(false);
  });

  it("counts the days to the charge in whole days", () => {
    expect(daysUntil(at("2028-05-01"), at("2028-04-24"))).toBe(7);
    expect(daysUntil(at("2028-05-01"), at("2028-05-01"))).toBe(0);
  });
});

describe("what the emails have to say", () => {
  const to = { email: "parent@example.com" };
  const scheduled = renewalScheduled({
    to, childName: "Florence", bookTitle: "The Year You Were Three", bookId: "b1",
    renewalId: "r1", amountAud: 19900, chargeOn: "1 May", cardLast4: "4242",
  });

  it("leads with the amount and the date, not with how lovely the book is", () => {
    expect(scheduled.subject).toContain("A$199");
    expect(scheduled.subject).toContain("1 May");
  });

  it("says which card, so it is recognisable on a statement", () => {
    expect(scheduled.text).toContain("4242");
  });

  it("always carries a way to stop it", () => {
    const all = [
      scheduled,
      renewalReminder({ to, bookTitle: "T", bookId: "b", renewalId: "r1", amountAud: 19900, days: 3 }),
    ];
    for (const m of all) expect(m.text).toContain("/renewals/r1/cancel");
  });

  it("tells someone plainly when we have chosen not to charge them", () => {
    const m = renewalSkipped({ to, childName: "Florence", subjectId: "s1" });
    expect(m.subject.toLowerCase()).toContain("haven't charged you");
  });

  it("distinguishes a declined card from one wanting the cardholder present", () => {
    const auth = renewalPaymentFailed({ to, bookTitle: "T", bookId: "b", needsAuthentication: true });
    const declined = renewalPaymentFailed({ to, bookTitle: "T", bookId: "b", needsAuthentication: false });
    expect(auth.text).toContain("bank wants you to confirm");
    expect(declined.text).toContain("declined");
  });

  it("carries no archive content, like every other message", () => {
    const all = [
      scheduled,
      renewalReminder({ to, bookTitle: "T", bookId: "b", renewalId: "r", amountAud: 19900, days: 3 }),
      renewalSkipped({ to, childName: "Florence", subjectId: "s" }),
      renewalPaymentFailed({ to, bookTitle: "T", bookId: "b", needsAuthentication: false }),
    ];
    for (const m of all) expect(containsArchiveContent(m), m.subject).toBe(false);
  });

  it("cannot be silenced by an unsubscribe", () => {
    // Telling someone you are about to charge them is not a marketing
    // preference, and an opt-out must not be able to switch it off.
    for (const k of ["renewal_scheduled", "renewal_reminder", "renewal_skipped", "renewal_payment_failed"] as const) {
      expect(isTransactional(k), k).toBe(true);
    }
  });
});
