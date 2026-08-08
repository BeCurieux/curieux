// The memory graph.
//
// Two things are being tested. The arithmetic — because "back after two
// months" has to actually be two months, and a wrong number here is worse
// than silence: it is the product claiming to have noticed something it
// hasn't. And the restraint — because the difference between an archive and
// a surveillance product is entirely in what it declines to say.

import { describe, expect, it } from "vitest";
import {
  byYearOfLife,
  ESTABLISHED_AT,
  gapBeforeReturn,
  peakYear,
  presenceOf,
  shapeOf,
  type Entity,
} from "@/lib/graph/presence";
import { gapsWorthAsking, noticeThisWeek, worthSending } from "@/lib/graph/notice";

const TODAY = "2026-08-06";

/** Dates counting back from today, so fixtures read as "n days ago". */
const ago = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

function entity(over: Partial<Entity> & { id: string; days: number[] }): Entity {
  return {
    kind: "thing",
    label: over.label ?? "Bun Bun",
    id: over.id,
    mentions: over.days.map((d, i) => ({ memoryId: `${over.id}-${i}`, date: ago(d) })),
  };
}

describe("what an entity is doing", () => {
  it("calls a first-ever appearance an arrival", () => {
    expect(shapeOf(entity({ id: "hat", days: [1, 3] }), TODAY)).toBe("arrived");
  });

  it("calls a reappearance after months a return", () => {
    // Twice this week, and before that nothing for four months.
    const e = entity({ id: "boots", days: [1, 4, 130, 140, 150] });
    expect(shapeOf(e, TODAY)).toBe("returned");
  });

  it("measures the silence before a return, not the whole span", () => {
    // The span from first to last mention here is 150 days. The gap that
    // makes it a return is about 126. Reporting the span would tell a parent
    // "back after five months" about something absent for four.
    const e = entity({ id: "boots", days: [1, 4, 130, 140, 150] });
    const gap = gapBeforeReturn(e, TODAY)!;
    expect(gap).toBeGreaterThan(120);
    expect(gap).toBeLessThan(132);
    expect(presenceOf(e, TODAY).spanDays).toBe(149);
  });

  it("does not call two mentions against one a surge", () => {
    // Doubling on tiny numbers is noise, and announcing it weekly is how a
    // product stops being believed.
    const e = entity({ id: "park", days: [2, 9] });
    expect(shapeOf(e, TODAY)).not.toBe("surging");
  });

  it("calls a real jump a surge", () => {
    const e = entity({ id: "hat", days: [1, 2, 3, 5, 10] });
    expect(shapeOf(e, TODAY)).toBe("surging");
  });

  it("notices a fixture that has stopped", () => {
    // The observation nothing else in the product can make.
    const e = entity({ id: "bunbun", days: [120, 130, 140, 150, 160, 170] });
    expect(shapeOf(e, TODAY)).toBe("faded");
  });

  it("does not mourn something that was never really there", () => {
    const e = entity({ id: "hat", days: [200, 210] });
    expect(e.mentions.length).toBeLessThan(ESTABLISHED_AT);
    expect(shapeOf(e, TODAY)).toBe("quiet");
  });

  it("ignores mentions with no usable date rather than guessing", () => {
    const e: Entity = {
      id: "x", kind: "thing", label: "x",
      mentions: [{ memoryId: "a", date: "sometime" }, { memoryId: "b", date: ago(2) }],
    };
    expect(presenceOf(e, TODAY).total).toBe(1);
  });
});

describe("across the years of a life", () => {
  const dob = "2023-08-15";
  // Bun Bun: everywhere in year two, a little in year three, gone by four.
  const bunbun: Entity = {
    id: "bunbun", kind: "thing", label: "Bun Bun",
    mentions: [
      ...["2024-09-01", "2024-11-02", "2025-01-15", "2025-03-20", "2025-06-01"],
      ...["2025-10-05", "2025-12-11"],
    ].map((date, i) => ({ memoryId: `m${i}`, date })),
  };

  it("answers the question a camera roll cannot: when was the rabbit", () => {
    const years = byYearOfLife(bunbun, dob);
    expect(years.find((y) => y.yearNumber === 2)?.count).toBe(5);
    expect(years.find((y) => y.yearNumber === 3)?.count).toBe(2);
    expect(peakYear(bunbun, dob)?.yearNumber).toBe(2);
  });

  it("discards a date before the child was born", () => {
    // A typo, not a memory.
    const wrong: Entity = {
      id: "x", kind: "thing", label: "x",
      mentions: [{ memoryId: "a", date: "2019-01-01" }, { memoryId: "b", date: "2024-09-01" }],
    };
    expect(byYearOfLife(wrong, dob).reduce((n, y) => n + y.count, 0)).toBe(1);
  });
});

