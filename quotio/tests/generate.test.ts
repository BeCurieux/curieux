import { describe, expect, it } from "vitest";
import { generateLocally } from "@/lib/ai/heuristic";
import { parseGeneratedWidget, repair } from "@/lib/ai/repair";
import { evaluateWidget } from "@/lib/widget/engine";
import { validateStructure } from "@/lib/widget/schema";

/**
 * §45's MVP success test, run as a test.
 *
 * "Without writing code, they should end up with a widget resembling…"
 */
const SUCCESS_TEST_PROMPT =
  "I run a cleaning company. Make me a calculator that asks how many bedrooms and " +
  "bathrooms the customer has and whether they want oven cleaning. Bedrooms cost $35, " +
  "bathrooms $25 and an oven is $30.";

describe("the §45 success test", () => {
  const generated = generateLocally(SUCCESS_TEST_PROMPT);
  const doc = generated.document;

  it("builds the widget from the prompt rather than falling back", () => {
    expect(generated.source).toBe("parsed");
  });

  it("asks the three questions that were asked for", () => {
    expect(doc.steps.map((step) => step.id)).toEqual(["bedrooms", "bathrooms", "oven_cleaning"]);
    expect(doc.steps[0].title).toBe("How many bedrooms?");
    expect(doc.steps[1].title).toBe("How many bathrooms?");
    expect(doc.steps[2].title).toBe("Would you like oven cleaning?");
  });

  it("picks a sensible input type for each", () => {
    expect(doc.steps[0].input.kind).toBe("choice");
    expect(doc.steps[1].input.kind).toBe("choice");
    expect(doc.steps[2].input.kind).toBe("toggle");
  });

  it("reads the prices out of the sentence", () => {
    expect(doc.result.expression).toBe("total + bedrooms * 35 + bathrooms * 25 + oven_cleaning * 30");
  });

  it("does the arithmetic the business described", () => {
    expect(evaluateWidget(doc, { bedrooms: 2, bathrooms: 2, oven_cleaning: true }).value).toBe(150);
    expect(evaluateWidget(doc, { bedrooms: 3, bathrooms: 1, oven_cleaning: false }).value).toBe(130);
    expect(evaluateWidget(doc, { bedrooms: 1, bathrooms: 1, oven_cleaning: true }).display).toBe("$90");
  });

  it("comes out valid, themed and ready to publish", () => {
    expect(validateStructure(doc)).toEqual([]);
    expect(doc.name).toBe("Cleaning Calculator");
    expect(doc.intro?.heading).toBe("Get your cleaning estimate");
    expect(doc.result.cta?.label).toBe("Book my clean");
    expect(doc.settings.leadCapture.mode).toBe("after");
  });

  it("illustrates the answers without being asked to", () => {
    const bedrooms = doc.steps[0].input;
    expect(bedrooms.kind === "choice" && bedrooms.options[0].illustration).toBe("bed");
  });
});

