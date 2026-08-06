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
  MAX_EXTRA_COPIES, PRICES, clampExtraCopies, instalmentMethods,
  instalmentsOffered, orderTotalAud,
} from "@/lib/stripe";

const landingSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8"
);

const aud = (cents: number) => `A$${cents / 100}`;

describe("the price we advertise is the price we charge", () => {
  it("quotes the book at the price the landing page promises", () => {
    expect(landingSource).toContain(aud(PRICES.bookAud()));
  });

  it("quotes extra copies at the price the landing page promises", () => {
    expect(landingSource).toContain(aud(PRICES.extraCopyAud()));
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
