// Are these two the same?
//
// The question that turns a pile of tags into a graph. Two things are being
// tested: that it asks about the pairs a person would actually want resolved,
// and — more importantly — that it never asks a question the family has
// already answered. The second is not a nicety. A product that asks twice
// whether Nana and Grandma are the same person has told the family nobody
// was listening the first time, and they are right.

import { describe, expect, it } from "vitest";
import {
  askAbout,
  ESTABLISHED_ENOUGH_TO_ASK,
  oneToAsk,
  pairKey,
  pairsWorthAsking,
} from "@/lib/graph/identity";
import type { Entity, EntityKind } from "@/lib/graph/presence";

let n = 0;
function entity(over: {
  id: string;
  label: string;
  kind?: EntityKind;
  memories?: string[];
  count?: number;
}): Entity {
  const ids = over.memories ?? Array.from({ length: over.count ?? 6 }, () => `m${n++}`);
  return {
    id: over.id,
    kind: over.kind ?? "person",
    label: over.label,
    mentions: ids.map((memoryId, i) => ({ memoryId, date: `2026-0${(i % 9) + 1}-05` })),
  };
}

describe("which pairs are worth asking about", () => {
  it("asks about two names that could be one grandmother", () => {
    const pairs = pairsWorthAsking({
      entities: [entity({ id: "mimi", label: "Mimi" }), entity({ id: "sue", label: "Grandma Sue" })],
    });
    expect(pairs).toHaveLength(1);
    // More-used name first, so the sentence opens with the one they would
    // recognise. Both entities here have six mentions, so it falls back to
    // the order they were given in.
    expect([pairs[0].labelA, pairs[0].labelB].sort()).toEqual(["Grandma Sue", "Mimi"]);
  });

  it("never asks whether a person is a place", () => {
    // The question is embarrassing and the answer is useless.
    const pairs = pairsWorthAsking({
      entities: [
        entity({ id: "nana", label: "Nana", kind: "person" }),
        entity({ id: "nanas", label: "Nana's house", kind: "place" }),
      ],
    });
    expect(pairs).toEqual([]);
  });

  it("leaves alone anything mentioned only a handful of times", () => {
    // A question is a more expensive thing to be wrong about than a line in
    // a weekly note, so the bar is higher than the graph's own.
    const pairs = pairsWorthAsking({
      entities: [
        entity({ id: "a", label: "Bo", count: ESTABLISHED_ENOUGH_TO_ASK - 1 }),
        entity({ id: "b", label: "Bobo", count: ESTABLISHED_ENOUGH_TO_ASK - 1 }),
      ],
    });
    expect(pairs).toEqual([]);
  });

  it("does not ask about a pair the graph has already merged", () => {
    // buildEntities() joins threads covering the same memories. A pair that
    // still looks distinct after that is one it deliberately left alone.
    const shared = ["m1", "m2", "m3", "m4", "m5"];
    const pairs = pairsWorthAsking({
      entities: [
        entity({ id: "a", label: "Bun Bun", kind: "thing", memories: shared }),
        entity({ id: "b", label: "bun bun", kind: "thing", memories: [...shared, "m6"] }),
      ],
    });
    expect(pairs).toEqual([]);
  });

  it("ranks a shared word above two unrelated names", () => {
    // "Grandma Sue" and "Grandma" is a cheap question with a likely yes.
    // "Mimi" and "Grandma Sue" still gets asked — no shared word is not
    // evidence of anything — but it waits its turn.
    const pairs = pairsWorthAsking({
      entities: [
        entity({ id: "sue", label: "Grandma Sue" }),
        entity({ id: "grandma", label: "Grandma" }),
        entity({ id: "mimi", label: "Mimi" }),
      ],
    });
    const top = pairs[0];
    expect([top.labelA, top.labelB].sort()).toEqual(["Grandma", "Grandma Sue"]);
    expect(pairs.some((p) => [p.labelA, p.labelB].includes("Mimi"))).toBe(true);
  });

  it("ranks people above objects", () => {
    const pairs = pairsWorthAsking({
      entities: [
        entity({ id: "t1", label: "Roary", kind: "thing" }),
        entity({ id: "t2", label: "the dinosaur", kind: "thing" }),
        entity({ id: "p1", label: "Mimi", kind: "person" }),
        entity({ id: "p2", label: "Grandma Sue", kind: "person" }),
      ],
    });
    expect(pairs[0].kind).toBe("person");
  });

  it("pushes down two labels that keep appearing in the same photograph", () => {
    // Somebody tagging both names on the same picture again and again is
    // usually describing two things in one frame. Not conclusive, so it
    // sinks rather than disappears.
    const together = ["m1", "m2", "m3", "m4"];
    const pairs = pairsWorthAsking({
      entities: [
        entity({ id: "a", label: "Mimi", memories: [...together, "x1", "x2", "x3"] }),
        entity({ id: "b", label: "Grandad", memories: [...together, "y1", "y2", "y3"] }),
        entity({ id: "c", label: "Sue" }),
        entity({ id: "d", label: "Susan" }),
      ],
    });
    // The assertion is about the co-occurring pair sinking, not about which
    // of the others happens to win — those are separated by a point or two
    // of mention count, and pinning that would be testing arithmetic noise.
    const rank = pairs.findIndex((p) => [p.labelA, p.labelB].sort().join() === "Grandad,Mimi");
    expect(rank).toBeGreaterThan(0);
    expect(pairs[0].sharedMemoryIds).toHaveLength(0);
  });
});

describe("what it has already been told", () => {
  it("never asks a second time, whichever way it was answered", () => {
    const entities = [entity({ id: "mimi", label: "Mimi" }), entity({ id: "sue", label: "Grandma Sue" })];
    expect(oneToAsk({ entities })).not.toBeNull();
    expect(oneToAsk({ entities, settled: [pairKey("mimi", "sue")] })).toBeNull();
  });

  it("treats a pair as one thing whichever order it is given in", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });

  it("has nothing to ask about an archive whose people are all resolved", () => {
    // The common answer, and it must be a comfortable one. Silence is a
    // finished state here, not a failure to find something.
    expect(oneToAsk({ entities: [entity({ id: "solo", label: "Mimi" })] })).toBeNull();
  });
});

describe("the sentence", () => {
  it("states what it counted and asks", () => {
    const pair = oneToAsk({
      entities: [entity({ id: "mimi", label: "Mimi" }), entity({ id: "sue", label: "Grandma Sue" })],
    })!;
    // Counts travel with the labels rather than being passed alongside them,
    // so it is not possible to caption Mimi with Grandma Sue's number.
    expect(askAbout(pair)).toBe(
      "You've mentioned Mimi 6 times and Grandma Sue 6 times. Are they the same person?"
    );
  });

  it("does not pretend to have an opinion", () => {
    // "We think these might be the same" is a hedge, and it is not true —
    // we have no idea, which is the honest reason for asking.
    const pair = oneToAsk({
      entities: [entity({ id: "a", label: "Roary", kind: "thing" }), entity({ id: "b", label: "the dinosaur", kind: "thing" })],
    })!;
    const q = askAbout(pair);
    expect(q).not.toMatch(/we think|probably|might be|looks like|seems/i);
    expect(q).toContain("the same thing");
  });

  it("uses the family's own spelling, never a tidied one", () => {
    const pair = oneToAsk({
      entities: [entity({ id: "a", label: "mrs Wiggles", kind: "thing" }), entity({ id: "b", label: "Wiggles", kind: "thing" })],
    })!;
    expect(askAbout(pair)).toContain("mrs Wiggles");
  });
});
