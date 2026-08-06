// Pricing.
//
// The bug these tests exist for: the landing page advertised A$199 while the
// checkout charged A$129, because the price moved in the brief and only one
// of the two places was updated. A customer would have been quoted one number
// and charged another. Nothing in the type system can catch that, so it is
// checked here against the actual source of the page.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTORENEW_TERMS, MAX_EXTRA_COPIES, PRICES, clampExtraCopies, instalmentMethods,
  instalmentsOffered, orderTotalAud,
} from "@/lib/stripe";
import { NOTICE_DAYS } from "@/lib/renewal/policy";
import { planCopy } from "@/lib/billing/plans";
import { codeOnly } from "./helpers/source";

const landingSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8"
);

const aud = (cents: number) => `A$${cents / 100}`;

/**
 * The landing page with its comments removed, for assertions about what the
 * page *claims*. Twice now a test like this has failed on a comment
 * describing the very bug it was written to catch.
 *
 * Only whole-line // comments are stripped, never mid-line: a regex that
 * eats from the first // onwards also eats every https:// URL on the page.
 */
const landingClaims = codeOnly(landingSource);


describe("the price we advertise is the price we charge", () => {
  // Originally these asserted the literal "A$199" appeared in the page
  // source, because the site once said 199 while the checkout charged 129.
  // The page now derives both figures from PRICES, so drift is impossible by
  // construction — which is a better guarantee than the string check was.
  // What still has to hold is that it never goes back to hard-coding them.
  it("takes the book price from the same place the checkout does", () => {
    const derived = landingSource.includes("PRICES.bookAud()");
    expect(derived || landingSource.includes(aud(PRICES.bookAud()))).toBe(true);
  });

  it("takes the extra-copy price from the same place", () => {
    const derived = landingSource.includes("PRICES.extraCopyAud()");
    expect(derived || landingSource.includes(aud(PRICES.extraCopyAud()))).toBe(true);
  });

  it("quotes a price somewhere, so the page still says what it costs", () => {
    expect(landingSource).toMatch(/PRICES\.\w+Aud\(\)|A\$\d+/);
  });

  it("advertises no price the checkout cannot produce", () => {
    const advertised = [...landingSource.matchAll(/A\$(\d+)/g)].map((m) => Number(m[1]) * 100);
    const chargeable = new Set([
      PRICES.bookAud(),
      PRICES.extraCopyAud(),
      ...Array.from({ length: MAX_EXTRA_COPIES + 1 }, (_, n) => orderTotalAud(n)),
    ]);
    for (const price of advertised) {
      expect(chargeable.has(price), `A$${price / 100} appears on the site but cannot be charged`).toBe(true);
    }
  });
});

describe("order totals", () => {
  it("charges the book price when no extra copies are wanted", () => {
    expect(orderTotalAud(0)).toBe(PRICES.bookAud());
  });

  it("adds each extra copy at the extra-copy price", () => {
    expect(orderTotalAud(2)).toBe(PRICES.bookAud() + 2 * PRICES.extraCopyAud());
  });

  it("prices extra copies below the book, or there is no reason to order together", () => {
    expect(PRICES.extraCopyAud()).toBeLessThan(PRICES.bookAud());
  });
});

describe("paying in instalments", () => {
  const withEnv = (value: string | undefined, fn: () => void) => {
    const prev = process.env.STRIPE_PAYMENT_METHODS;
    if (value === undefined) delete process.env.STRIPE_PAYMENT_METHODS;
    else process.env.STRIPE_PAYMENT_METHODS = value;
    try { fn(); } finally {
      if (prev === undefined) delete process.env.STRIPE_PAYMENT_METHODS;
      else process.env.STRIPE_PAYMENT_METHODS = prev;
    }
  };

  it("defers to the Stripe Dashboard when unset, rather than guessing", () => {
    // Naming a method the account has not enabled fails the session, so the
    // safe default is to name none at all.
    withEnv(undefined, () => {
      expect(instalmentMethods()).toEqual([]);
      expect(instalmentsOffered()).toBe(false);
    });
  });

  it("reads a configured list", () => {
    withEnv("card, afterpay_clearpay , zip", () => {
      expect(instalmentMethods()).toEqual(["card", "afterpay_clearpay", "zip"]);
      expect(instalmentsOffered()).toBe(true);
    });
  });

  it("does not claim instalments when only cards are enabled", () => {
    withEnv("card", () => expect(instalmentsOffered()).toBe(false));
  });

  it("ignores empty entries from a trailing comma", () => {
    withEnv("card,,", () => expect(instalmentMethods()).toEqual(["card"]));
  });
});

