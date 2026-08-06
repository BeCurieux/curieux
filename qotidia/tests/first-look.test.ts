// The first ten minutes.
//
// This is the screen that decides whether somebody thinks Qotidia is an
// archivist or a folder, so the tests are mostly about restraint: what it
// declines to say when there is not enough, and the fact that every line it
// does say is a count or a date rather than a claim about a child.

import { describe, expect, it } from "vitest";
import { ENOUGH_TO_NOTICE, firstLook, habitualDay } from "@/lib/graph/first-look";
import { ageWhen, firstAppearedAt, type Entity } from "@/lib/graph/presence";

/** Sundays running back from a known Sunday. */
const sundays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = Date.parse("2026-08-02T00:00:00Z") - i * 7 * 86_400_000;
    return new Date(t).toISOString().slice(0, 10);
  });

const entity = (over: Partial<Entity> & { id: string; dates: string[] }): Entity => ({
  kind: "thing",
  label: "Bun Bun",
  id: over.id,
  mentions: over.dates.map((date, i) => ({ memoryId: `${over.id}-${i}`, date })),
  ...(over.kind ? { kind: over.kind } : {}),
  ...(over.label ? { label: over.label } : {}),
});

const look = (entities: Entity[], over: Partial<Parameters<typeof firstLook>[0]> = {}) =>
  firstLook({ entities, memoriesWithWords: new Set(), memoryCount: 40, ...over });

describe("a weekday habit", () => {
  it("finds the day a person keeps landing on", () => {
    const grandma = entity({ id: "person:Grandma", kind: "person", label: "Grandma", dates: sundays(6) });
    expect(habitualDay(grandma)?.day).toBe("Sunday");
  });

  it("says nothing when the days are scattered", () => {
    const dates = ["2026-08-02", "2026-08-04", "2026-08-06", "2026-08-11", "2026-08-14", "2026-08-19"];
    expect(habitualDay(entity({ id: "x", dates }))).toBeNull();
  });

  it("will not call two of four a habit", () => {
    // Two photographs on two Thursdays is a coincidence with a nice name.
    // This passed at exactly one half, so every four-mention entity in the
    // archive was ranked as a routine and outranked the child's own words.
    const dates = ["2026-08-06", "2026-08-13", "2026-08-15", "2026-08-19"];
    expect(habitualDay(entity({ id: "x", dates }))).toBeNull();
  });

  it("will not call three appearances a habit", () => {
    // Three photographs on three Sundays is a fortnight, not a routine — and
    // a product that announces it has performed insight rather than had any.
    expect(habitualDay(entity({ id: "x", dates: sundays(3) }))).toBeNull();
  });
});

describe("how old they were", () => {
  it("counts in months while a parent still would", () => {
    expect(ageWhen("2024-02-06", "2025-04-06")).toBe("14 months old");
  });

  it("switches to years once months stop being how anybody says it", () => {
    // And keeps the unit. A bare "4" dropped into a sentence reads as a
    // count of something, which is what "starting at 2" looked like on the
    // real page.
    expect(ageWhen("2022-08-06", "2026-08-06")).toBe("4 years old");
  });

  it("stays vague about a newborn rather than implying precision it hasn't got", () => {
    expect(ageWhen("2026-08-01", "2026-08-06")).toBe("a few weeks old");
  });

  it("refuses a date before they were born instead of returning a negative age", () => {
    expect(ageWhen("2026-08-06", "2024-01-01")).toBeNull();
  });

  it("anchors an entity to its first appearance", () => {
    const boots = entity({ id: "thing:boots", dates: ["2025-10-04", "2025-04-06", "2026-01-09"] });
    expect(firstAppearedAt(boots, "2024-02-06")).toBe("14 months old");
  });
});