describe("the week's three things", () => {
  it("leads with what stopped, not with the biggest number", () => {
    // A product that leads with its largest count tells you what you already
    // know. The one that leads with the absence tells you something you had
    // half-forgotten.
    const out = noticeThisWeek({
      today: TODAY,
      entities: [
        { ...entity({ id: "hat", days: [1, 2, 3, 4, 6] }), label: "The dinosaur hat" },
        { ...entity({ id: "bun", days: [120, 130, 140, 150, 160, 170] }), label: "Bun Bun" },
      ],
    });
    expect(out[0].shape).toBe("faded");
    expect(out[0].line).toContain("Bun Bun");
  });

  it("says the month rather than printing a date", () => {
    // "hasn't appeared since 2026-04-08" is a log line. The eighth is not
    // what anyone remembers, and the month is as precise as an observation
    // about something fading can honestly be.
    const out = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "bun", days: [120, 130, 140, 150, 160, 170] }), label: "Bun Bun" }],
    });
    expect(out[0].line).toBe("Bun Bun last appeared in April.");
  });

  it("includes the year when the thing stopped in a different one", () => {
    const out = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "bun", days: [300, 320, 340, 360, 380, 400] }), label: "Bun Bun" }],
    });
    expect(out[0].line).toBe("Bun Bun last appeared in October 2025.");
  });

  it("quotes the silence in the line, not the whole span", () => {
    // The gap here is about 126 days (four months); the span from first to
    // last mention is 149 (five). Testing gapBeforeReturn directly is not
    // enough — the arithmetic can be right while the sentence reaches for
    // the wrong field, which is exactly the bug this had.
    const out = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "boots", days: [1, 4, 130, 140, 150] }), label: "The yellow boots" }],
    });
    expect(out[0].shape).toBe("returned");
    expect(out[0].line).toContain("4 months ago");
    expect(out[0].line).not.toContain("5 months ago");
  });

  it("starts the sentence with a capital without rewriting the family's word", () => {
    // Tags are typed as filing labels. "the dinosaur hat, 4 times this week"
    // reads as a bug; "The dinosaur hat" reads as a voice.
    const out = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "hat", days: [1, 2, 4, 6, 30, 38] }), label: "the dinosaur hat" }],
    });
    expect(out[0].line).toBe("The dinosaur hat, 4 times this week.");
  });

  it("leaves a name the family capitalised oddly exactly as they typed it", () => {
    const out = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "pad", days: [1, 2, 4, 6, 30, 38] }), label: "iPad time" }],
    });
    expect(out[0].line).toBe("iPad time, 4 times this week.");
  });

  it("says a plural label without breaking the grammar", () => {
    // Found by showing the engine a real fixture for the first time: it
    // produced "The yellow boots is back", because the sentence was built in
    // the present tense and the label is whatever the family typed. Families
    // type plurals constantly — the boots, the stairs, strawberries, garbage
    // trucks — so this is not an edge case, it is most of a house.
    //
    // Every shape is checked, because fixing one sentence and leaving the
    // other three is how this survives a second time.
    const plural = { label: "the yellow boots" };

    const back = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "b", days: [1, 4, 130, 140, 150] }), ...plural }],
    });
    expect(back[0].line).toBe(
      "The yellow boots came back — the time before was 4 months ago."
    );

    const gone = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "g", days: [120, 130, 140, 150, 160, 170] }), ...plural }],
    });
    expect(gone[0].line).toBe("The yellow boots last appeared in April.");

    const isNew = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "n", days: [1, 3] }), ...plural }],
    });
    expect(isNew[0].line).toBe("The yellow boots appeared for the first time.");

    const lots = noticeThisWeek({
      today: TODAY,
      entities: [{ ...entity({ id: "l", days: [1, 2, 4, 6, 30, 38] }), ...plural }],
    });
    expect(lots[0].line).toBe("The yellow boots, 4 times this week.");

    // The failing constructions, named so a rewrite cannot reintroduce them.
    for (const out of [back, gone, isNew, lots]) {
      expect(out[0].line).not.toMatch(/boots (is|has|was|hasn't)\b/);
    }
  });

  it("quotes a child's own sentence without tidying it", () => {
    // The one case where lifting a letter would be a correction rather than
    // a capitalisation: what the child said is a transcript.
    const out = noticeThisWeek({
      today: TODAY,
      entities: [{
        ...entity({ id: "p", days: [1, 2, 4, 6, 30, 38] }),
        kind: "phrase",
        label: "i do it my byself",
      }],
    });
    expect(out[0].line).toContain("“i do it my byself”");
  });

  it("says nothing at all in a week where nothing changed", () => {
    // The weeks where nothing happened are real. A note that arrives anyway
    // with three manufactured lines teaches people to stop opening it.
    const out = noticeThisWeek({ today: TODAY, entities: [entity({ id: "x", days: [200] })] });
    expect(out).toEqual([]);
    expect(worthSending(out)).toBe(false);
  });

  it("never says more than three things", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      entity({ id: `e${i}`, days: [1, 2, 3, 4, 5] })
    );
    expect(noticeThisWeek({ today: TODAY, entities: many }).length).toBe(3);
  });

  it("varies the kind of thing it says", () => {
    const out = noticeThisWeek({
      today: TODAY,
      entities: [
        entity({ id: "a", days: [1, 2, 3, 4, 5] }),
        entity({ id: "b", days: [1, 2, 3, 4, 5] }),
        { ...entity({ id: "c", days: [1, 4, 130, 140, 150] }), label: "The yellow boots" },
      ],
    });
    // Not three near-identical surge lines.
    expect(new Set(out.map((o) => o.shape)).size).toBeGreaterThan(1);
  });

  it("does not repeat what it said last week", () => {
    const e = entity({ id: "hat", days: [1, 2, 3, 4, 5] });
    expect(noticeThisWeek({ today: TODAY, entities: [e], recentlyShown: ["hat"] })).toEqual([]);
  });

  it("carries the memories every line was computed from", () => {
    // The provenance rule, applied here. A line nobody can trace back is an
    // assertion, and this product does not make those.
    const out = noticeThisWeek({ today: TODAY, entities: [entity({ id: "hat", days: [1, 2, 3, 4, 5] })] });
    expect(out[0].memoryIds.length).toBe(5);
  });

  it("counts, and never interprets", () => {
    // The line between an archive and an opinion. No line may say what
    // something meant, whether it was enjoyed, or what a child feels.
    const out = noticeThisWeek({
      today: TODAY,
      entities: [
        { ...entity({ id: "hat", days: [1, 2, 3, 4, 5] }), label: "The dinosaur hat" },
        { ...entity({ id: "bun", days: [120, 130, 140, 150, 160, 170] }), label: "Bun Bun" },
        { ...entity({ id: "act", kind: "phrase", days: [1, 2, 3] }), label: "actually" },
      ],
    });
    for (const o of out) {
      expect(o.line).not.toMatch(/loves|favourite|happy|sad|enjoys|misses|obsessed|clearly|must have/i);
    }
  });
});