describe("other prompts", () => {
  it("handles per-unit pricing", () => {
    const { document, source } = generateLocally(
      "A photography quote calculator. Ask how many hours of coverage and how many photographers. " +
        "We charge $120 per hour and $350 per photographer."
    );
    expect(source).toBe("parsed");
    expect(evaluateWidget(document, { hours: 4, photographers: 2 }).value).toBe(4 * 120 + 2 * 350);
  });

  it("reads a starting price as a base, not a per-unit rate", () => {
    const { document } = generateLocally(
      "Create a wedding photographer quote calculator. Ask about hours and whether they want a " +
        "second photographer. Packages start at $1,500. Hours are $150 and a second photographer is $400."
    );
    expect(document.result.baseValue).toBe(1500);
    expect(evaluateWidget(document, { hours: 6, second_photographer: true }).value).toBe(1500 + 900 + 400);
  });

  it("chooses the widget type from the words used", () => {
    expect(
      generateLocally("Build an estimator for garden landscaping. How many beds at $80 and how many trees at $200.")
        .document.result.kind
    ).toBe("range");
    expect(
      generateLocally("A calculator for tutoring. How many hours at $40 and how many students at $10.")
        .document.result.kind
    ).toBe("value");
  });

  it("falls back to the closest template when the prompt is just a topic", () => {
    const cleaning = generateLocally("Cleaning quote");
    expect(cleaning.source).toBe("template");
    expect(cleaning.document.steps.length).toBeGreaterThan(2);
    expect(cleaning.note).toContain("Cleaning Estimate");

    expect(generateLocally("Product recommender").document.type).toBe("quiz");
    expect(generateLocally("ROI calculator").document.name).toContain("ROI");
  });

  it("never returns something the renderer can't render", () => {
    const prompts = [
      "",
      "hi",
      "?????",
      "Make me something",
      "$$$$$$",
      "a widget with 999999999999 questions",
      "<script>alert(1)</script> pricing tool",
      "asks how many ".repeat(40),
    ];
    for (const prompt of prompts) {
      const { document } = generateLocally(prompt);
      expect(validateStructure(document), prompt).toEqual([]);
      expect(document.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("repairing model output", () => {
  it("fixes field ids and the formulas that reference them", () => {
    const doc = parseGeneratedWidget({
      name: "Messy",
      type: "estimator",
      steps: [
        {
          id: "Number of Bedrooms!",
          title: "Bedrooms",
          input: {
            type: "multiple_choice",
            options: [
              { label: "One", value: 1 },
              { label: "Two", value: 2 },
            ],
          },
        },
        { id: "extra-services", title: "Extras", input: { kind: "boolean" } },
      ],
      result: { kind: "value", heading: "Total", formula: "Number of Bedrooms! * 35" },
    });

    expect(doc).not.toBeNull();
    expect(doc!.steps.map((step) => step.id)).toEqual(["number_of_bedrooms", "extra_services"]);
    expect(doc!.result.expression).toBe("number_of_bedrooms * 35");
    expect(doc!.steps[0].input.kind).toBe("choice");
    expect(doc!.steps[1].input.kind).toBe("toggle");
    expect(evaluateWidget(doc!, { number_of_bedrooms: 2 }).value).toBe(70);
  });

  it("translates the operator spellings models reach for", () => {
    const doc = parseGeneratedWidget({
      name: "Ops",
      type: "calculator",
      steps: [
        { id: "rooms", title: "Rooms", input: { kind: "number" } },
        { id: "deep", title: "Deep clean", input: { kind: "toggle" } },
      ],
      logic: [
        { id: "r1", when: { field: "rooms", operator: "greater_than_or_equal", value: 4 }, then: { action: "add", value: 40 } },
      ],
      result: { kind: "value", heading: "Total" },
    });

    expect(doc).not.toBeNull();
    expect(evaluateWidget(doc!, { rooms: 4 }).value).toBe(40);
    expect(evaluateWidget(doc!, { rooms: 3 }).value).toBe(0);
  });

  it("drops rules that point at things which don't exist", () => {
    const doc = parseGeneratedWidget({
      name: "Half-invented",
      type: "calculator",
      steps: [
        { id: "rooms", title: "Rooms", input: { kind: "number" } },
        { id: "size", title: "Size", input: { kind: "number" } },
      ],
      logic: [
        { id: "good", when: { field: "rooms", operator: ">", value: 1 }, then: { add: 10 } },
        { id: "ghost", when: { field: "conservatory", operator: ">", value: 1 }, then: { add: 999 } },
      ],
      result: { kind: "value", heading: "Total", expression: "total + basement * 50" },
    });

    expect(doc).not.toBeNull();
    expect(doc!.logic.map((rule) => rule.id)).toEqual(["good"]);
    expect(doc!.result.expression).toBe("total");
    expect(evaluateWidget(doc!, { rooms: 3 }).value).toBe(10);
  });

  it("downgrades a recommendation with nothing to recommend", () => {
    const doc = parseGeneratedWidget({
      name: "Empty quiz",
      type: "quiz",
      steps: [
        { id: "a", title: "A", input: { kind: "number" } },
        { id: "b", title: "B", input: { kind: "number" } },
      ],
      result: { kind: "recommendation", heading: "Your match", outcomes: [] },
    });
    expect(doc?.result.kind).toBe("value");
  });

  it("refuses output that isn't a widget at all", () => {
    expect(parseGeneratedWidget(null)).toBeNull();
    expect(parseGeneratedWidget("a widget")).toBeNull();
    expect(parseGeneratedWidget({ name: "No steps", type: "calculator", steps: [] })).toBeNull();
  });

  it("unwraps output the model nested one level too deep", () => {
    const nested = repair({
      widget: {
        name: "Nested",
        type: "calculator",
        steps: [{ id: "a", title: "A", input: { kind: "number" } }],
        result: { heading: "Total" },
      },
    }) as { name: string };
    expect(nested.name).toBe("Nested");
  });
});
