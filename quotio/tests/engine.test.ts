import { describe, expect, it } from "vitest";
import { widgetSchemaSchema, validateStructure, type WidgetDocument } from "@/lib/widget/schema";
import { defaultAnswers, evaluateWidget, isAnswered, visibleSteps } from "@/lib/widget/engine";

/** The §45 success test, expressed as a widget document. */
function cleaningEstimator(): WidgetDocument {
  return widgetSchemaSchema.parse({
    name: "Cleaning Estimate",
    type: "estimator",
    steps: [
      {
        id: "bedrooms",
        title: "How many bedrooms?",
        input: {
          kind: "choice",
          options: [
            { id: "b1", label: "1", value: 1 },
            { id: "b2", label: "2", value: 2 },
            { id: "b3", label: "3", value: 3 },
            { id: "b4", label: "4", value: 4 },
            { id: "b5", label: "5+", value: 5 },
          ],
        },
      },
      {
        id: "bathrooms",
        title: "Bathrooms",
        input: {
          kind: "choice",
          options: [
            { id: "r1", label: "1", value: 1 },
            { id: "r2", label: "2", value: 2 },
            { id: "r3", label: "3", value: 3 },
            { id: "r4", label: "4+", value: 4 },
          ],
        },
      },
      {
        id: "oven",
        title: "Oven cleaning",
        required: false,
        input: { kind: "toggle" },
      },
    ],
    result: {
      kind: "value",
      heading: "Your estimate",
      expression: "bedrooms * 35 + bathrooms * 25 + oven * 30",
      disclaimer: "This is an indicative estimate.",
      cta: { label: "Book my clean" },
    },
  });
}

describe("the cleaning estimator from §45", () => {
  it("is a structurally valid widget", () => {
    expect(validateStructure(cleaningEstimator())).toEqual([]);
  });

  it("charges exactly the prices the visitor was quoted", () => {
    // §45 prints "$170" next to 2 bedrooms, 2 bathrooms and an oven, but the
    // prices it gives (35/25/30) add up to 150. The illustration is off by a
    // line item; the rule the engine has to honour is that the formula is
    // applied exactly as written, with no rounding, padding or surprises.
    const evaluation = evaluateWidget(cleaningEstimator(), {
      bedrooms: 2,
      bathrooms: 2,
      oven: true,
    });
    expect(evaluation.value).toBe(2 * 35 + 2 * 25 + 30);
    expect(evaluation.display).toBe("$150");

    expect(evaluateWidget(cleaningEstimator(), { bedrooms: 4, bathrooms: 2, oven: false }).value).toBe(190);
    expect(evaluateWidget(cleaningEstimator(), { bedrooms: 1, bathrooms: 1, oven: false }).value).toBe(60);
  });

  it("itemises the estimate honestly", () => {
    const { breakdown } = evaluateWidget(cleaningEstimator(), {
      bedrooms: 2,
      bathrooms: 1,
      oven: true,
    });
    expect(breakdown).toEqual([
      { label: "How many bedrooms?", amount: 70, kind: "input" },
      { label: "Bathrooms", amount: 25, kind: "input" },
      { label: "Oven cleaning", amount: 30, kind: "input" },
    ]);
    expect(breakdown.reduce((sum, line) => sum + line.amount, 0)).toBe(125);
  });

  it("treats an untouched widget as zero rather than broken", () => {
    const doc = cleaningEstimator();
    const evaluation = evaluateWidget(doc, defaultAnswers(doc));
    expect(evaluation.value).toBe(0);
    expect(evaluation.display).toBe("$0");
  });
});

