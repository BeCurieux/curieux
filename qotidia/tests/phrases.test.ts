// The words a child says.
//
// The line these produce puts words in quotation marks and attributes them
// to a three-year-old, so the bar is higher than for anything else in the
// graph: a phrase that was never said, or said by the parent about the
// child, is the product inventing a family memory.

import { describe, expect, it } from "vitest";
import { asSaid, normalise, runsIn, MAX_WORDS } from "@/lib/graph/phrases";

describe("normalising", () => {
  it("makes the same phrase match itself through punctuation and case", () => {
    expect(normalise("Bun Bun tired now!")).toBe(normalise("bun bun tired now"));
  });

  it("keeps apostrophes, because 'byself' is not 'by self'", () => {
    expect(normalise("I don't want it")).toBe("i don't want it");
  });
});

describe("runs of words", () => {
  it("finds the phrase inside a longer sentence", () => {
    expect(runsIn("I do it my byself")).toContain("i do it");
    expect(runsIn("I do it my byself")).toContain("byself");
  });

  it("drops a run that is nothing but ordinary words", () => {
    const runs = runsIn("it is on the");
    expect(runs).toEqual([]);
  });

  it("keeps a small word when it is doing work", () => {
    // "I do it" is mostly small words and is unmistakably a two-year-old.
    // A filter aggressive enough to lose it is the wrong filter.
    expect(runsIn("I do it!")).toContain("i do it");
  });

  it("does not run away with a long sentence", () => {
    const runs = runsIn("one two three four five six seven eight");
    expect(runs.every((r) => r.split(" ").length <= MAX_WORDS)).toBe(true);
  });

  it("counts a repeated run once within one thing said", () => {
    // "Bun Bun tired now. Bun Bun go bed." says "bun bun" twice. That is one
    // quote, not two — the requirement is three separate quotes.
    const runs = runsIn("Bun Bun tired now. Bun Bun go bed.");
    expect(runs.filter((r) => r === "bun bun")).toHaveLength(1);
  });
});

describe("quoting it back", () => {
  it("shows the words as the child said them, not as we matched them", () => {
    expect(asSaid("bun bun", "Bun Bun tired now.")).toBe("Bun Bun");
  });

  it("keeps an apostrophe in the original", () => {
    expect(asSaid("i don't", "I don't want it")).toBe("I don't");
  });

  it("trims the punctuation it landed on", () => {
    expect(asSaid("under under", "She asked to go 'under under'.")).toBe("under under");
  });

  it("falls back to the plain run rather than guessing", () => {
    expect(asSaid("nanas", "something else entirely")).toBe("nanas");
  });
});
