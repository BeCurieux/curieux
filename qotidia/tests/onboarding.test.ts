// The first five minutes.
//
// A cold import: several hundred photographs and nothing typed. The graph is
// empty, so everything here runs on timestamps — which means the risk is not
// that it says something dull, it is that it says something confident and
// wrong to a family who are deciding whether to trust us with eighteen
// years. Most of these tests are about staying quiet.

import { readFileSync } from "node:fs";
import { dateList, dateRange } from "@/lib/words";
import { describe, expect, it } from "vitest";
import {
  discoveries, hasClockTimes, looksFake, type Shot,
} from "@/lib/onboarding/discover";
import {
  MOST_IN_A_STORY, evenly, storyFrom, titleFrom, titleFromCalendar,
} from "@/lib/onboarding/story";

/** n shots on one day, an hour apart, starting at 09:00. */
const aDay = (date: string, n: number, prefix = date): Shot[] =>
  Array.from({ length: n }, (_, i) => {
    // Spread across 09:00–17:00 whatever n is. An earlier version marched an
    // hour per two shots and produced "T48:00" for a busy day, which parsed
    // as NaN and silently changed what the test was exercising.
    const minutes = 9 * 60 + Math.round((i / Math.max(1, n - 1)) * 8 * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return { id: `${prefix}-${i}`, at: `${date}T${hh}:${mm}:00.000Z` };
  });

/** One shot a day for n days from a start date. */
const daysFrom = (start: string, n: number): Shot[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `run-${i}`,
    at: new Date(Date.parse(`${start}T10:00:00Z`) + i * 86_400_000).toISOString(),
  }));

/** One shot every 7 days, so every one lands on the same weekday. */
const everyWeek = (start: string, n: number): Shot[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `wk-${i}`,
    at: new Date(Date.parse(`${start}T10:00:00Z`) + i * 7 * 86_400_000).toISOString(),
  }));

describe("staying quiet", () => {
  it("says nothing about a handful of photographs", () => {
    // Five snaps is not a year. A product that produces "a story I found"
    // from five photographs has told the customer what it is worth.
    expect(discoveries(aDay("2027-03-14", 5))).toEqual([]);
  });

  it("says nothing when every timestamp is identical", () => {
    // A batch import that lost its metadata. Announcing a remarkable
    // afternoon that did not happen is the worst possible first impression.
    const same: Shot[] = Array.from({ length: 60 }, (_, i) => ({
      id: `s${i}`,
      at: "2027-03-14T09:00:00.000Z",
    }));
    expect(looksFake(same)).toBe(true);
    expect(discoveries(same)).toEqual([]);
  });

  it("says nothing when hundreds of files share one date", () => {
    // The signature of a card copied off a camera with a dead clock.
    const oneDay = aDay("2027-03-14", 80);
    expect(looksFake(oneDay)).toBe(true);
    expect(discoveries(oneDay)).toEqual([]);
  });

  it("ignores unparseable dates rather than guessing at them", () => {
    const messy: Shot[] = [
      ...aDay("2027-03-14", 8),
      { id: "bad", at: "not a date" },
    ];
    const found = discoveries(messy);
    expect(found.length).toBeGreaterThan(0);
    expect(found.flatMap((d) => d.shotIds)).not.toContain("bad");
  });
});

describe("a day with a lot in it", () => {
  const batch = [...aDay("2027-03-13", 9), ...daysFrom("2027-04-01", 40)];

  it("is found, and named by its weekday", () => {
    const day = discoveries(batch).find((d) => d.finding === "a_day")!;
    expect(day).toBeTruthy();
    expect(day.because).toMatch(/Saturday 13 March/);
    expect(day.because).toMatch(/9 photographs/);
  });

  it("outranks everything else, because it is the one that lands", () => {
    // Nobody has forgotten what their child looks like. Everybody has
    // forgotten which Saturday.
    expect(discoveries(batch)[0].finding).toBe("a_day");
  });

  it("says how long the day lasted when the files carry a clock", () => {
    const day = discoveries(batch).find((d) => d.finding === "a_day")!;
    expect(day.because).toMatch(/hours|an hour|under an hour/);
  });

  it("says nothing about hours when every file is stamped midnight", () => {
    // takenOn() keeps only the date and writes midnight, so this is the
    // common case, not an edge one. "One Saturday morning" is a sentence we
    // cannot support from a date.
    const dateOnly: Shot[] = Array.from({ length: 9 }, (_, i) => ({
      id: `d${i}`,
      at: "2027-03-13T00:00:00.000Z",
    })).map((s, i) => ({ ...s, id: `d${i}` }));
    const spread = [...dateOnly, ...daysFrom("2027-04-01", 40).map((s) => ({
      ...s, at: `${s.at.slice(0, 10)}T00:00:00.000Z`,
    }))];
    expect(hasClockTimes(spread)).toBe(false);
    const day = discoveries(spread).find((d) => d.finding === "a_day");
    expect(day?.because).not.toMatch(/hour/);
  });
});