describe("what it says on first sight", () => {
  it("leads with the weekday habit over the bigger pile", () => {
    // A product that leads with its largest count tells a parent what they
    // already know. Sundays at Grandma's is the one they haven't put into
    // words.
    const out = look([
      entity({ id: "thing:boots", label: "the yellow boots", dates: Array.from({ length: 20 }, (_, i) => `2026-0${(i % 8) + 1}-1${i % 9}`) }),
      entity({ id: "person:Grandma", kind: "person", label: "Grandma", dates: sundays(6) }),
    ]);
    expect(out.observations[0].line).toBe("Grandma turns up most Sundays.");
  });

  it("anchors a long-running thing to how old they were", () => {
    const out = look(
      [entity({ id: "thing:boots", label: "the yellow boots", dates: ["2025-04-06", "2025-08-01", "2025-12-20", "2026-02-14"] })],
      { dateOfBirth: "2024-02-06", pronouns: "she/her", archiveStart: "2024-06-01" }
    );
    expect(out.observations[0].line).toBe(
      "the yellow boots — in 4 of these, starting when she was 14 months old."
    );
  });

  it("uses they/them when nobody said otherwise", () => {
    const out = look(
      [entity({ id: "thing:boots", label: "the yellow boots", dates: ["2025-04-06", "2025-08-01", "2025-12-20", "2026-02-14"] })],
      { dateOfBirth: "2024-02-06", archiveStart: "2024-06-01" }
    );
    expect(out.observations[0].line).toContain("when they were");
  });

  it("will not claim a beginning it only inherited from the archive", () => {
    // The rabbit is in the first photograph we hold. That tells us when our
    // records start, not when the rabbit started — and asserting the second
    // is the same failure as inventing a memory, only harder to spot because
    // it sounds like arithmetic.
    const out = look(
      [entity({ id: "thing:boots", label: "the yellow boots", dates: ["2025-04-06", "2025-08-01", "2025-12-20", "2026-02-14"] })],
      { dateOfBirth: "2024-02-06", pronouns: "she/her", archiveStart: "2025-04-06" }
    );
    expect(out.observations[0].line).not.toContain("starting when");
    expect(out.observations[0].line).toBe(
      "the yellow boots — in 4 of these, from April 2025 to February."
    );
  });

  it("puts the child's own words above anything counted from photographs", () => {
    // A parent can scroll back and see the boots. They cannot scroll back
    // and hear this.
    const out = look([
      entity({ id: "thing:boots", label: "the yellow boots", dates: ["2025-04-06", "2025-08-01", "2025-12-20", "2026-02-14"] }),
      entity({ id: "phrase:i do it", kind: "phrase", label: "I do it", dates: ["2026-01-01", "2026-02-01", "2026-03-01"] }),
    ]);
    expect(out.observations[0].line).toBe("“I do it” — 3 times.");
  });

  it("ranks a thing by what its sentence will actually say", () => {
    // A weekday pattern on a pair of boots still produces a sentence about
    // boots. Ranking it as a routine put the dullest line in the best slot.
    const thursdays = ["2026-05-07", "2026-05-14", "2026-05-21", "2026-05-28", "2026-06-04", "2026-06-11"];
    const out = look([
      entity({ id: "thing:boots", label: "the yellow boots", dates: thursdays }),
      entity({ id: "phrase:i do it", kind: "phrase", label: "I do it", dates: ["2026-01-01", "2026-02-01", "2026-03-01"] }),
    ]);
    expect(out.observations[0].line).toBe("“I do it” — 3 times.");
  });

  it("quotes a phrase rather than describing it", () => {
    const out = look([
      entity({ id: "phrase:i do it", kind: "phrase", label: "I do it", dates: ["2026-01-01", "2026-02-01", "2026-03-01"] }),
    ]);
    expect(out.observations[0].line).toBe("“I do it” — 3 times.");
  });

  it("says nothing at all about an archive too small to have a shape", () => {
    // Three photographs from one afternoon are not a pattern, and a first
    // impression built on one is a promise the product cannot keep in week
    // two.
    const out = look([entity({ id: "person:Grandma", kind: "person", dates: sundays(6) })], { memoryCount: 5 });
    expect(out.observations).toEqual([]);
    expect(ENOUGH_TO_NOTICE).toBe(12);
  });

  it("never says two things about the same photographs", () => {
    // The same afternoon carries a tag, a place and three runs of a quote.
    const dates = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"];
    const shared = dates.map((date, i) => ({ memoryId: `m${i}`, date }));
    const out = look([
      { id: "thing:beach", kind: "thing", label: "beach", mentions: shared },
      { id: "place:Cornwall", kind: "place", label: "Cornwall", mentions: shared },
    ]);
    expect(out.observations).toHaveLength(1);
  });

  it("asks at most three questions", () => {
    const people = Array.from({ length: 6 }, (_, i) =>
      entity({ id: `person:p${i}`, kind: "person", label: `Person ${i}`, dates: sundays(6) })
    );
    expect(look(people, { memoriesWithWords: new Set() }).questions.length).toBeLessThanOrEqual(3);
  });
});
