// How a family pays.
//
// Every assertion here is about a case where the convenient answer and the
// fair answer differ. Those are the only ones worth testing: nobody ships a
// bug where a paying customer gets what they paid for, and everybody ships
// the one where a lapsed customer quietly loses something.

import { readFileSync, readdirSync } from "node:fs";
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

/** Every page and action file, for checks about what a surface may display. */
function walkApp(dir = join(root, "src/app"), out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkApp(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}


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
    // There is exactly one implementation of "what does this family pay for
    // this book", and all three places that need it read from it. They were
    // two implementations and one omission — the omission being the manual
    // checkout, which charged a monthly member the full A$199 on top of
    // their subscription because it did not know plans existed.
    const callers = [
      "src/lib/renewal/run.ts",                       // the annual charge
      "src/app/actions.ts",                           // what is charged
      "src/app/books/[bookId]/checkout/page.tsx",     // what is shown
    ];
    for (const file of callers) {
      expect(readFileSync(join(root, file), "utf8"), `${file} prices books itself`)
        .toContain("bookPriceFor");
    }
  });

  it("never charges a full price the family has already partly paid", () => {
    // The page and the action must both take the amount from the helper, not
    // from PRICES and not from the form.
    const stripe = readFileSync(join(root, "src/lib/stripe.ts"), "utf8");
    const checkout = stripe.slice(stripe.indexOf("export async function createBookCheckout"));
    // The book line item takes the amount it was given.
    expect(checkout).toContain("unit_amount: opts.bookAmountAud");
    expect(checkout).not.toMatch(/unit_amount:\s*PRICES\.bookAud\(\)/);
  });

  it("never quotes a future charge from the renewal row", () => {
    // renewal.amount_aud is the full price, fixed when the renewal was
    // scheduled. Rendering it tells a monthly member we will charge them
    // A$199 for a book already included — which is what the dashboard did,
    // and what the screenshot showed. Anything quoting what a family *will*
    // pay reads it from bookPriceFor; billing history, which is what they
    // *did* pay, is a different question and legitimately stored.
    const pages = walkApp();
    const offenders = pages.filter((f) =>
      /renewal[^\n]*\.amount_aud/.test(codeOnly(readFileSync(f, "utf8")))
    );
    expect(offenders.map((f) => f.replace(root + "/", ""))).toEqual([]);
  });

  it("prices the renewal notice on the dashboard from the plan", () => {
    const subject = readFileSync(join(root, "src/app/subjects/[subjectId]/page.tsx"), "utf8");
    expect(subject).toContain("bookPriceFor");
  });

  it("does not send someone to a checkout for nothing", () => {
    // A Stripe session for A$0 either fails or asks for a card to be charged
    // nothing. Both read as our mistake.
    const actions = codeOnly(readFileSync(join(root, "src/app/actions.ts"), "utf8"));
    expect(actions).toMatch(/price\.amountAud === 0/);
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