describe("the other shapes", () => {
  it("finds a stretch of days with something on most of them", () => {
    const run = [...daysFrom("2027-07-01", 11), ...aDay("2027-01-05", 7, "jan")];
    const found = discoveries(run).find((d) => d.finding === "a_run");
    expect(found).toBeTruthy();
    expect(found!.because).toMatch(/Something on \d+ of \d+ days/);
  });

  it("finds a weekday habit across months", () => {
    const found = discoveries(everyWeek("2027-01-02", 14)).find(
      (d) => d.finding === "a_weekday"
    );
    expect(found).toBeTruthy();
    expect(found!.because).toMatch(/Saturday/);
  });

  it("finds a long silence, and does not demand an explanation for it", () => {
    // A quiet stretch is usually a new baby, an illness, a separation, or a
    // full phone. "Why?" is the wrong question to put to any of those.
    const split = [...daysFrom("2027-01-01", 120), ...daysFrom("2027-07-01", 120)];
    const gap = discoveries(split).find((d) => d.finding === "a_gap");
    expect(gap).toBeTruthy();
    expect(gap!.ask).not.toMatch(/why/i);
    expect(gap!.ask).toMatch(/worth adding/i);
  });

  it("carries no photographs for a gap, because there are none", () => {
    const split = [...daysFrom("2027-01-01", 120), ...daysFrom("2027-07-01", 120)];
    const gap = discoveries(split).find((d) => d.finding === "a_gap")!;
    expect(gap.shotIds).toEqual([]);
  });

  it("frames the whole batch without asking anything about it", () => {
    const span = discoveries(daysFrom("2027-01-01", 200)).find((d) => d.finding === "a_span")!;
    expect(span.ask).toBeNull();
    expect(span.because).toMatch(/months/);
  });
});

describe("every sentence is checkable", () => {
  const all = () =>
    discoveries([
      ...aDay("2027-03-13", 9),
      ...daysFrom("2027-04-01", 40),
      ...daysFrom("2027-09-01", 20),
    ]);

  it("states arithmetic and never a claim about the family", () => {
    for (const d of all()) {
      expect(d.because).toMatch(/\d/);
      expect(d.because).not.toMatch(
        /\b(loved|favourite|special|happy|magical|precious|adventure|joy)\b/i
      );
    }
  });

  it("asks questions that can be answered in a few words", () => {
    for (const d of all()) {
      if (!d.ask) continue;
      expect(d.ask.length).toBeLessThan(45);
      expect(d.ask).toMatch(/\?$/);
    }
  });
});

describe("the title, which is the whole argument", () => {
  const day = () => discoveries([...aDay("2027-03-13", 9), ...daysFrom("2027-04-01", 40)])[0];

  it("uses the family's own words when they gave any", () => {
    const story = storyFrom({ discovery: day(), answer: "Bun Bun's first swim." })!;
    expect(story.title).toBe("Bun Bun's first swim");
    expect(story.titleFrom).toBe("the family");
  });

  it("falls back to the calendar, which claims nothing", () => {
    const story = storyFrom({ discovery: day(), answer: null })!;
    expect(story.title).toBe("One Saturday in March");
    expect(story.titleFrom).toBe("the calendar");
  });

  it("never invents a title like the one in the brief", () => {
    // "The Summer You Learned to Love the Water" asserts a season, a child's
    // inner state and a change over time, from a system that has seen some
    // timestamps. In the first five minutes, when everything afterwards is
    // being judged against whether the first thing we said was true.
    const source = readFileSync(
      new URL("../src/lib/onboarding/story.ts", import.meta.url), "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const invented of ["Summer", "Learned", "The Year", "Adventures", "Magic"]) {
      expect(source).not.toContain(invented);
    }
  });

  it("takes only the first sentence, and only if it fits", () => {
    expect(titleFrom("Swimming lesson. She cried the whole way there.")!.title)
      .toBe("Swimming lesson");
    expect(
      titleFrom(
        "It was the day we drove all the way to the coast and back again because somebody forgot the bag."
      )
    ).toBeNull();
  });

  it("keeps a question mark, because that is how they wrote it", () => {
    expect(titleFrom("Her first swim?")!.title).toBe("Her first swim?");
  });

  it("treats an empty answer as no answer", () => {
    expect(titleFrom("   ")).toBeNull();
    expect(titleFrom(null)).toBeNull();
  });

  it("names a span by its years, not by a phrase the subtitle repeats", () => {
    // The span's subtitle already says "…across seven months, January to
    // July". Titling it "January to July" printed the same phrase twice,
    // one directly above the other, on the rendered page.
    const span = discoveries(daysFrom("2027-01-01", 200)).find((d) => d.finding === "a_span")!;
    expect(titleFromCalendar(span)).toBe("2027");
    expect(span.because).not.toContain("2027");
  });

  it("names a span crossing new year by both years", () => {
    const span = discoveries(daysFrom("2027-08-01", 200)).find((d) => d.finding === "a_span")!;
    expect(titleFromCalendar(span)).toBe("2027–2028");
  });
});

