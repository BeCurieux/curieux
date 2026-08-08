// Money.
//
// This file used to test a second half of the module — per-day and
// per-year-of-keeping arithmetic for a pricing page that divided its own
// price four different ways. Both are gone. The tests went with them rather
// than being left behind to guard code nothing calls, which is how a suite
// becomes something people stop reading.
//
// What is left is the formatter, which had four implementations across four
// pages and had already drifted.

import { describe, expect, it } from "vitest";
import { aud } from "@/lib/billing/money";
import { PLAN_PRICES, planCopy, yearOfMonthly } from "@/lib/billing/plans";

describe("formatting", () => {
  it("prints a price in whole dollars", () => {
    expect(aud(19900)).toBe("A$199");
    expect(aud(1900)).toBe("A$19");
  });

  it("does not print a float's tail", () => {
    for (let cents = 1; cents < 40000; cents += 7) {
      expect(aud(cents)).toMatch(/^A\$\d+$/);
    }
  });
});

describe("the trade-off the page states", () => {
  it("is true, and computed rather than typed", () => {
    // The pricing page names one downside per option and no longer does any
    // arithmetic of its own. That sentence comes from planCopy(), so it can
    // only be wrong if the policy itself changes — in which case this fails
    // rather than the page quietly misleading somebody.
    const monthly = planCopy().find((p) => p.id === "monthly")!;
    expect(yearOfMonthly()).toBeGreaterThan(PLAN_PRICES.oneOffAud());
    expect(monthly.caveat).toContain(aud(yearOfMonthly()));
    expect(monthly.caveat).toMatch(/more than buying the book once/i);
  });
});
