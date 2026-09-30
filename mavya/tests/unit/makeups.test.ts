import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { plainDuration, policySummary, rankOptions } = await import("@/lib/domain/makeups");
type Option = Parameters<typeof rankOptions>[0][number];

const defaults = {
  makeupsEnabled: true,
  minimumNoticeMinutes: 120,
  creditValidityDays: 60,
  maxActiveCredits: 2,
  allowFutureLevel: false,
  bookingHorizonDays: 14,
  cancellationNoticeMinutes: 120,
  returnCreditOnValidCancellation: true,
  autoOffer: true,
  offerHoldMinutes: 120,
};

const option = (classId: string, startsAt: string): Option => ({
  occurrenceId: `${classId}-${startsAt}`,
  classId,
  className: "Dolphin 3",
  level: "Dolphin 3",
  location: "Mona Vale",
  timezone: "Australia/Sydney",
  instructor: "Mia",
  startsAt,
  endsAt: startsAt,
  freePlaces: 1,
});

describe("plainDuration", () => {
  it("says durations the way a parent would", () => {
    expect(plainDuration(120)).toBe("2 hours");
    expect(plainDuration(60)).toBe("1 hour");
    expect(plainDuration(1440)).toBe("1 day");
    expect(plainDuration(90)).toBe("90 minutes");
    expect(plainDuration(1)).toBe("1 minute");
  });
});

describe("policySummary", () => {
  it("describes the school's rules in plain words", () => {
    expect(policySummary(defaults, "Dolphin 3")).toEqual([
      "Tell us at least 2 hours before class",
      "Your make-up credit lasts 60 days",
      "Book any Dolphin 3 class in the next 2 weeks",
    ]);
  });

  it("mentions the next level and odd horizons", () => {
    const lines = policySummary(
      { ...defaults, allowFutureLevel: true, bookingHorizonDays: 10, minimumNoticeMinutes: 0 },
      "Dolphin 3",
    );
    expect(lines[0]).toBe("Tell us any time before class");
    expect(lines[2]).toBe("Book any Dolphin 3 class or the next level up in the next 10 days");
  });

  it("says so when make-ups are off", () => {
    expect(policySummary({ ...defaults, makeupsEnabled: false }, "Dolphin 3")).toEqual([
      "Make-ups aren't offered at the moment",
    ]);
  });
});

describe("rankOptions", () => {
  // Wednesday 30 Sep 2026, 4:30pm Sydney (AEST, +10:00).
  const missed = "2026-09-30T06:30:00Z";

  it("groups lessons by class and puts the best fit first", () => {
    const choices = rankOptions(
      [
        option("sat", "2026-10-03T23:00:00Z"), // Sat 9:00am
        option("thu", "2026-10-08T06:30:00Z"), // Thu 4:30pm, next week
        option("thu", "2026-10-01T06:30:00Z"), // Thu 4:30pm, tomorrow
        option("tue", "2026-10-06T06:30:00Z"), // Tue 4:30pm (after DST, 5:30pm)
      ],
      missed,
    );
    expect(choices.map((c) => c.classId)).toEqual(["thu", "sat", "tue"]);
    expect(choices[0]!.bestFit).toBe(true);
    expect(choices.filter((c) => c.bestFit)).toHaveLength(1);
    expect(choices[0]!.lessons.map((l) => l.startsAt)).toEqual([
      "2026-10-01T06:30:00Z",
      "2026-10-08T06:30:00Z",
    ]);
  });

  it("falls back to the closest lesson when no time matches", () => {
    const choices = rankOptions(
      [option("far", "2026-10-10T00:00:00Z"), option("near", "2026-10-02T00:00:00Z")],
      missed,
    );
    expect(choices[0]!.classId).toBe("near");
  });

  it("handles nothing to offer", () => {
    expect(rankOptions([], missed)).toEqual([]);
  });
});