describe("logic rules", () => {
  const doc = (): WidgetDocument =>
    widgetSchemaSchema.parse({
      name: "Rules",
      type: "estimator",
      steps: [
        {
          id: "bedrooms",
          title: "Bedrooms",
          input: {
            kind: "choice",
            options: [
              { id: "a", label: "2", value: 2 },
              { id: "b", label: "5", value: 5 },
            ],
          },
        },
        {
          id: "extras",
          title: "Extras",
          required: false,
          input: {
            kind: "choice",
            multiple: true,
            options: [
              { id: "oven", label: "Oven", value: "oven" },
              { id: "windows", label: "Windows", value: "windows" },
            ],
          },
        },
        { id: "stairs", title: "How many flights?", hidden: true, input: { kind: "number" } },
      ],
      logic: [
        { id: "r1", when: { field: "bedrooms", operator: ">=", value: 4 }, then: { add: 40 } },
        { id: "r2", when: { field: "extras", operator: "contains", value: "oven" }, then: { add: 30 } },
        { id: "r3", when: { field: "bedrooms", operator: ">=", value: 4 }, then: { show: "stairs" } },
        { id: "r4", when: { field: "stairs", operator: ">", value: 0 }, then: { add: "stairs * 15" } },
      ],
      result: { kind: "value", heading: "Total", baseValue: 100 },
    });

  it("applies the brief's example rule", () => {
    expect(evaluateWidget(doc(), { bedrooms: 5 }).value).toBe(140);
    expect(evaluateWidget(doc(), { bedrooms: 2 }).value).toBe(100);
  });

  it("matches multi-select answers with contains", () => {
    expect(evaluateWidget(doc(), { bedrooms: 2, extras: ["oven"] }).value).toBe(130);
    expect(evaluateWidget(doc(), { bedrooms: 2, extras: ["windows"] }).value).toBe(100);
    expect(evaluateWidget(doc(), { bedrooms: 5, extras: ["oven", "windows"] }).value).toBe(170);
  });

  it("supports formulas inside rules", () => {
    expect(evaluateWidget(doc(), { bedrooms: 5, stairs: 3 }).value).toBe(185);
  });

  it("shows and hides steps by branching", () => {
    expect(visibleSteps(doc(), { bedrooms: 2 }).map((step) => step.id)).toEqual(["bedrooms", "extras"]);
    expect(visibleSteps(doc(), { bedrooms: 5 }).map((step) => step.id)).toEqual([
      "bedrooms",
      "extras",
      "stairs",
    ]);
  });

  it("ignores answers to questions the visitor never saw", () => {
    // `stairs` is hidden at 2 bedrooms, so a stale answer must not be charged.
    expect(evaluateWidget(doc(), { bedrooms: 2, stairs: 4 }).value).toBe(100);
  });

  it("labels breakdown lines in plain English", () => {
    const { breakdown } = evaluateWidget(doc(), { bedrooms: 5 });
    expect(breakdown).toEqual([
      { label: "Starting price", amount: 100, kind: "base" },
      { label: "Bedrooms is at least 4", amount: 40, kind: "rule" },
    ]);
  });

  it("cannot loop on rules that contradict each other", () => {
    const contradictory = widgetSchemaSchema.parse({
      name: "Fight",
      type: "calculator",
      steps: [
        { id: "a", title: "A", input: { kind: "number" } },
        { id: "b", title: "B", input: { kind: "number" } },
      ],
      logic: [
        { id: "x", when: { field: "a", operator: ">", value: 0 }, then: { hide: "b" } },
        { id: "y", when: { field: "a", operator: ">", value: 0 }, then: { show: "b" } },
      ],
      result: { kind: "value", heading: "Total" },
    });
    // Later rules win; the pass is single, so this terminates.
    expect(visibleSteps(contradictory, { a: 1 }).map((step) => step.id)).toEqual(["a", "b"]);
  });
});

describe("multiply, subtract and set", () => {
  const doc = widgetSchemaSchema.parse({
    name: "Ops",
    type: "calculator",
    steps: [
      {
        id: "urgency",
        title: "Urgency",
        input: {
          kind: "choice",
          options: [
            { id: "n", label: "Normal", value: "normal" },
            { id: "r", label: "Rush", value: "rush" },
          ],
        },
      },
      { id: "member", title: "Member", required: false, input: { kind: "toggle" } },
    ],
    logic: [
      { id: "m", when: { field: "urgency", operator: "=", value: "rush" }, then: { multiply: 1.5 } },
      { id: "d", when: { field: "member", operator: "=", value: true }, then: { subtract: 20 } },
    ],
    result: { kind: "value", heading: "Total", baseValue: 200 },
  });

  it("multiplies and subtracts in author order", () => {
    expect(evaluateWidget(doc, { urgency: "rush", member: false }).value).toBe(300);
    expect(evaluateWidget(doc, { urgency: "rush", member: true }).value).toBe(280);
    expect(evaluateWidget(doc, { urgency: "normal", member: true }).value).toBe(180);
  });

  it("records a multiply as the amount it actually added", () => {
    const { breakdown } = evaluateWidget(doc, { urgency: "rush", member: false });
    expect(breakdown.at(-1)).toEqual({ label: "Urgency is rush", amount: 100, kind: "rule" });
  });
});

describe("ranges and formatting", () => {
  const doc = widgetSchemaSchema.parse({
    name: "Range",
    type: "estimator",
    steps: [{ id: "hours", title: "Hours", input: { kind: "slider", min: 1, max: 10 } }],
    result: {
      kind: "range",
      heading: "Your estimated price",
      expression: "hours * 50",
      rangeSpread: 0.3,
    },
  });

  it("widens upwards from the quoted number", () => {
    const evaluation = evaluateWidget(doc, { hours: 3 });
    expect(evaluation.range).toEqual({ low: 150, high: 195 });
    expect(evaluation.display).toBe("$150–$195");
  });

  it("formats other styles", () => {
    const percent = widgetSchemaSchema.parse({
      name: "Pct",
      type: "calculator",
      steps: [{ id: "a", title: "A", input: { kind: "number" } }],
      result: {
        kind: "value",
        heading: "Rate",
        expression: "a * 2",
        format: { style: "percent", decimals: 1 },
      },
    });
    expect(evaluateWidget(percent, { a: 12.34 }).display).toBe("24.7%");
  });
});

