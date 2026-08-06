// Which year a family starts with.
//
// The interesting case is the one that breaks the pitch: a family whose
// child has no completed year. Telling those parents to "empty last year's
// camera roll" describes a year that has not happened — useless, and the
// kind of small wrongness that tells someone nobody is really paying
// attention. Most of these tests are about that boundary.

import { describe, expect, it } from "vitest";
import {
  A_GOOD_YEAR,
  backfillProgress,
  canBackfill,
  startCopy,
  startingYear,
} from "@/lib/onboarding/start";

const on = (d: string) => new Date(`${d}T12:00:00Z`);

describe("the year we offer", () => {
  it("is the most recently completed one for a child over one", () => {
    // Born 15 Aug 2023, today July 2026: they are two, and the year they
    // were two ran Aug 2024 to Aug 2025. That year is done and photographed.
    const year = startingYear("2023-08-15", on("2026-07-01"));
    expect(year.yearNumber).toBe(2);
    expect(year.startDate).toBe("2024-08-15");
    expect(year.endDate).toBe("2025-08-14");
    expect(year.complete).toBe(true);
  });

  it("moves on the day a birthday passes", () => {
    const before = startingYear("2023-08-15", on("2026-08-14"));
    const after = startingYear("2023-08-15", on("2026-08-15"));
    expect(before.yearNumber).toBe(2);
    expect(after.yearNumber).toBe(3);
  });

  it("has no completed year for a baby, and says so", () => {
    // Four months old. There is nothing to catch up on, and the offer has
    // to be a different offer rather than the same one with a smaller number.
    const year = startingYear("2026-04-01", on("2026-08-06"));
    expect(year.complete).toBe(false);
    expect(canBackfill("2026-04-01", on("2026-08-06"))).toBe(false);
  });

  it("treats the first birthday as the moment backfill becomes possible", () => {
    // Born 6 Aug 2024. The day before their first birthday there is no
    // completed year; on the day, there is.
    expect(canBackfill("2024-08-06", on("2025-08-05"))).toBe(false);
    expect(canBackfill("2024-08-06", on("2025-08-06"))).toBe(true);
  });

  it("never offers a year number below one", () => {
    // A date of birth in the future is a typo, not a reason to crash or to
    // offer somebody year zero.
    expect(startingYear("2027-01-01", on("2026-08-06")).yearNumber).toBe(1);
  });

  it("covers exactly one year, ending the day before the birthday", () => {
    const year = startingYear("2020-02-29", on("2026-08-06"));
    const start = Date.parse(year.startDate);
    const end = Date.parse(year.endDate);
    const days = (end - start) / 86_400_000;
    expect(days).toBeGreaterThan(363);
    expect(days).toBeLessThan(367);
  });
});

describe("what we say", () => {
  it("invites a catch-up when there is a year to catch up on", () => {
    const copy = startCopy({
      childName: "Florence",
      year: startingYear("2023-08-15", on("2026-07-01")),
      ageWord: "two",
    });
    expect(copy.headline).toContain("the year Florence was two");
    // The promise that fixes the shape of the product: weeks, not a year.
    expect(copy.body).toMatch(/couple of weeks/);
    // It must not *promise* a wait. Checked as a promise rather than as a
    // substring: the copy legitimately contains "not next year", and an
    // earlier version of this assertion failed on exactly that.
    expect(copy.body).not.toMatch(/in (a|twelve months|next) year|wait until|at the end of the year/i);
  });

  it("does not tell a new parent to empty a camera roll they haven't filled", () => {
    const copy = startCopy({
      childName: "Zoe",
      year: startingYear("2026-04-01", on("2026-08-06")),
      ageWord: "one",
    });
    expect(copy.body).not.toMatch(/already happened|already on your phone|empty it/i);
    expect(copy.body).toMatch(/nothing to catch up on/i);
  });

  it("always offers a way out of the path", () => {
    // Nobody is trapped in an onboarding flow they did not choose.
    for (const dob of ["2023-08-15", "2026-04-01"]) {
      const copy = startCopy({
        childName: "Flo",
        year: startingYear(dob, on("2026-08-06")),
        ageWord: "two",
      });
      expect(copy.alternative.length).toBeGreaterThan(4);
    }
  });
});

describe("how a backfill reads while it happens", () => {
  it("encourages rather than gates", () => {
    // The real threshold lives in the renewal policy and is lower. This is
    // what a good year looks like, not what is permitted.
    expect(backfillProgress(0, "Flo")).toMatch(/start anywhere/i);
    expect(backfillProgress(40, "Flo")).toMatch(/make a book already/i);
    expect(backfillProgress(A_GOOD_YEAR + 5, "Flo")).toMatch(/full year of Flo/);
  });

  it("never tells someone they do not have enough", () => {
    for (const n of [0, 1, 10, 24, 25, 119, 200]) {
      expect(backfillProgress(n, "Flo")).not.toMatch(/not enough|need at least|too few/i);
    }
  });
});
