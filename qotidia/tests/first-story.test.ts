// A money-back promise that can actually be kept.
//
// The failure mode is not writing a bad promise. It is writing a good one and
// then honouring it on paper — a window that expires before anything is
// delivered, a refund that quietly deletes the archive, a form to fill in, a
// retention offer between the customer and their money. Each of those is
// individually defensible and together they are why nobody believes a
// money-back guarantee.
//
// So most of what follows checks the terms against the product rather than
// against themselves: the clock starts when we deliver, the book price comes
// from the billing code, the reply time comes from the support promise, and
// the archive rule agrees with what already happens when somebody simply
// stops paying.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DAYS, HEADLINE, ONCE_PER_FAMILY, SHORT, STATUTORY, TERMS, bookCostAud,
} from "@/lib/trust/first-story";
import { ACCESS_AFTER_CANCELLING, PLAN_PRICES } from "@/lib/billing/plans";
import { REPLY, URGENT } from "@/lib/trust/founder";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const module_ = src("../src/lib/trust/first-story.ts");
const pricing = src("../src/app/pricing/page.tsx");
const said = () => TERMS().map((t) => `${t.what} ${t.detail}`).join(" ");

describe("the window opens when we deliver", () => {
  it("counts from the first story, not from the payment", () => {
    // A window that opens on payment expires while a family is still
    // uploading, which makes it a formality rather than a promise.
    expect(said()).toMatch(/the day we show you the first thing/i);
    expect(said()).toMatch(/not the day you paid/i);
    expect(SHORT).toMatch(/from your first story/i);
  });

  it("never opens at all if we never make one", () => {
    // The case where we took money and produced nothing is the one that
    // most deserves a refund, so it must not be the one that times out.
    expect(said()).toMatch(/never make you one, it never\s+starts/i);
    expect(said()).toMatch(/ask whenever you like/i);
  });

  it("is long enough to be used and short enough to mean something", () => {
    expect(DAYS).toBeGreaterThanOrEqual(14);
    expect(DAYS).toBeLessThanOrEqual(90);
  });
});

describe("what comes back", () => {
  it("is everything, with one named deduction", () => {
    expect(said()).toMatch(/In full/);
    expect(said()).toMatch(/already been\s+printed and posted/i);
  });

  it("takes the book's price from the billing code, not from prose", () => {
    // A refund term quoting a number the billing code no longer charges is
    // the specific way this kind of promise becomes false.
    expect(bookCostAud()).toBe(PLAN_PRICES.oneOffAud());
    expect(module_).toContain("PLAN_PRICES.oneOffAud()");
    // And no price is spelled out by hand anywhere in the terms.
    expect(said()).not.toMatch(/\bA?\$\s?\d/);
  });

  it("quotes the reply time the support promise actually makes", () => {
    expect(said()).toContain("one business day");
    expect(REPLY.urgentDays).toBe(1);
    // And a payment question is in the urgent tier over there, so the two
    // documents are not promising different things about the same email.
    expect(URGENT.join(" ")).toMatch(/payment/i);
  });
});

describe("a refund is not a trap", () => {
  it("takes nothing away from the archive", () => {
    // A refund that deleted the photographs would be a trap, and a family
    // who suspected it would never ask.
    expect(said()).toMatch(/deletes nothing/i);
    expect(said()).toMatch(/stays yours to read\s+and to download/i);
  });

  it("says the same thing the cancellation rule already does", () => {
    // Two documents describing what happens to an archive have to agree, or
    // the more generous one is decoration.
    expect(ACCESS_AFTER_CANCELLING.read).toBe(true);
    expect(ACCESS_AFTER_CANCELLING.export).toBe(true);
    expect(ACCESS_AFTER_CANCELLING.deletedForNonPayment).toBe(false);
    expect(said()).toMatch(/as it does if you simply stop paying/i);
  });

  it("puts nothing between a customer and their money", () => {
    expect(said()).toMatch(/no form, no survey/i);
    expect(said()).toMatch(/nobody will\s+offer you a discount to stay/i);
    expect(said()).toMatch(/no reason/i);
  });

  it("asks for no reason and offers no exceptions to argue about", () => {
    // "At our discretion" and "if you have not used the service" are the two
    // clauses that turn a promise into a negotiation.
    expect(said()).not.toMatch(/at our discretion|sole discretion|reasonable use|abuse/i);
    expect(said()).not.toMatch(/we may (refuse|decline|reject)/i);
  });
});

describe("it does not pretend to replace the law", () => {
  it("says so where a customer reads it, not in a footer", () => {
    expect(STATUTORY).toMatch(/in addition to/i);
    expect(STATUTORY).toMatch(/Australian Consumer Law/);
    expect(STATUTORY).toMatch(/the law wins/i);
    expect(pricing).toContain("FIRST_STORY_STATUTORY");
  });

  it("never claims to be the whole of a customer's rights", () => {
    const all = `${HEADLINE} ${said()} ${STATUTORY}`;
    expect(all).not.toMatch(/only remedy|instead of|in place of|waive|limits? your rights/i);
  });
});

describe("where it appears", () => {
  it("is on the page where the decision is made", () => {
    expect(pricing).toContain("The First Story Promise");
    expect(pricing).toContain("TERMS()");
    expect(pricing).toContain("HEADLINE");
  });

  it("sits above the sentence about stopping, which answers a later question", () => {
    // "If you stop" is about month nine. This is about the decision being
    // made on the page right now.
    // Against the rendered headings, not the file — the page's own comments
    // mention "if you stop" three times before either section exists.
    expect(pricing.indexOf(">\n          The First Story Promise"))
      .toBeLessThan(pricing.indexOf(">if you stop</h2>"));
  });

  it("is one line where a membership actually starts", () => {
    const billing = src("../src/app/settings/billing/page.tsx");
    expect(billing).toContain("FIRST_STORY_SHORT");
    expect(SHORT.length).toBeLessThan(70);
  });

  it("states its bound rather than leaving it to be discovered", () => {
    expect(ONCE_PER_FAMILY).toBe(true);
  });
});

describe("the promise reads as a promise", () => {
  it("leads with the thing being promised, in one sentence", () => {
    expect(HEADLINE).toMatch(/money back/i);
    expect(HEADLINE.split(/[.!?]/).filter(Boolean)).toHaveLength(1);
  });

  it("is a list, because nobody reads a paragraph of refund terms", () => {
    expect(TERMS()).toHaveLength(4);
    for (const t of TERMS()) {
      expect(t.what.length, t.what).toBeLessThanOrEqual(40);
      expect(t.detail.length, t.what).toBeGreaterThan(60);
    }
  });

  it("uses none of the vocabulary of a trial that converts", () => {
    const all = `${HEADLINE} ${SHORT} ${said()}`;
    expect(all).not.toMatch(/free trial|no obligation|risk[- ]free|cancel any time!/i);
  });
});
