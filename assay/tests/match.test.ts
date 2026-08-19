import { describe, expect, it } from "vitest";
import { match, normaliseSpans } from "@/engine/match.js";
import type { Matcher } from "@/engine/types.js";

const phrase = (any: string[], extra: Partial<Extract<Matcher, { kind: "phrase" }>> = {}): Matcher => ({
  kind: "phrase",
  any,
  ...extra,
});

const texts = (text: string, matcher: Matcher) => match(text, matcher).map((s) => text.slice(s.start, s.end));

describe("phrase matching", () => {
  it("does not find a word inside another word", () => {
    expect(match("Freedom of movement.", phrase(["free"]))).toEqual([]);
    expect(match("A greenhouse in Kent.", phrase(["green"]))).toEqual([]);
  });

  it("finds the word when it stands alone, whatever the case", () => {
    expect(texts("Totally FREE of parabens.", phrase(["free"]))).toEqual(["FREE"]);
  });

  it("treats a hyphen and a space as the same separator", () => {
    for (const written of ["carbon neutral", "carbon-neutral", "Carbon  Neutral"]) {
      expect(match(`We are ${written} now.`, phrase(["carbon neutral"]))).toHaveLength(1);
    }
  });

  it("crosses a line break inside a phrase", () => {
    expect(match("we are carbon\nneutral", phrase(["carbon neutral"]))).toHaveLength(1);
  });

  it("returns spans that index back into the source exactly", () => {
    const text = "Our eco-friendly serum.";
    const [span] = match(text, phrase(["eco friendly"]));
    expect(span).toBeDefined();
    expect(text.slice(span!.start, span!.end)).toBe("eco-friendly");
  });
});

describe("qualifiers", () => {
  it("stays quiet when the qualifier sits beside the claim", () => {
    const matcher = phrase(["recyclable"], { unless: ["where facilities exist"] });
    expect(match("Recyclable where facilities exist.", matcher)).toEqual([]);
  });

  it("still fires when the qualifier is a page away", () => {
    const matcher = phrase(["recyclable"], { unless: ["where facilities exist"], window: 40 });
    const far = `Recyclable.${" ".repeat(200)}Where facilities exist, of course.`;
    expect(match(far, matcher)).toHaveLength(1);
  });
});

describe("overlaps", () => {
  it("reports one hit, not two, when phrases nest", () => {
    const text = "Clinically proven to work.";
    expect(texts(text, phrase(["proven", "clinically proven"]))).toEqual(["Clinically proven"]);
  });

  it("merges overlapping spans into the longer one", () => {
    expect(normaliseSpans([{ start: 0, end: 5 }, { start: 3, end: 9 }])).toEqual([{ start: 0, end: 9 }]);
  });
});

describe("combinators", () => {
  const first = phrase(["proven"]);
  const second = phrase(["overnight"]);

  it("any reports every child that hit", () => {
    expect(texts("Proven, overnight.", { kind: "any", of: [first, second] })).toEqual(["Proven", "overnight"]);
  });

  it("all reports nothing unless every child hit", () => {
    expect(match("Proven.", { kind: "all", of: [first, second] })).toEqual([]);
  });

  it("all reports the first child, because that is the claim", () => {
    expect(texts("Proven, overnight.", { kind: "all", of: [first, second] })).toEqual(["Proven"]);
  });
});
