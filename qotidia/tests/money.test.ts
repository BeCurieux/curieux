// Money, and the second way of counting it.
//
// The formatting tests exist because there were four implementations of it
// and they had already drifted. The scale tests exist for a different
// reason: dividing a price to make it feel smaller is one step from lying,
// and the only thing keeping it honest is that the arithmetic is real and
// the counterweight is available from the same module.

import { describe, expect, it } from "vitest";
import {
  aDay,
  aud,
  audExact,
  aYearOfKeeping,
  moreThanBuyingOnce,
  small,
  YEARS_A_BOOK_IS_KEPT,
} from "@/lib/billing/money";
import { PLAN_PRICES, yearOfMonthly } from "@/lib/billing/plans";

describe("formatting", () => {
  it("prints a price in whole dollars", () => {
    expect(aud(19900)).toBe("A$199");
    expect(aud(1900)).toBe("A$19");
  });

  it("drops the cents when there are none, and keeps them when there are", () => {
    expect(audExact(700)).toBe("A$7");
    expect(audExact(663)).toBe("A$6.63");
  });

  it("never prints a float's tail", () => {
    // A$6.6300000000000001 on a pricing page costs more trust than the
    // three cents are worth.
    for (let cents = 1; cents < 2000; cents++) {
      expect(audExact(cents)).not.toMatch(/\d{3,}$/);
    }
  });

  it("says 62c rather than A$0.62", () => {
    expect(small(62)).toBe("62c");
    expect(small(100)).toBe("A$1");
    expect(small(663)).toBe("A$6.63");
  });
});

describe("per day", () => {
  it("divides a monthly price by the real length of a month", () => {
    // 1900 / 30 would be 63c. The month is longer than thirty days, so the
    // true figure is lower — and a rounding that happens to flatter us is
    // still a rounding that flatters us.
    expect(aDay(1900)).toBe(62);
  });

  it("never reports a daily figure above the monthly price", () => {
    for (const cents of [100, 999, 1900, 5000, 19900]) {
      expect(aDay(cents)).toBeLessThan(cents);
    }
  });
});

describe("per year of keeping", () => {
  it("divides the book across the years it is meant to last", () => {
    expect(YEARS_A_BOOK_IS_KEPT).toBe(30);
    expect(aYearOfKeeping(19900)).toBe(663);
    expect(audExact(aYearOfKeeping(19900))).toBe("A$6.63");
  });

  it("does not divide by zero or by a negative lifetime", () => {
    expect(aYearOfKeeping(19900, 0)).toBe(19900);
    expect(aYearOfKeeping(19900, -5)).toBe(19900);
  });
});

describe("the counterweight", () => {
  it("reports that a year of monthly costs more than buying once", () => {
    // The page is allowed to say "62c a day" only because it can say this
    // from the same module. If this ever went negative, the pricing policy
    // in plans.ts would have changed and the page copy would be wrong.
    const gap = moreThanBuyingOnce(PLAN_PRICES.monthlyAud(), PLAN_PRICES.oneOffAud());
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBe(yearOfMonthly() - PLAN_PRICES.oneOffAud());
    expect(aud(gap)).toBe("A$29");
  });
});