describe("quizzes", () => {
  const doc = widgetSchemaSchema.parse({
    name: "Skincare Finder",
    type: "quiz",
    steps: [
      {
        id: "concern",
        title: "What's your main concern?",
        input: {
          kind: "choice",
          multiple: true,
          options: [
            { id: "dry", label: "Dryness", value: "dryness", scores: { hydrate: 3 } },
            { id: "oil", label: "Oiliness", value: "oiliness", scores: { balance: 3 } },
            { id: "dull", label: "Dullness", value: "dullness", scores: { glow: 2, hydrate: 1 } },
          ],
        },
      },
    ],
    logic: [
      {
        id: "boost",
        when: { field: "concern", operator: "contains", value: "dryness" },
        then: { score: { outcome: "hydrate", points: 3 } },
      },
    ],
    result: {
      kind: "recommendation",
      heading: "Your match",
      outcomes: [
        { id: "glow", title: "The Glow Serum" },
        { id: "hydrate", title: "The Hydrating Cream" },
        { id: "balance", title: "The Balancing Gel" },
      ],
    },
  });

  it("adds points from options and from rules", () => {
    const evaluation = evaluateWidget(doc, { concern: ["dryness"] });
    expect(evaluation.scores).toEqual({ glow: 0, hydrate: 6, balance: 0 });
    expect(evaluation.outcome?.id).toBe("hydrate");
  });

  it("picks the highest scoring outcome", () => {
    expect(evaluateWidget(doc, { concern: ["oiliness"] }).outcome?.id).toBe("balance");
    expect(evaluateWidget(doc, { concern: ["dullness"] }).outcome?.id).toBe("glow");
  });

  it("breaks ties in author order, and never shows a blank result", () => {
    expect(evaluateWidget(doc, { concern: [] }).outcome?.id).toBe("glow");
  });
});

describe("copy interpolation", () => {
  it("substitutes answers into result copy and drops unknown tokens", () => {
    const doc = widgetSchemaSchema.parse({
      name: "Tokens",
      type: "estimator",
      steps: [{ id: "bedrooms", title: "Bedrooms", input: { kind: "number" } }],
      result: {
        kind: "value",
        heading: "Cleaning {{bedrooms}} bedrooms",
        description: "About {{value}} — {{nothing}}thanks!",
        expression: "bedrooms * 35",
      },
    });
    const evaluation = evaluateWidget(doc, { bedrooms: 3 });
    expect(evaluation.heading).toBe("Cleaning 3 bedrooms");
    expect(evaluation.description).toBe("About 105 — thanks!");
  });
});

describe("required answers", () => {
  const doc = widgetSchemaSchema.parse({
    name: "Required",
    type: "estimator",
    steps: [
      { id: "name", title: "Name", input: { kind: "text" } },
      { id: "email", title: "Email", input: { kind: "email" } },
      { id: "extras", title: "Extras", required: false, input: { kind: "text" } },
    ],
    result: { kind: "value", heading: "Done" },
  });

  it("blocks on blanks and bad emails, but never on optional steps", () => {
    expect(isAnswered(doc.steps[0], {})).toBe(false);
    expect(isAnswered(doc.steps[0], { name: "  " })).toBe(false);
    expect(isAnswered(doc.steps[0], { name: "Ada" })).toBe(true);
    expect(isAnswered(doc.steps[1], { email: "ada@" })).toBe(false);
    expect(isAnswered(doc.steps[1], { email: "ada@example.com" })).toBe(true);
    expect(isAnswered(doc.steps[2], {})).toBe(true);
  });
});

describe("structural validation", () => {
  it("catches references to things that don't exist", () => {
    const broken = widgetSchemaSchema.parse({
      name: "Broken",
      type: "calculator",
      steps: [{ id: "a", title: "A", input: { kind: "number" } }],
      logic: [
        { id: "r", when: { field: "ghost", operator: ">", value: 1 }, then: { show: "phantom" } },
        { id: "s", when: { field: "a", operator: ">", value: 1 }, then: { add: "a * unknown" } },
      ],
      result: { kind: "value", heading: "Total", expression: "a + missing" },
    });

    const messages = validateStructure(broken).map((issue) => issue.message);
    expect(messages).toEqual([
      'Rule refers to "ghost", which isn\'t a question.',
      'No question called "phantom".',
      '"a * unknown" isn\'t a valid formula.',
      '"a + missing" isn\'t a valid formula.',
    ]);
  });

  it("requires outcomes for recommendation results", () => {
    const noOutcomes = widgetSchemaSchema.parse({
      name: "Quiz",
      type: "quiz",
      steps: [{ id: "a", title: "A", input: { kind: "number" } }],
      result: { kind: "recommendation", heading: "Your match" },
    });
    expect(validateStructure(noOutcomes)).toEqual([
      { path: "result.outcomes", message: "This result type needs at least one outcome." },
    ]);
  });
});
