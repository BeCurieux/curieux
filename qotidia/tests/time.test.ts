// What day it is.
//
// A day either way is not cosmetic here. Every observation the weekly note
// makes is arithmetic against a window ending today, so a fixture or a job
// that computes "today" in UTC while the product computes it in Sydney
// reshapes what the product says about a family — quietly, and only for the
// ten hours a day the two disagree.

import { describe, expect, it } from "vitest";
import { shiftDays, todayIso } from "@/lib/time";

describe("today, where the family lives", () => {
  it("is already tomorrow in Sydney late in the UTC day", () => {
    const evening = new Date("2026-08-06T14:05:00Z");
    expect(todayIso(evening)).toBe("2026-08-07");
    expect(evening.toISOString().slice(0, 10)).toBe("2026-08-06");
  });

  it("agrees with UTC in the Sydney morning", () => {
    expect(todayIso(new Date("2026-08-06T00:05:00Z"))).toBe("2026-08-06");
  });
});

describe("moving a date", () => {
  it("counts back across a month", () => {
    expect(shiftDays("2026-08-06", -7)).toBe("2026-07-30");
  });

  it("counts forward across a year", () => {
    expect(shiftDays("2025-12-30", 5)).toBe("2026-01-04");
  });

  it("handles a leap day rather than skipping it", () => {
    expect(shiftDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("does not drift when a daylight saving change falls inside the span", () => {
    // Sydney's clocks go back on 5 April 2026. Arithmetic done on a local
    // Date across that boundary loses or gains an hour and can land on the
    // wrong day; done at UTC midnight on a plain date, there is no clock to
    // shift.
    expect(shiftDays("2026-04-01", 10)).toBe("2026-04-11");
    expect(shiftDays("2026-04-11", -10)).toBe("2026-04-01");
  });

  it("is its own inverse", () => {
    for (const n of [1, 7, 30, 365, 730]) {
      expect(shiftDays(shiftDays("2026-08-06", -n), n)).toBe("2026-08-06");
    }
  });
});
