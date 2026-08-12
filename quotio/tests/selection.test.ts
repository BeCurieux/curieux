import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/templates/catalogue";
import { evaluateWidget } from "@/lib/widget/engine";
import { resolveChosen } from "@/lib/widget/selection";

/**
 * Answers are stored as values, because that's what the maths needs. Two
 * answers may share a value on purpose — "Not sure" is priced as a
 * 2-bedroom — which is why the renderer tracks the *chosen option id*
 * separately for the highlight.
 *
 * These tests pin down the half of that contract the engine owns: sharing a
 * value has to be safe and has to price identically.
 */
describe("answers that deliberately share a value", () => {
  const templatesWithDuplicates = TEMPLATES.flatMap((entry) =>
    entry.document.steps
      .filter((step) => step.input.kind === "choice")
      .map((step) => {
        const options = (step.input as Extract<typeof step.input, { kind: "choice" }>).options;
        const values = options.map((option) => option.value);
        return { slug: entry.slug, step, options, hasDuplicates: new Set(values).size !== values.length };
      })
      .filter((entry) => entry.hasDuplicates)
  );

  it("exist in the launch templates, so this isn't a hypothetical", () => {
    // Cleaning "Not sure" → 2 bedrooms; Moving "Not sure" → a 2-bed's price.
    expect(templatesWithDuplicates.length).toBeGreaterThan(0);
  });

  it("still have distinct option ids", () => {
    for (const { slug, step, options } of templatesWithDuplicates) {
      const ids = options.map((option) => option.id);
      expect(new Set(ids).size, `${slug}/${step.id}`).toBe(ids.length);
    }
  });

  it("price identically whichever of the twins was picked", () => {
    const cleaning = TEMPLATES.find((entry) => entry.slug === "cleaning-estimate")!.document;
    const base = { home_type: 40, bathrooms: 1, extras: [], frequency: 0 };

    const twoBedrooms = evaluateWidget(cleaning, { ...base, bedrooms: 2 });
    const notSure = evaluateWidget(cleaning, { ...base, bedrooms: 2 });

    expect(notSure.value).toBe(twoBedrooms.value);
    expect(notSure.display).toBe(twoBedrooms.display);
  });
});

describe("resolving pre-filled answers to answer cards", () => {
  const cleaning = TEMPLATES.find((entry) => entry.slug === "cleaning-estimate")!.document;

  it("highlights one card when two answers share a value", () => {
    // "2 Bedrooms" and "Not sure" are both worth 2. Matching on value alone
    // ticks both, which is what shipped twice before this test existed.
    const chosen = resolveChosen(cleaning.steps, { bedrooms: 2 });
    expect(chosen.bedrooms).toEqual(["b2"]);
  });

  it("resolves each pick of a multi-select without reusing an option", () => {
    const chosen = resolveChosen(cleaning.steps, { extras: [30, 25] });
    expect(chosen.extras).toEqual(["oven", "windows"]);
  });

  it("ignores questions that have no answer, and non-choice questions", () => {
    const chosen = resolveChosen(cleaning.steps, { home_type: 60 });
    expect(chosen).toEqual({ home_type: ["house"] });
    expect(resolveChosen(cleaning.steps, undefined)).toEqual({});
    expect(resolveChosen(cleaning.steps, { bedrooms: 99 })).toEqual({});
  });
});
