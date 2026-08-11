// Asking one good question.
//
// The rule under test is the same one that governs the book: a prompt is
// built from something in the archive or it is general. Asking "how's
// swimming going?" of a family who never mentioned swimming is the nudge
// equivalent of inventing a memory, and it tells the parent instantly that
// nobody is really reading.

import { describe, expect, it } from "vitest";
import {
  EMPTY_MONTH_AFTER, QUIET_DAYS, STALE_LITTLE_THING_DAYS,
  bestPrompt, promptsFor, type ArchiveState,
} from "@/lib/prompts/engine";
import { containsArchiveContent } from "@/lib/email/messages";

const state = (over: Partial<ArchiveState> = {}): ArchiveState => ({
  childName: "Florence",
  daysSinceLastMemory: 2,
  recentThreads: [],
  littleThings: [],
  emptyMonths: [],
  hasVoiceRecording: true,
  daysSinceLastQuote: 5,
  yearProgress: 0.5,
  ...over,
});

describe("a prompt is never invented", () => {
  it("only names a thread the family actually recorded", () => {
    const p = bestPrompt(state({ daysSinceLastMemory: 40, recentThreads: ["the swimming lessons"] }))!;
    expect(p.question).toContain("the swimming lessons");
  });

  it("stays general when there is no thread to name", () => {
    // The quiet is real, so it still says something — but it invents no
    // detail about what they were doing.
    const p = bestPrompt(state({ daysSinceLastMemory: 40, recentThreads: [] }))!;
    expect(p.kind).toBe("gone_quiet");
    expect(p.question).not.toMatch(/swimming|boots|since/);
  });

  it("falls back to a general question rather than making something up", () => {
    const p = bestPrompt(state())!;
    expect(p.kind).toBe("general");
    expect(p.question.length).toBeGreaterThan(10);
  });

  it("always explains itself, so a parent can see it was read not guessed", () => {
    for (const s of [
      state({ daysSinceLastMemory: 40, recentThreads: ["Thursdays at Grandpa's"] }),
      state({ hasVoiceRecording: false }),
      state({ emptyMonths: ["March"] }),
      state(),
    ]) {
      for (const p of promptsFor(s)) expect(p.because.length).toBeGreaterThan(10);
    }
  });
});

describe("a prompt can never carry the archive into an email", () => {
  // Two of this product's rules collide here: a good prompt quotes what the
  // family wrote, and an email must never contain the archive. Privacy wins,
  // so every prompt carries an email-safe twin — and this is the test that
  // stops a new prompt kind quietly forgetting to.
  const rich = () =>
    state({
      daysSinceLastMemory: 40,
      recentThreads: ["the swimming lessons"],
      littleThings: [{ category: "currently_eating", value: "Strawberries. Constantly.", daysOld: 200 }],
      emptyMonths: ["March"],
      hasVoiceRecording: false,
      daysSinceLastQuote: null,
      yearProgress: 0.7,
    });

  it("passes the email guard for every prompt it can produce", () => {
    for (const p of promptsFor(rich())) {
      const message = {
        to: { email: "p@example.com" },
        subject: `A small question`,
        text: `${p.emailQuestion}\n\n${p.emailBecause}\n\nhttps://qotidia.com`,
      };
      expect(containsArchiveContent(message), p.kind).toBe(false);
    }
  });

  it("keeps the family's own words out of the email version", () => {
    const stale = promptsFor(rich()).find((p) => p.kind === "stale_little_thing")!;
    expect(stale.question).toContain("Strawberries. Constantly.");
    expect(stale.emailQuestion).not.toContain("Strawberries");
    expect(stale.emailBecause).not.toContain("Strawberries");
  });

  it("keeps a cluster title out too — that is their wording, not ours", () => {
    const quiet = promptsFor(rich()).find((p) => p.kind === "gone_quiet")!;
    expect(quiet.question).toContain("the swimming lessons");
    expect(quiet.emailQuestion).not.toContain("swimming");
    expect(quiet.emailBecause).not.toContain("swimming");
  });

  it("gives every prompt both versions, never an empty one", () => {
    for (const p of promptsFor(rich())) {
      expect(p.emailQuestion.length, p.kind).toBeGreaterThan(10);
      expect(p.emailBecause.length, p.kind).toBeGreaterThan(10);
    }
  });
});