describe("what is missing", () => {
  it("asks about a person who is everywhere and described nowhere", () => {
    // Forty photographs of Wednesday at Grandma's and not one sentence about
    // what they do there. That sentence is the thing anybody would want in
    // thirty years, and it will never exist unless something asks.
    const grandma: Entity = {
      id: "grandma", kind: "person", label: "Grandma",
      mentions: Array.from({ length: 12 }, (_, i) => ({ memoryId: `g${i}`, date: ago(i * 7) })),
    };
    const gaps = gapsWorthAsking({ entities: [grandma], memoriesWithWords: new Set(["g0"]) });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].question).toContain("Grandma");
  });

  it("leaves alone a person the family already writes about", () => {
    const dad: Entity = {
      id: "dad", kind: "person", label: "Dad",
      mentions: Array.from({ length: 12 }, (_, i) => ({ memoryId: `d${i}`, date: ago(i * 7) })),
    };
    const described = new Set(dad.mentions.map((m) => m.memoryId));
    expect(gapsWorthAsking({ entities: [dad], memoriesWithWords: described })).toEqual([]);
  });

  it("does not ask about objects, which are usually just furniture", () => {
    const sofa = entity({ id: "sofa", days: [1, 8, 15, 22, 29, 36, 43] });
    expect(gapsWorthAsking({ entities: [sofa], memoriesWithWords: new Set() })).toEqual([]);
  });
});
