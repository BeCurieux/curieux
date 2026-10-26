import { describe, expect, it } from "vitest";
import { TEMPLATES, templateBySlug } from "@/lib/templates/catalogue";
import { validateStructure } from "@/lib/widget/schema";
import { defaultAnswers, evaluateWidget, visibleSteps } from "@/lib/widget/engine";

// §23: "Each template should be genuinely functional. Not screenshots."
// These tests are what makes that claim checkable rather than aspirational.

describe("every launch template", () => {
  it.each(TEMPLATES.map((entry) => [entry.slug, entry] as const))("%s is structurally sound", (_slug, entry) => {
    expect(validateStructure(entry.document)).toEqual([]);
  });

  it.each(TEMPLATES.map((entry) => [entry.slug, entry] as const))(
    "%s renders a result from an untouched form",
    (_slug, entry) => {
      const evaluation = evaluateWidget(entry.document, defaultAnswers(entry.document));
      expect(evaluation.display).toBeTruthy();
      expect(Number.isFinite(evaluation.value)).toBe(true);
      if (entry.document.result.kind === "recommendation") {
        expect(evaluation.outcome).not.toBeNull();
      }
    }
  );

  it.each(TEMPLATES.map((entry) => [entry.slug, entry] as const))(
    "%s has a unique field id per question and a title on each",
    (_slug, entry) => {
      const ids = entry.document.steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const step of entry.document.steps) expect(step.title.length).toBeGreaterThan(3);
    }
  );
});

describe("cleaning estimate", () => {
  const doc = templateBySlug("cleaning-estimate")!.document;

  it("prices a typical two-bed flat", () => {
    const evaluation = evaluateWidget(doc, {
      home_type: 40,
      bedrooms: 2,
      bathrooms: 1,
      extras: [30],
      frequency: 0,
    });
    // 40 base + 70 bedrooms + 25 bathroom + 30 oven
    expect(evaluation.value).toBe(165);
    expect(evaluation.range).toEqual({ low: 165, high: 198 });
    expect(evaluation.display).toBe("$165–$198");
  });

  it("discounts regular visits", () => {
    const weekly = evaluateWidget(doc, {
      home_type: 40,
      bedrooms: 2,
      bathrooms: 1,
      extras: [30],
      frequency: -15,
    });
    expect(weekly.value).toBe(150);
  });

  it("adds the large-home surcharge and says why", () => {
    const evaluation = evaluateWidget(doc, {
      home_type: 60,
      bedrooms: 5,
      bathrooms: 3,
      extras: [],
      frequency: 0,
    });
    // 40 surcharge + 60 base + 175 bedrooms + 75 bathrooms
    expect(evaluation.value).toBe(350);
    expect(evaluation.messages).toEqual(["Large homes are quoted for two cleaners."]);
  });

  it("gives customers a breakdown that adds up", () => {
    const evaluation = evaluateWidget(doc, {
      home_type: 40,
      bedrooms: 2,
      bathrooms: 1,
      extras: [30, 25],
      frequency: -10,
    });
    const sum = evaluation.breakdown.reduce((total, line) => total + line.amount, 0);
    expect(evaluation.breakdown.length).toBeGreaterThan(3);
    expect(sum).toBeCloseTo(evaluation.value, 6);
  });
});

describe("photography quote", () => {
  const doc = templateBySlug("photography-quote")!.document;

  it("only offers the engagement shoot to weddings", () => {
    const portrait = visibleSteps(doc, { package: 400 }).map((step) => step.id);
    const wedding = visibleSteps(doc, { package: 1500 }).map((step) => step.id);
    expect(portrait).not.toContain("engagement");
    expect(wedding).toContain("engagement");
  });

  it("ignores an engagement shoot booked on a portrait session", () => {
    // The step is hidden, so a stale answer must not appear on the invoice.
    const evaluation = evaluateWidget(doc, {
      package: 400,
      hours: 2,
      second_photographer: false,
      engagement: true,
      travel: 0,
    });
    expect(evaluation.value).toBe(400 + 2 * 120);
  });
});

describe("plan finder", () => {
  const doc = templateBySlug("which-plan")!.document;

  it("tells a solo hobbyist to stay on the free plan", () => {
    const evaluation = evaluateWidget(doc, {
      team_size: 1,
      goals: ["try"],
      volume: 200,
      branding: false,
    });
    expect(evaluation.outcome?.id).toBe("free");
  });

  it("moves them off free once they pass the free limits", () => {
    const evaluation = evaluateWidget(doc, {
      team_size: 1,
      goals: ["try", "leads"],
      volume: 4000,
      branding: true,
    });
    expect(evaluation.outcome?.id).toBe("pro");
  });

  it("sends a big rollout to Business", () => {
    const evaluation = evaluateWidget(doc, {
      team_size: 100,
      goals: ["scale"],
      volume: 15000,
      branding: true,
    });
    expect(evaluation.outcome?.id).toBe("business");
  });
});

describe("skincare finder", () => {
  const doc = templateBySlug("skincare-finder")!.document;

  it("always sends sensitive skin to the gentle set", () => {
    const evaluation = evaluateWidget(doc, {
      skin_type: "sensitive",
      concerns: ["dullness"],
      effort: "full",
    });
    expect(evaluation.outcome?.id).toBe("calm");
  });

  it("reads the concerns when skin type is neutral", () => {
    expect(
      evaluateWidget(doc, { skin_type: "combo", concerns: ["breakouts"], effort: "minimal" }).outcome?.id
    ).toBe("clarity");
  });
});