describe("the sequence", () => {
  it("keeps the subtitle as the arithmetic, always", () => {
    const day = discoveries([...aDay("2027-03-13", 9), ...daysFrom("2027-04-01", 40)])[0];
    const story = storyFrom({ discovery: day, answer: "Swimming." })!;
    expect(story.subtitle).toBe(day.because);
  });

  it("spreads across the day rather than taking the first twelve", () => {
    // The first twelve photographs of a day are twelve photographs of
    // arriving. An even spread is what makes it read as a story.
    const picked = evenly(Array.from({ length: 100 }, (_, i) => i), 12);
    expect(picked).toHaveLength(12);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(99);
    expect(new Set(picked).size).toBe(12);
  });

  it("leaves a short sequence alone", () => {
    expect(evenly([1, 2, 3], 12)).toEqual([1, 2, 3]);
  });

  it("caps a busy day rather than showing a contact sheet", () => {
    const busy = [...aDay("2027-03-13", 40), ...daysFrom("2027-06-01", 30)];
    const day = discoveries(busy).find((d) => d.finding === "a_day")!;
    const story = storyFrom({ discovery: day, answer: null })!;
    expect(story.shotIds.length).toBeLessThanOrEqual(MOST_IN_A_STORY);
  });

  it("refuses to build a story out of a gap", () => {
    // There are no photographs in a silence, and inventing something to
    // show is the failure this module is written against.
    const split = [...daysFrom("2027-01-01", 120), ...daysFrom("2027-07-01", 120)];
    const gap = discoveries(split).find((d) => d.finding === "a_gap")!;
    expect(storyFrom({ discovery: gap, answer: "We moved house." })).toBeNull();
  });
});

describe("one date format per line", () => {
  it("puts a year on both ends of a range that crosses one", () => {
    // The rendered page said "19 August 2025 – 17 May": friendlyDate drops
    // the year for the current one, so the two ends of a single range came
    // out in different formats.
    const said = dateRange("2025-08-19", "2026-05-17", new Date("2026-06-01"));
    expect(said).toContain("2025");
    expect(said).toContain("2026");
  });

  it("puts a year on neither when they share one", () => {
    expect(dateRange("2026-03-01", "2026-05-17", new Date("2026-06-01")))
      .not.toMatch(/\d{4}/);
  });

  it("collapses a single day to one date", () => {
    expect(dateRange("2026-03-01", "2026-03-01", new Date("2026-06-01")))
      .toBe("1 March");
  });

  it("puts a year on every caption in a set that crosses one", () => {
    // The same fault one dimension out. The evidence grid under an
    // observation printed "27 November 2025", "1 January", "12 February" —
    // three captions in a row, two of them missing the year.
    const said = dateList(
      ["2025-11-27", "2026-01-01", "2026-02-12"],
      new Date("2026-06-01")
    );
    expect(said).toEqual(["27 November 2025", "1 January 2026", "12 February 2026"]);
  });

  it("puts a year on none of them when they all fall in this one", () => {
    const said = dateList(["2026-03-01", "2026-05-17"], new Date("2026-06-01"));
    expect(said).toEqual(["1 March", "17 May"]);
  });

  it("still dates a set that is all in one past year", () => {
    // Consistent is not the same as bare. A grid entirely from last year
    // needs the year, or it reads as this one.
    const said = dateList(["2025-03-01", "2025-05-17"], new Date("2026-06-01"));
    expect(said).toEqual(["1 March 2025", "17 May 2025"]);
  });

  it("keeps the places of anything undated", () => {
    // The captions are positional — they sit under their own thumbnail.
    expect(dateList(["2026-03-01", null, "2026-05-17"], new Date("2026-06-01")))
      .toEqual(["1 March", "", "17 May"]);
  });
});
