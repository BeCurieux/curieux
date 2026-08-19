import { describe, expect, it } from "vitest";
import { categoriesOf, extractClaims } from "@/extract/deterministic.js";

describe("segmentation", () => {
  it("returns spans that slice the source back exactly", () => {
    const text = "Clinically proven to firm. Smells of neroli and moss.";
    for (const claim of extractClaims(text)) {
      expect(text.slice(claim.span.start, claim.span.end)).toBe(claim.text);
    }
  });

  it("breaks on bullets and newlines, not only full stops", () => {
    const text = "Reduces the look of lines\nBrightens over four weeks\nSmells of fig";
    expect(extractClaims(text)).toHaveLength(3);
  });

  it("drops fragments too short to be a claim", () => {
    expect(extractClaims("Add to cart | £42 | Green")).toEqual([]);
  });

  it("skips copy that makes no claim at all", () => {
    expect(extractClaims("Shipping is free over forty pounds.")).toEqual([]);
  });
});

describe("categories", () => {
  it("reads more than one category off a sentence that makes more than one claim", () => {
    expect(categoriesOf("A clean, eco formula clinically proven to firm.")).toEqual(
      expect.arrayContaining(["efficacy", "free_from", "environmental", "clinical"]),
    );
  });

  it("finds nothing to say about a sentence that says nothing", () => {
    expect(categoriesOf("Made in Adelaide since 2019.")).toEqual([]);
  });
});