describe("what gets asked first", () => {
  it("leads with the quiet when a family has stopped", () => {
    const p = bestPrompt(state({
      daysSinceLastMemory: 40,
      recentThreads: ["the swimming lessons"],
      hasVoiceRecording: false,
    }))!;
    expect(p.kind).toBe("gone_quiet");
  });

  it("asks about the voice before a general question", () => {
    const p = bestPrompt(state({ hasVoiceRecording: false }))!;
    expect(p.kind).toBe("no_voice_yet");
  });

  it("checks a stale little thing, quoting what they wrote", () => {
    const p = bestPrompt(state({
      littleThings: [{ category: "currently_eating", value: "Strawberries. Constantly.", daysOld: 200 }],
    }))!;
    expect(p.kind).toBe("stale_little_thing");
    expect(p.question).toContain("Strawberries. Constantly.");
  });

  it("does not nag about a little thing recorded last week", () => {
    const kinds = promptsFor(state({
      littleThings: [{ category: "currently_eating", value: "Strawberries", daysOld: 7 }],
    })).map((p) => p.kind);
    expect(kinds).not.toContain("stale_little_thing");
  });
});

describe("empty months", () => {
  it("warns while there is still time to fix it", () => {
    const kinds = promptsFor(state({ emptyMonths: ["March"], yearProgress: 0.6 })).map((p) => p.kind);
    expect(kinds).toContain("empty_month");
  });

  it("leaves people alone early in the year", () => {
    // In February, most of the year is empty and saying so is just nagging.
    const kinds = promptsFor(state({ emptyMonths: ["March"], yearProgress: 0.1 })).map((p) => p.kind);
    expect(kinds).not.toContain("empty_month");
  });

  it("names the month rather than saying 'some months'", () => {
    const p = promptsFor(state({ emptyMonths: ["March"], yearProgress: 0.6 }))
      .find((x) => x.kind === "empty_month")!;
    expect(p.question).toContain("March");
  });
});

describe("thresholds are generous rather than pushy", () => {
  it("waits three weeks before mentioning silence", () => {
    expect(QUIET_DAYS).toBeGreaterThanOrEqual(21);
    const quiet = promptsFor(state({ daysSinceLastMemory: QUIET_DAYS - 1 })).map((p) => p.kind);
    expect(quiet).not.toContain("gone_quiet");
  });

  it("gives a little thing three months before asking again", () => {
    expect(STALE_LITTLE_THING_DAYS).toBeGreaterThanOrEqual(90);
  });

  it("does not mention empty months in the first third of the year", () => {
    expect(EMPTY_MONTH_AFTER).toBeGreaterThan(0.3);
  });
});

describe("the general rotation", () => {
  it("is stable for the same archive, so a re-run asks the same thing", () => {
    const s = state();
    expect(bestPrompt(s)!.question).toBe(bestPrompt(s)!.question);
  });

  it("differs between families rather than sending everyone the same line", () => {
    const a = bestPrompt(state({ childName: "Florence" }))!.question;
    const b = bestPrompt(state({ childName: "Wilhelmina", yearProgress: 0.9 }))!.question;
    expect(a).not.toBe(b);
  });

  it("never manufactures urgency", () => {
    for (const s of [state(), state({ daysSinceLastMemory: 90 }), state({ hasVoiceRecording: false })]) {
      for (const p of promptsFor(s)) {
        for (const word of ["hurry", "last chance", "don't miss", "!"]) {
          expect(p.question.toLowerCase(), p.kind).not.toContain(word);
        }
      }
    }
  });
});