describe("copy count is bounded before it reaches Stripe or the printer", () => {
  it("treats absent, junk and negative input as no extra copies", () => {
    for (const input of [null, undefined, "", "abc", -3, NaN]) {
      expect(clampExtraCopies(input)).toBe(0);
    }
  });

  it("reads a form value", () => {
    expect(clampExtraCopies("3")).toBe(3);
  });

  it("refuses a quantity nobody meant to order", () => {
    expect(clampExtraCopies(9999)).toBe(MAX_EXTRA_COPIES);
  });

  it("never yields a fractional print run", () => {
    expect(Number.isInteger(clampExtraCopies("2.7"))).toBe(true);
  });
});

describe("the auto-renewal terms", () => {
  it("cannot be read as a recurring charge", () => {
    // The comment above AUTORENEW_TERMS says the whole defence against a
    // dispute a year later is that they read this paragraph. "A$199 a
    // fortnight later" parses two ways and one of them is a subscription.
    expect(AUTORENEW_TERMS).not.toMatch(/a fortnight|per fortnight|a month/);
    expect(AUTORENEW_TERMS).toMatch(/once/);
  });

  it("quotes the same notice period the scheduler actually uses", () => {
    // A promise of 14 days and a job that charges after 7 is a chargeback.
    expect(AUTORENEW_TERMS).toContain(`${NOTICE_DAYS} days`);
  });

  it("states the price that will actually be charged", () => {
    expect(AUTORENEW_TERMS).toContain(`A$${PRICES.bookAud() / 100}`);
  });
});

describe("the landing page and the plans on offer", () => {
  // This project began by fixing a landing page that said A$199 while the
  // checkout charged A$129. The same failure came back in a new shape: the
  // page asserted "No subscription, nothing to cancel" for two commits
  // after a monthly subscription shipped. A price that drifts is caught by
  // the tests above; a *claim* that drifts was not caught by anything.

  it("does not deny the existence of a plan that exists", () => {
    expect(landingClaims).not.toMatch(/no subscription/i);
    expect(landingClaims).not.toMatch(/nothing to cancel/i);
  });

  it("mentions every plan that can actually be bought", () => {
    for (const plan of planCopy()) {
      const shown =
        landingSource.includes(`plan=${plan.id}`) ||
        landingSource.includes(plan.name);
      expect(shown, `the landing page never mentions the ${plan.id} plan`).toBe(true);
    }
  });

  it("takes the monthly price from the same place the charge does", () => {
    expect(landingSource).toContain("PLAN_PRICES.monthlyAud()");
  });

  it("is reachable from somewhere other than the landing page", () => {
    // A pricing page nothing links to is a pricing page nobody reads.
    const layout = readFileSync(
      new URL("../src/app/layout.tsx", import.meta.url),
      "utf8"
    );
    expect(layout).toContain('href="/pricing"');
  });
});

describe("the extra-copy price", () => {
  // Both prices are env-overridable, which is the point — and also means a
  // misconfiguration can put a physical object on sale below what it costs
  // to make. These bounds are not a pricing opinion; they are the range
  // outside which something has gone wrong.

  it("is a discount, but not one that sells a hardcover at a loss", () => {
    const ratio = PRICES.extraCopyAud() / PRICES.bookAud();
    // Below about 40% of the book price, an extra copy stops covering a
    // print cost that — unlike an offset run — barely scales with quantity.
    expect(ratio).toBeGreaterThanOrEqual(0.4);
    // Above about 80% it is not a discount and nobody buys a second one.
    expect(ratio).toBeLessThanOrEqual(0.8);
  });

  it("tells the buyer where the extra copies actually go", () => {
    // One recipient, N copies: they all arrive at the buyer's address and
    // the parent re-posts. Discovering that on delivery is a support email.
    const checkout = readFileSync(
      new URL("../src/app/books/[bookId]/checkout/page.tsx", import.meta.url),
      "utf8"
    );
    expect(checkout).toMatch(/come to your address/);
  });
});
