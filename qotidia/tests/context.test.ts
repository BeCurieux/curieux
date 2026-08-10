// Asking about the rabbit.
//
// Most of these are about restraint. The engine has to ask about things that
// genuinely recur and stay quiet about everything else, because a question
// asked on thin evidence is worse than no question: it spends the family's
// patience, and it makes a product that claims to be paying attention look
// like one that is pattern-matching.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contextQuestions, looksFiled, nextQuestion, questionKey, weekdayLean,
} from "@/lib/graph/context";
import type { Entity } from "@/lib/graph/presence";

const TODAY = "2027-06-01";

/** n mentions ending `endingDaysAgo` before today, `everyDays` apart. */
function thing(
  id: string,
  label: string,
  opts: { n: number; everyDays?: number; endingDaysAgo?: number; kind?: Entity["kind"] }
): Entity {
  const every = opts.everyDays ?? 14;
  const end = opts.endingDaysAgo ?? 0;
  const base = Date.parse(`${TODAY}T00:00:00Z`) - end * 86_400_000;
  return {
    id,
    kind: opts.kind ?? "thing",
    label,
    mentions: Array.from({ length: opts.n }, (_, i) => ({
      memoryId: `${id}-m${i}`,
      date: new Date(base - (opts.n - 1 - i) * every * 86_400_000).toISOString().slice(0, 10),
    })),
  };
}

/** n mentions all falling on the same weekday, spread over `overDays`. */
function everyWeek(id: string, label: string, n: number, weekday = 6): Entity {
  // Walk back from a known Saturday. 2027-05-29 is a Saturday.
  const anchor = Date.parse("2027-05-29T00:00:00Z") - ((6 - weekday + 7) % 7) * 86_400_000;
  return {
    id,
    kind: "thing",
    label,
    mentions: Array.from({ length: n }, (_, i) => ({
      memoryId: `${id}-m${i}`,
      date: new Date(anchor - i * 21 * 86_400_000).toISOString().slice(0, 10),
    })),
  };
}

