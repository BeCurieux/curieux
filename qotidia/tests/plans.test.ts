// How a family pays.
//
// Every assertion here is about a case where the convenient answer and the
// fair answer differ. Those are the only ones worth testing: nobody ships a
// bug where a paying customer gets what they paid for, and everybody ships
// the one where a lapsed customer quietly loses something.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCESS_AFTER_CANCELLING,
  CANCELLATION_PROMISE,
  MONTHS_FOR_INCLUDED_BOOK,
  PLAN_PRICES,
  bookIncluded,
  bookPriceAfterCancelling,
  chargeAtYearEnd,
  creditForMonthsPaid,
  planCopy,
  yearOfMonthly,
} from "@/lib/billing/plans";
import { codeOnly } from "./helpers/source";

const root = join(__dirname, "..");

describe("leaving", () => {
  it("never costs a family their memories", () => {
    // A company that says "their childhood isn't content" and then holds a
    // four-year-old's photographs behind a lapsed card has said two things
    // and meant the second one.
    expect(ACCESS_AFTER_CANCELLING.read).toBe(true);
    expect(ACCESS_AFTER_CANCELLING.export).toBe(true);
    expect(ACCESS_AFTER_CANCELLING.deletedForNonPayment).toBe(false);
  });

  it("only stops them adding new things", () => {
    expect(ACCESS_AFTER_CANCELLING.addMemories).toBe(false);
    expect(CANCELLATION_PROMISE).toMatch(/never delete/i);
  });

  it("is not contradicted anywhere in the billing code", () => {
    // The webhook is where a cancellation is handled, and it is the one
    // place a well-meaning cleanup would get written.
    const webhook = readFileSync(join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");
    // Comments stripped first. The first version of this test failed on a
    // comment that said "nothing touches subjects, memories or storage" —
    // it was reading the promise rather than checking it.
    const code = codeOnly(webhook);
    const start = code.indexOf("customer.subscription.deleted");
    const rest = code.slice(start);
    const end = rest.indexOf('event.type === "invoice.paid"');
    const cancelBranch = end === -1 ? rest : rest.slice(0, end);
    expect(cancelBranch).not.toMatch(/\.delete\(|from\("memories"\)|from\("subjects"\)|storage/);
  });
});

describe("months already paid", () => {
  it("count against the book the year produced", () => {
    // Keeping five months of payments and also charging full price for the
    // book those payments were for is legal, defensible in a support email,
    // and remembered for ever.
    const five = 5 * PLAN_PRICES.monthlyAud();
    expect(creditForMonthsPaid(5)).toBe(five);
    expect(bookPriceAfterCancelling(5)).toBe(PLAN_PRICES.oneOffAud() - five);
  });

  it("can discount the book to nothing but never pay out", () => {
    // Credit toward a thing, not a balance owed.
    expect(creditForMonthsPaid(240)).toBe(PLAN_PRICES.oneOffAud());
    expect(bookPriceAfterCancelling(240)).toBe(0);
  });

  it("treats nonsense as nothing rather than as money", () => {
    expect(creditForMonthsPaid(-4)).toBe(0);
    expect(creditForMonthsPaid(0.9)).toBe(0);
  });
});

describe("when a year closes", () => {
  it("charges a monthly member nothing for a book they've been paying for", () => {
    expect(chargeAtYearEnd({ plan: "monthly", monthsPaidThisYear: 12 })).toBe(0);
    expect(chargeAtYearEnd({ plan: "monthly", monthsPaidThisYear: MONTHS_FOR_INCLUDED_BOOK })).toBe(0);
  });

  it("includes the book for someone who joined part-way through the year", () => {
    // Joining in March for a year that closes in June is four months paid
    // and a year genuinely used. Telling them to wait another eight is how
    // a family decides this was a mistake.
    expect(bookIncluded(6)).toBe(true);
    expect(MONTHS_FOR_INCLUDED_BOOK).toBeLessThan(12);
  });

  it("charges a very new member the difference, never the full price", () => {
    const owed = chargeAtYearEnd({ plan: "monthly", monthsPaidThisYear: 2 });
    expect(owed).toBeLessThan(PLAN_PRICES.oneOffAud());
    expect(owed).toBe(PLAN_PRICES.oneOffAud() - 2 * PLAN_PRICES.monthlyAud());
  });

  it("leaves the one-off buyer exactly as they were", () => {
    expect(chargeAtYearEnd({ plan: "one_off", monthsPaidThisYear: 0 })).toBe(PLAN_PRICES.oneOffAud());
  });

  it("resets the year's months so the next book is judged on its own", () => {
    // Without the reset, months_paid_this_year only grows and every future
    // book is included regardless of whether anyone kept paying.
    const run = readFileSync(join(root, "src/lib/renewal/run.ts"), "utf8");
    expect(run).toContain("months_paid_this_year: 0");
  });

  it("quotes one number to the customer and charges the same one", () => {
    // These were briefly two calculations, which is how someone gets told
    // A$199 and charged A$104.
    const run = readFileSync(join(root, "src/lib/renewal/run.ts"), "utf8");
    expect(run).toContain("async function amountDueFor");
    expect(run).not.toMatch(/amountAud:\s*r\.amount_aud/);
  });
});

describe("what the customer is told", () => {
  it("does not send a monthly member a bill for a book they already paid for", () => {
    const messages = readFileSync(join(root, "src/lib/email/messages.ts"), "utf8");
    const scheduled = messages.slice(messages.indexOf("export function renewalScheduled"));
    expect(scheduled).toContain("included in your membership");
    // And never the absurd version of the same email.
    expect(scheduled).toMatch(/amountAud <= 0/);
  });

  it("admits what each plan is worse at", () => {
    // A comparison table where one column has no downside is an advert, and
    // a parent reading it knows that.
    for (const plan of planCopy()) {
      expect(plan.caveat.length, `${plan.id} has no caveat`).toBeGreaterThan(20);
    }
  });

  it("says plainly that monthly costs more over a year", () => {
    const monthly = planCopy().find((p) => p.id === "monthly")!;
    expect(yearOfMonthly()).toBeGreaterThan(PLAN_PRICES.oneOffAud());
    expect(monthly.caveat).toMatch(/more than buying the book once/);
  });
});
