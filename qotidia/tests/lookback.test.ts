// Looking back.
//
// Two things are being tested and only one of them is the date arithmetic.
// The other is that a look-back cannot become the way a private note reaches
// the wrong person — it is the one surface that goes hunting through the
// whole archive for something to show, which makes it the one most likely to
// find something it shouldn't.

import { describe, expect, it } from "vitest";
import {
  lookBackFor,
  MAX_SHOWN,
  STALE_LITTLE_THING_MONTHS,
  worthSending,
  type LookBackCandidate,
} from "@/lib/lookback/engine";

const OWNER = { userId: "mum", role: "owner" as const };

function memory(over: Partial<LookBackCandidate> & { date: string }): LookBackCandidate {
  return {
    id: over.date + (over.id ?? ""),
    type: "text",
    text: "Something happened.",
    hasPhoto: false,
    contributionStatus: "approved",
    createdBy: "mum",
    visibility: "family",
    ...over,
  };
}

const on = (today: string, memories: LookBackCandidate[], littleThings: any[] = []) =>
  lookBackFor({ today, memories, littleThings, viewer: OWNER });

describe("finding the day", () => {
  it("prefers this exact day a year ago", () => {
    const out = on("2026-08-06", [
      memory({ date: "2025-08-06", text: "Boots on the wrong feet." }),
      memory({ date: "2025-08-20", text: "Swimming." }),
    ]);
    expect(out.kind).toBe("same_day");
    expect(out.headline).toBe("A year ago today");
    expect(out.memories.map((m) => m.text)).toEqual(["Boots on the wrong feet."]);
  });

  it("counts the years properly when the match is older", () => {
    const out = on("2026-08-06", [memory({ date: "2023-08-06" })]);
    expect(out.headline).toBe("Three years ago today");
    expect(out.memories[0].yearsAgo).toBe(3);
  });

  it("widens to the week rather than showing nothing", () => {
    // The case that decides whether this is a habit or a surprise: a family
    // keeps perhaps sixty things a year, so an exact date match fires about
    // one day in six.
    const out = on("2026-08-06", [memory({ date: "2025-08-08", text: "The park." })]);
    expect(out.kind).toBe("same_week");
    expect(out.headline).toBe("A year ago, around now");
  });

  it("widens again to the month", () => {
    const out = on("2026-08-06", [memory({ date: "2025-08-27", text: "Late August." })]);
    expect(out.kind).toBe("same_month");
    expect(out.headline).toBe("August, a year ago");
  });

  it("treats late December and early January as near each other", () => {
    // Naive day-of-year arithmetic puts these 360 days apart.
    const out = on("2027-01-02", [memory({ date: "2025-12-31", text: "New Year." })]);
    expect(out.kind).toBe("same_week");
  });

  it("shows a leap-day memory on the 28th in a common year", () => {
    // A child born on 29 February has a birthday every year in every way
    // that matters to their parents.
    const out = on("2027-02-28", [memory({ date: "2024-02-29", text: "Her birthday." })]);
    expect(out.kind).toBe("same_day");
  });

  it("never looks back on something added this year", () => {
    // "A year ago today" about something from four months ago is the kind of
    // small lie that tells a parent nobody is really reading.
    const out = on("2026-08-06", [memory({ date: "2026-04-06" })]);
    expect(out.kind).toBe("quiet");
  });

  it("ignores an undated memory rather than guessing a date for it", () => {
    const out = on("2026-08-06", [memory({ date: "2025-08-06" }), { ...memory({ date: "x" }), date: null }]);
    expect(out.memories).toHaveLength(1);
  });
});