describe("the rabbit that stopped", () => {
  it("asks what happened when a fixture goes quiet", () => {
    const bunBun = thing("thing:bun_bun", "bun_bun", { n: 20, everyDays: 30, endingDaysAgo: 200 });
    const q = contextQuestions([bunBun], TODAY).find((x) => x.wondering === "what_happened");
    expect(q).toBeTruthy();
    expect(q!.because).toMatch(/hasn't appeared for/);
  });

  it("asks it before anything else", () => {
    // The only question here with a deadline. "What was it called" gets the
    // same answer next year; "why did it stop" gets a worse one every month.
    const faded = thing("thing:bun_bun", "bun_bun", { n: 20, everyDays: 30, endingDaysAgo: 200 });
    const filed = thing("thing:swimming", "swimming", { n: 12, everyDays: 14 });
    expect(nextQuestion([filed, faded], TODAY)!.wondering).toBe("what_happened");
  });

  it("leaves room for 'it just stopped'", () => {
    // Things stop for reasons a family may not want to write down. The
    // question must not assume there is a story.
    const faded = thing("thing:bun_bun", "bun_bun", { n: 20, everyDays: 30, endingDaysAgo: 200 });
    const q = contextQuestions([faded], TODAY).find((x) => x.wondering === "what_happened")!;
    expect(q.ask).toMatch(/or did it just stop/i);
    expect(q.placeholder).toMatch(/just stopped/i);
  });

  it("says nothing about something that is still going", () => {
    const current = thing("thing:swimming", "swimming", { n: 20, everyDays: 14, endingDaysAgo: 2 });
    expect(
      contextQuestions([current], TODAY).some((q) => q.wondering === "what_happened")
    ).toBe(false);
  });
});

describe("what is it, though", () => {
  it("asks about a filing label", () => {
    const q = contextQuestions([thing("thing:bun_bun", "bun_bun", { n: 9 })], TODAY);
    expect(q.some((x) => x.wondering === "what_is_it")).toBe(true);
  });

  it("does not ask about something already written as a name", () => {
    // "Bun Bun" was typed by a person. We know what it is called; asking
    // again is the product admitting it does not read its own archive.
    const q = contextQuestions([thing("thing:bun bun", "Bun Bun", { n: 9 })], TODAY);
    expect(q.some((x) => x.wondering === "what_is_it")).toBe(false);
  });

  it("knows a tag key from a name", () => {
    expect(looksFiled("bun_bun")).toBe(true);
    expect(looksFiled("swimming")).toBe(true);
    expect(looksFiled("Bun Bun")).toBe(false);
    expect(looksFiled("the yellow boots")).toBe(false);
    expect(looksFiled("Nanna")).toBe(false);
  });

  it("asks for the meaning, not just the noun", () => {
    // The name is nice. "She couldn't sleep without him" is the archive.
    const q = contextQuestions([thing("thing:bun_bun", "bun_bun", { n: 9 })], TODAY)
      .find((x) => x.wondering === "what_is_it")!;
    expect(q.ask).toMatch(/what was it to them/i);
  });
});

describe("same day, again", () => {
  it("notices a thing that lands on one weekday", () => {
    const saturdays = everyWeek("thing:cafe", "cafe", 8);
    const q = contextQuestions([saturdays], TODAY).find((x) => x.wondering === "was_it_a_ritual");
    expect(q).toBeTruthy();
    expect(q!.because).toMatch(/Saturday/);
  });

  it("stays quiet about a mild weekend lean", () => {
    // Every family photographs more at weekends. A simple majority would
    // find a "ritual" in every entity in the archive.
    const mixed: Entity = {
      id: "thing:park",
      kind: "thing",
      label: "park",
      mentions: [
        "2027-01-02", "2027-01-09", "2027-01-16", // Saturdays
        "2027-01-20", "2027-02-03", "2027-03-10", // midweek
        "2027-04-14", "2027-05-05",
      ].map((date, i) => ({ memoryId: `p${i}`, date })),
    };
    expect(
      contextQuestions([mixed], TODAY).some((q) => q.wondering === "was_it_a_ritual")
    ).toBe(false);
  });

  it("stays quiet about a holiday", () => {
    // Five Saturdays in a fortnight is a trip. Five across eight months is
    // a Saturday thing.
    const holiday: Entity = {
      id: "thing:beach",
      kind: "thing",
      label: "beach",
      mentions: ["2027-05-01", "2027-05-08", "2027-05-15", "2027-05-22", "2027-05-29"].map(
        (date, i) => ({ memoryId: `b${i}`, date })
      ),
    };
    expect(
      contextQuestions([holiday], TODAY).some((q) => q.wondering === "was_it_a_ritual")
    ).toBe(false);
  });

  it("counts the weekday correctly", () => {
    const lean = weekdayLean(everyWeek("x", "x", 6));
    expect(lean!.day).toBe(6);
    expect(lean!.count).toBe(6);
    expect(lean!.share).toBe(1);
  });
});

describe("restraint", () => {
  it("says nothing about a coincidence", () => {
    expect(contextQuestions([thing("thing:hat", "hat", { n: 3 })], TODAY)).toEqual([]);
  });

  it("never asks what a person is", () => {
    // "What is it?" about a grandmother is grotesque, and who she is belongs
    // to identity.ts.
    const person = thing("person:margaret", "margaret", { n: 30, kind: "person" });
    expect(contextQuestions([person], TODAY)).toEqual([]);
  });

  it("asks one at a time", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      thing(`thing:t${i}`, `tag_${i}`, { n: 9 })
    );
    expect(contextQuestions(many, TODAY).length).toBeGreaterThan(1);
    expect(nextQuestion(many, TODAY)).toBeTruthy();
  });

  it("never asks the same question twice", () => {
    const bunBun = thing("thing:bun_bun", "bun_bun", { n: 20, everyDays: 30, endingDaysAgo: 200 });
    const first = nextQuestion([bunBun], TODAY)!;
    const settled = new Set([questionKey(first.entityId, first.wondering)]);
    const second = nextQuestion([bunBun], TODAY, settled);
    expect(second?.wondering).not.toBe(first.wondering);
  });

  it("stops entirely once everything is settled", () => {
    const bunBun = thing("thing:bun_bun", "bun_bun", { n: 20, everyDays: 30, endingDaysAgo: 200 });
    const all = contextQuestions([bunBun], TODAY);
    const settled = new Set(all.map((q) => questionKey(q.entityId, q.wondering)));
    expect(nextQuestion([bunBun], TODAY, settled)).toBeNull();
  });

  it("prefers the question with more behind it", () => {
    const small = thing("thing:a_tag", "a_tag", { n: 5 });
    const big = thing("thing:b_tag", "b_tag", { n: 30 });
    const first = contextQuestions([small, big], TODAY)[0];
    expect(first.entityId).toBe("thing:b_tag");
  });
});

