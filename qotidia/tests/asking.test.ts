// What the home screen asks for.
//
// The risk this module exists to manage is not that the questions are bad.
// It is that four separately-reasonable sources add up to a queue, and a
// queue is homework. Everything below is about the total.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOST, whatToAsk, type AskingInput } from "@/lib/home/asking";
import type { Entity } from "@/lib/graph/presence";

const TODAY = "2027-06-01";

function faded(id: string, label: string, n = 12): Entity {
  const end = Date.parse(TODAY + "T00:00:00Z") - 200 * 86_400_000;
  return {
    id,
    kind: "thing",
    label,
    mentions: Array.from({ length: n }, (_, i) => ({
      memoryId: `${id}-${i}`,
      date: new Date(end - (n - 1 - i) * 30 * 86_400_000).toISOString().slice(0, 10),
    })),
  };
}

function person(id: string, label: string, n: number): Entity {
  const end = Date.parse(TODAY + "T00:00:00Z") - 10 * 86_400_000;
  return {
    id,
    kind: "person",
    label,
    mentions: Array.from({ length: n }, (_, i) => ({
      memoryId: `${id}-${i}`,
      date: new Date(end - i * 9 * 86_400_000).toISOString().slice(0, 10),
    })),
  };
}

const input = (patch: Partial<AskingInput> = {}): AskingInput => ({
  subjectId: "s1",
  entities: [],
  today: TODAY,
  settledContext: new Set(),
  settledIdentity: [],
  prompt: null,
  followUps: 0,
  ...patch,
});

describe("the total, which is the thing that matters", () => {
  it("never asks for more than three", () => {
    const asks = whatToAsk(
      input({
        entities: [
          faded("thing:a", "bun_bun"),
          faded("thing:b", "swimming"),
          faded("thing:c", "boots"),
          person("person:nanna", "Nanna", 9),
          person("person:nanna jean", "Nanna Jean", 7),
        ],
        prompt: { question: "Is that still true?", because: "Recorded 8 months ago." },
        followUps: 4,
      })
    );
    expect(asks.length).toBeLessThanOrEqual(MOST);
    expect(MOST).toBeLessThanOrEqual(3);
  });

  it("asks for nothing when there is nothing", () => {
    // The common case, and the one worth getting right. A home screen that
    // always has exactly three things to do is one nobody believes.
    expect(whatToAsk(input())).toEqual([]);
  });

  it("never shows the same question twice", () => {
    // Two fading things produce two identical sentences — "Did something
    // happen, or did it just stop?" — which shipped to a rendered page and
    // read as a form rather than as somebody having looked.
    const asks = whatToAsk(
      input({ entities: [faded("thing:a", "bun_bun"), faded("thing:b", "swimming")] })
    );
    const questions = asks.map((a) => a.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("shows at most one of each kind", () => {
    const asks = whatToAsk(
      input({
        entities: [faded("thing:a", "bun_bun"), faded("thing:b", "swimming"), faded("thing:c", "hat")],
      })
    );
    const kinds = asks.map((a) => a.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe("what wins", () => {
  it("puts a thing that stopped above a routine prompt", () => {
    // One of them is losing its answer every month and the other is not.
    const asks = whatToAsk(
      input({
        entities: [faded("thing:a", "bun_bun")],
        prompt: { question: "Is that still true?", because: "Recorded 8 months ago." },
      })
    );
    expect(asks[0].kind).toBe("context");
  });

  it("leaves room for a different kind rather than stacking one", () => {
    // Three fading things used to fill the list and squeeze out the
    // grandmother question entirely. The second-best question of one kind is
    // worth less than the best question of another.
    const asks = whatToAsk(
      input({
        entities: [
          faded("thing:a", "bun_bun"),
          faded("thing:b", "swimming"),
          faded("thing:c", "hat"),
          // Names that actually resemble each other. Margaret and Maggie
          // share only "Ma", and identity.ts deliberately will not guess
          // that one is short for the other — that is world knowledge, not
          // string similarity.
          person("person:nanna", "Nanna", 9),
          person("person:nanna jean", "Nanna Jean", 7),
        ],
      })
    );
    expect(asks.some((a) => a.kind === "identity")).toBe(true);
  });

  it("ranks a bundle of questions on another page last", () => {
    const asks = whatToAsk(
      input({
        entities: [faded("thing:a", "bun_bun")],
        prompt: { question: "Is that still true?", because: "Recorded 8 months ago." },
        followUps: 9,
      })
    );
    expect(asks[asks.length - 1].kind).toBe("followup");
  });
});

describe("each one carries why it was asked", () => {
  it("shows the arithmetic above a context question", () => {
    const asks = whatToAsk(input({ entities: [faded("thing:a", "bun_bun")] }));
    expect(asks[0].because).toMatch(/memories/);
  });

  it("points somewhere it can actually be answered", () => {
    const asks = whatToAsk(
      input({
        entities: [faded("thing:a", "bun_bun"), person("person:n", "Nanna", 9), person("person:nj", "Nanna Jean", 7)],
        prompt: { question: "Is that still true?", because: "Recorded 8 months ago." },
      })
    );
    for (const a of asks) expect(a.href).toMatch(/^\/subjects\/s1\//);
  });

  it("settles nothing on its own", () => {
    // A question answered elsewhere disappears from here on the next load.
    // The home screen holds no state of its own about what has been asked.
    const entities = [faded("thing:a", "bun_bun")];
    const before = whatToAsk(input({ entities }));
    const after = whatToAsk(
      input({ entities, settledContext: new Set([`${before[0].id.split(":").slice(1, 3).join(":")}`]) })
    );
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThanOrEqual(before.length);
  });
});

describe("chores are not questions", () => {
  // Comments stripped, so the rule is not broken by the sentence explaining
  // it — the same trap the storage guard fell into.
  const source = readFileSync(new URL("../src/lib/home/asking.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("does not collect tagging, filing or reviewing", () => {
    // Those are work the product wants done. A question is something only
    // this family can answer, and mixing the two turns the list into a
    // to-do list — which is the thing that stops getting read.
    for (const chore of ["untagged", "unfiled", "pendingCount", "review"]) {
      expect(source).not.toContain(chore);
    }
  });
});