describe("what it will not show", () => {
  it("keeps a private note private, even from the person who owns the archive", () => {
    // Written for one person. The owner can moderate everything and still
    // must not be handed this.
    const out = lookBackFor({
      today: "2026-08-06",
      memories: [memory({ date: "2025-08-06", visibility: "private", createdBy: "dad" })],
      littleThings: [],
      viewer: OWNER,
    });
    expect(out.kind).toBe("quiet");
  });

  it("shows a private note back to whoever wrote it", () => {
    const out = lookBackFor({
      today: "2026-08-06",
      memories: [memory({ date: "2025-08-06", visibility: "private", createdBy: "mum" })],
      littleThings: [],
      viewer: OWNER,
    });
    expect(out.kind).toBe("same_day");
  });

  it("does not surface a contribution still waiting to be approved", () => {
    const out = lookBackFor({
      today: "2026-08-06",
      memories: [memory({ date: "2025-08-06", contributionStatus: "pending", createdBy: "grandpa" })],
      littleThings: [],
      viewer: { userId: "grandma", role: "contributor" },
    });
    expect(out.kind).toBe("quiet");
  });

  it("shows a grandparent only what the family has kept", () => {
    const out = lookBackFor({
      today: "2026-08-06",
      memories: [
        memory({ id: "a", date: "2025-08-06", contributionStatus: "approved", text: "Kept." }),
        memory({ id: "b", date: "2025-08-06", visibility: "private", createdBy: "mum", text: "Not for them." }),
      ],
      littleThings: [],
      viewer: { userId: "grandpa", role: "contributor" },
    });
    expect(out.memories.map((m) => m.text)).toEqual(["Kept."]);
  });
});

describe("the quiet days", () => {
  it("falls back to something that was true back then", () => {
    const out = on("2026-08-06", [], [
      { category: "food", value: "strawberries, checked personally", monthsOld: 9 },
    ]);
    expect(out.kind).toBe("little_thing");
    expect(out.littleThing?.value).toContain("strawberries");
  });

  it("leaves a recent little thing alone, because it hasn't had time to change", () => {
    const out = on("2026-08-06", [], [{ category: "food", value: "strawberries", monthsOld: 2 }]);
    expect(out.kind).toBe("quiet");
    expect(STALE_LITTLE_THING_MONTHS).toBeGreaterThan(2);
  });

  it("says so plainly instead of padding the day out", () => {
    const out = on("2026-08-06", []);
    expect(out.kind).toBe("quiet");
    expect(out.memories).toEqual([]);
    expect(worthSending(out)).toBe(false);
  });
});

describe("how it behaves day to day", () => {
  it("gives the same answer twice for the same day", () => {
    // A parent who sees something, shows someone, and refreshes must not
    // find it replaced.
    const many = Array.from({ length: 12 }, (_, i) => memory({ id: `m${i}`, date: "2025-08-06" }));
    const a = on("2026-08-06", many);
    const b = on("2026-08-06", many);
    expect(a.memories.map((m) => m.id)).toEqual(b.memories.map((m) => m.id));
  });

  it("moves on to something else the next day", () => {
    // All on the same date deliberately: with different dates this would
    // pass because different memories *matched*, not because the choice
    // rotated, and the rotation is the thing being tested.
    const many = Array.from({ length: 12 }, (_, i) => memory({ id: `m${i}`, date: "2025-08-06" }));
    const a = on("2026-08-06", many);
    const b = on("2026-08-07", many);
    expect(a.memories).toHaveLength(MAX_SHOWN);
    expect(b.memories).toHaveLength(MAX_SHOWN);
    expect(a.memories.map((m) => m.id)).not.toEqual(b.memories.map((m) => m.id));
  });

  it("shows a few at most, so it stays a moment rather than a list", () => {
    const many = Array.from({ length: 30 }, (_, i) => memory({ id: `m${i}`, date: "2025-08-06" }));
    expect(on("2026-08-06", many).memories.length).toBe(MAX_SHOWN);
  });
});

describe("the email version", () => {
  it("never carries the archive's words in it", () => {
    // Same rule as the prompt engine: email passes through a third party and
    // sits in an inbox for ever, so it points at the thing rather than
    // carrying it.
    const out = on("2026-08-06", [], [
      { category: "food", value: "strawberries, checked personally", monthsOld: 9 },
    ]);
    expect(out.headline).toMatch(/months ago/);
    expect(out.emailHeadline).not.toContain("strawberries");
  });
});