describe("the questions never make a claim", () => {
  const all = () => {
    const faded = thing("thing:bun_bun", "bun_bun", { n: 20, everyDays: 30, endingDaysAgo: 200 });
    const saturdays = everyWeek("thing:cafe", "cafe", 8);
    return contextQuestions([faded, saturdays], TODAY);
  };

  it("states arithmetic and asks, rather than asserting", () => {
    // "Twenty-three of these fall on a Saturday" is a fact about the
    // archive. "Saturdays were special for you" is a claim about a family,
    // and a question containing one is a slower way of inventing a memory.
    for (const q of all()) {
      expect(q.because).toMatch(/\d/);
      expect(q.because).not.toMatch(/\b(loved|favourite|special|adored|treasured|meant a lot)\b/i);
      expect(q.ask).not.toMatch(/\b(loved|favourite|special|adored)\b/i);
    }
  });

  it("carries the memories it was computed from", () => {
    for (const q of all()) expect(q.memoryIds.length).toBeGreaterThan(0);
  });

  it("offers no example answer to copy", () => {
    // A placeholder reading "Bun Bun — she couldn't sleep without him" gets
    // that answer back, in somebody else's words, about a different child.
    for (const q of all()) {
      expect(q.placeholder).not.toMatch(/bun bun/i);
      expect(q.placeholder.length).toBeLessThan(60);
    }
  });
});

describe("what the answer is stored with", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/0024_context.sql", import.meta.url), "utf8");

  it("keeps the question beside the answer", () => {
    // "It just stopped" is uninterpretable in five years without the
    // sentence it was answering.
    expect(migration).toMatch(/because\s+text/);
  });

  it("stores a skip rather than leaving a gap", () => {
    expect(migration).toMatch(/skipped\s+boolean/);
    expect(migration).toContain("unique (family_id, entity_key, wondering)");
  });

  it("refuses a settled row that says nothing at all", () => {
    expect(migration).toContain("entity_context_said_something");
  });

  it("lets a grandmother answer, not only the owner", () => {
    // She is the one who knows what the rabbit was called.
    expect(migration).toContain("can_edit_family(family_id)");
  });
});

describe("the sentences read like English", () => {
  // "The yellow boots is back" and "Bun Bun is in 4 times across 5 months"
  // are the same bug twice: a phrase helper used in a grammar it does not
  // fit. Both were found by reading a rendered page, not by a test — so
  // these exist to stop the third one.
  const sentences = () => {
    const cases: Entity[] = [
      thing("thing:a", "Bun Bun", { n: 4, everyDays: 40, endingDaysAgo: 210 }),
      thing("thing:b", "Bun Bun", { n: 1 + 20, everyDays: 30, endingDaysAgo: 400 }),
      thing("thing:c", "hat_tag", { n: 9 }),
      everyWeek("thing:d", "cafe", 9),
      // One month exactly, and one memory — the two places a naive template
      // produces "1 months" and "1 memories".
      thing("thing:e", "boots", { n: 5, everyDays: 6, endingDaysAgo: 200 }),
    ];
    return cases.flatMap((c) => contextQuestions([c], TODAY)).map((q) => q.because);
  };

  it("never says a number followed by the wrong noun", () => {
    for (const s of sentences()) {
      expect(s, s).not.toMatch(/\bis in \d+ times\b/);
      expect(s, s).not.toMatch(/\b1 (months|memories|times)\b/);
      expect(s, s).not.toMatch(/\b(one) (months|memories)\b/);
    }
  });

  it("counts memories as memories and taggings as times", () => {
    const faded = contextQuestions(
      [thing("thing:a", "Bun Bun", { n: 4, everyDays: 40, endingDaysAgo: 210 })], TODAY
    ).find((q) => q.wondering === "what_happened")!;
    expect(faded.because).toMatch(/four memories/);

    const filed = contextQuestions([thing("thing:c", "hat_tag", { n: 9 })], TODAY)
      .find((q) => q.wondering === "what_is_it")!;
    expect(filed.because).toMatch(/9 times/);
  });

  it("ends every observation with a full stop", () => {
    for (const s of sentences()) expect(s.endsWith(".")).toBe(true);
  });
});

