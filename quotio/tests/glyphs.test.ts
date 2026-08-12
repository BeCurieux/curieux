import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/templates/catalogue";
import { glyphForTitle } from "@/lib/widget/glyphs";

/**
 * The rail's marks are inferred, never authored, so the thing that can go
 * wrong is quiet: every question falls through to a dot and the rail becomes
 * a column of identical circles that tells you nothing. These tests are here
 * to make that failure loud.
 */
describe("choosing a rail glyph", () => {
  it("uses the illustration a question already earns", () => {
    // Rail and answer cards should be talking about the same thing.
    expect(glyphForTitle("And how many bathrooms?")).toBe("bath");
    expect(glyphForTitle("How many bedrooms?")).toBe("bed");
    expect(glyphForTitle("What's your budget?")).toBe("coins");
  });

  it("reads the shape of a question the illustration matcher declines", () => {
    // None of these name an object, so guessIllustration returns null — but
    // they're the questions a generated widget is actually full of.
    expect(glyphForTitle("When do you need it?")).toBe("calendar");
    expect(glyphForTitle("How should it look?")).toBe("brush");
    expect(glyphForTitle("What are we building?")).toBe("box");
    expect(glyphForTitle("Anything beyond the basics?")).toBe("sparkle");
    expect(glyphForTitle("Where are you based?")).toBe("home");
  });

  it("prefers a duration to a quantity when a question asks for both", () => {
    expect(glyphForTitle("How long will it take?")).toBe("clock");
    expect(glyphForTitle("How many rooms?")).toBe("chart");
  });

  it("still gives up rather than guessing wildly", () => {
    expect(glyphForTitle("Untitled question")).toBe("dot");
    expect(glyphForTitle("")).toBe("dot");
  });

  it("leaves no launch template as a column of dots", () => {
    for (const template of TEMPLATES) {
      const glyphs = template.document.steps.map((step) => glyphForTitle(step.title));
      const dots = glyphs.filter((glyph) => glyph === "dot").length;

      // A dot here and there is honest; a rail that is mostly dots is not a
      // rail. Half is the line.
      expect(dots * 2, `${template.slug}: ${glyphs.join(", ")}`).toBeLessThanOrEqual(glyphs.length);
    }
  });
});
