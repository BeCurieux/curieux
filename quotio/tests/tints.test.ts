import { describe, expect, it } from "vitest";
import { miniFromDocument } from "@/components/widget/MiniWidget";
import { TEMPLATES } from "@/lib/templates/catalogue";
import { ART_TINTS, repeatedIllustration, tintFor } from "@/lib/widget/tints";
import type { IllustrationKey } from "@/lib/widget/illustrations";

const art = (...keys: Array<IllustrationKey | undefined>) =>
  keys.map((illustration, index) => ({ id: `o${index}`, label: `O${index}`, illustration }));

describe("recolouring a grid of repeated pictures", () => {
  it("fires once a picture appears three times", () => {
    expect(repeatedIllustration(art("bed", "bed"))).toBeNull();
    expect(repeatedIllustration(art("bed", "bed", "bed"))).toBe("bed");
  });

  it("counts the repeats even when the odd one out sits among them", () => {
    // "How many bedrooms?" is five beds and a question mark for "Not sure".
    expect(repeatedIllustration(art("bed", "bed", "question", "bed"))).toBe("bed");
  });

  it("leaves a genuinely varied set alone", () => {
    // Apartment / House / Office each mean something; recolouring them would
    // be decoration fighting the meaning.
    expect(repeatedIllustration(art("house", "bed", "people"))).toBeNull();
    expect(repeatedIllustration(art())).toBeNull();
    expect(repeatedIllustration(art(undefined, undefined, undefined))).toBeNull();
  });

  it("tints only the picture that repeats, by its place in the list", () => {
    const options = art("bed", "bed", "question", "bed");
    const repeated = repeatedIllustration(options);
    expect(tintFor("bed", 0, repeated)).toBe(ART_TINTS[0]);
    expect(tintFor("bed", 1, repeated)).toBe(ART_TINTS[1]);
    // The odd one out keeps the colour it was drawn in.
    expect(tintFor("question", 2, repeated)).toBeUndefined();
    expect(tintFor("bed", 3, repeated)).toBe(ART_TINTS[3]);
    expect(tintFor(undefined, 0, repeated)).toBeUndefined();
  });
});

/**
 * The template card is a scale model of the widget. It showed three identical
 * cakes for a question the widget draws in three colours, because the rule
 * lived inline in the renderer and the miniature never got a copy.
 *
 * These compare the two directly rather than checking each alone — matching
 * on both sides is the property that broke.
 */
describe("a card and the widget it pictures", () => {
  const firstChoiceStep = (document: (typeof TEMPLATES)[number]["document"]) =>
    document.steps.find((step) => step.input.kind === "choice") ?? document.steps[0];

  it("agree on every launch template", () => {
    for (const template of TEMPLATES) {
      const step = firstChoiceStep(template.document);
      if (step?.input.kind !== "choice") continue;

      const all = step.input.options;
      const repeated = repeatedIllustration(all);
      const fromRenderer = all
        .slice(0, 3)
        .map((option, index) => tintFor(option.illustration, index, repeated));

      const mini = miniFromDocument(template.document);
      expect(mini.options.map((option) => option.tint), template.slug).toEqual(fromRenderer);
    }
  });

  it("is not fooled by a repeat that only exists inside the first three", () => {
    // The miniature draws three answers. Deciding from that slice would call
    // this a repeat; the widget, seeing all five, would not — and the card
    // would be coloured differently from the thing it depicts.
    const sliced = art("bed", "bed", "bed", "house", "people").slice(0, 3);
    expect(repeatedIllustration(sliced)).toBe("bed");
    expect(repeatedIllustration(art("bed", "bed", "house", "people", "clock"))).toBeNull();
  });

  it("colours the cakes on the event budget card", () => {
    // The card that started this: Canapés / Buffet / Plated dinner, all cake.
    const budget = TEMPLATES.find((entry) => entry.slug === "event-budget");
    if (!budget) return;
    const mini = miniFromDocument(budget.document);
    const cakes = mini.options.filter((option) => option.illustration === "cake");
    if (cakes.length >= 3) {
      const tints = cakes.map((option) => option.tint);
      expect(new Set(tints).size, "three cakes, three colours").toBe(tints.length);
      expect(tints.every(Boolean)).toBe(true);
    }
  });
});
