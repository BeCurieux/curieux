// Applying what the family told us.
//
// The bug this module exists to avoid is subtle and would have been shipped:
// merging two names a family uses interchangeably makes their mention counts
// add up, and a memory tagged with both names gets counted twice. The weekly
// note would then announce a surge that was an administrative event — the
// product claiming to have noticed something that did not happen, which is
// worse than noticing nothing.

import { describe, expect, it } from "vitest";
import { applyResolutions, type Resolution } from "@/lib/graph/resolve";
import { noticeThisWeek } from "@/lib/graph/notice";
import type { Entity } from "@/lib/graph/presence";

const at = (memoryId: string, date: string) => ({ memoryId, date });

const mimi: Entity = {
  id: "person:mimi",
  kind: "person",
  label: "Mimi",
  mentions: [at("m1", "2026-03-01"), at("m2", "2026-03-08"), at("shared", "2026-03-15")],
};

const sue: Entity = {
  id: "person:grandma sue",
  kind: "person",
  label: "Grandma Sue",
  mentions: [at("s1", "2026-04-01"), at("shared", "2026-03-15")],
};

const oneGrandmother: Resolution = {
  id: "11110000-0000-0000-0000-00000000000b",
  label: "Grandma Sue",
  keys: ["person:mimi", "person:grandma sue"],
};

describe("one grandmother", () => {
  it("becomes a single thread with a durable id", () => {
    const out = applyResolutions([mimi, sue], [oneGrandmother]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(oneGrandmother.id);
    expect(out[0].label).toBe("Grandma Sue");
  });

  it("counts a memory tagged with both names once", () => {
    // Four distinct memories, not five. This is the whole reason the merge
    // is keyed by memory id.
    const out = applyResolutions([mimi, sue], [oneGrandmother]);
    expect(out[0].mentions).toHaveLength(4);
    expect(new Set(out[0].mentions.map((m) => m.memoryId)).size).toBe(4);
  });

  it("does not manufacture a surge out of an answered question", () => {
    // The failure this prevents, end to end. If resolving inflated the
    // counts, the next weekly note would report a burst of Grandma Sue in a
    // week where nothing happened — the product asserting something about a
    // family that is not true.
    const today = "2026-03-16";
    const before = noticeThisWeek({ today, entities: [mimi, sue] });
    const after = noticeThisWeek({ today, entities: applyResolutions([mimi, sue], [oneGrandmother]) });
    for (const line of after) {
      expect(line.line).not.toMatch(/3 times|4 times|5 times/);
    }
    expect(after.length).toBeLessThanOrEqual(before.length);
  });

  it("takes the family's chosen name, not the most frequent spelling", () => {
    // Mimi has more mentions. Grandma Sue is what they said to call her.
    const out = applyResolutions([mimi, sue], [oneGrandmother]);
    expect(out[0].label).toBe("Grandma Sue");
  });
});

describe("what it leaves alone", () => {
  it("passes through anything nobody has ruled on", () => {
    const boots: Entity = {
      id: "thing:the yellow boots",
      kind: "thing",
      label: "the yellow boots",
      mentions: [at("b1", "2026-03-02")],
    };
    const out = applyResolutions([mimi, sue, boots], [oneGrandmother]);
    expect(out.map((e) => e.id)).toContain("thing:the yellow boots");
    expect(out).toHaveLength(2);
  });

  it("ignores a resolution about people this book does not contain", () => {
    // A family resolves everybody once; a single year's book contains a
    // subset. A resolution naming absent keys is normal, not an error.
    const out = applyResolutions([mimi], [oneGrandmother]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(oneGrandmother.id);
    expect(out[0].mentions).toHaveLength(3);
  });

  it("returns the graph untouched when nothing has been resolved", () => {
    expect(applyResolutions([mimi, sue], [])).toEqual([mimi, sue]);
  });

  it("does not mutate what it was given", () => {
    // The same entity list is reused across a book build and a weekly note.
    const originally = mimi.mentions.length;
    applyResolutions([mimi, sue], [oneGrandmother]);
    expect(mimi.mentions).toHaveLength(originally);
  });

  it("still sorts by how much of it there is", () => {
    const many: Entity = {
      id: "thing:bun bun",
      kind: "thing",
      label: "Bun Bun",
      mentions: Array.from({ length: 9 }, (_, i) => at(`x${i}`, "2026-02-01")),
    };
    const out = applyResolutions([mimi, sue, many], [oneGrandmother]);
    expect(out[0].label).toBe("Bun Bun");
  });
});
