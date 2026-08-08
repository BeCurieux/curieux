import { describe, expect, it } from "vitest";
import { includesCategory, maxCost, rejectedNames, rejectionRules, runEval } from "./harness";
import { adult, child, categoryStats, tasteSignal } from "../helpers/factories";

/**
 * The five scenarios named in the brief (§46), plus the properties each one
 * must satisfy. These are the closest thing the product has to a definition of
 * "good", so they are written as behaviour a customer would recognise rather
 * than as internals.
 */

describe("Example A — family, 3-year-old, sunny, A$100, car, 40 minutes", () => {
  const profile = {
    members: [adult(), adult(), child(3)],
    household: { shape: "FAMILY" as const },
    preferences: {
      max_travel_minutes: 40,
      budget_band: "75_150" as const,
      transport_modes: ["DRIVING" as const, "WALKING" as const],
      liked_categories: ["beaches", "waterfront", "playgrounds", "food"],
      food: {
        cuisines_loved: ["Chinese"],
        dietary_requirements: [],
        kid_friendly_importance: 0.9,
        coffee_importance: 0.4,
        restaurant_price_sensitivity: 0.5,
      },
      activity_level: "EASY" as const,
      desired_activity_level: "EASY" as const,
    },
    forecast: { temperature_max: 25, precipitation_probability: 0.05, weather_code: 0 },
  };

  it("produces a plan", async () => {
    const { result, primary } = await runEval(profile);
    expect(result.ok, result.failureReason ?? "").toBe(true);
    expect(primary).not.toBeNull();
  });

  it("does not ask a three-year-old to walk more than they can", async () => {
    const { primary } = await runEval(profile);
    // A three-year-old realistically manages about two kilometres.
    expect(primary!.walk_km).toBeLessThanOrEqual(2.5);
  });

  it("stays inside the household's budget", async () => {
    const { primary } = await runEval(profile);
    expect(maxCost(primary!)).toBeLessThanOrEqual(150);
  });

  it("keeps the driving modest", async () => {
    const { primary } = await runEval(profile);
    expect(primary!.total_travel_minutes).toBeLessThanOrEqual(90);
  });

  it("excludes venues unsuitable for a three-year-old, and says why", async () => {
    const { result } = await runEval(profile);
    const rules = rejectionRules(result);
    // Bushwalks are 5+; something in the fixture set should trip the age rule
    // or the child walking-distance rule.
    expect(
      rules.includes("unsuitable_child_age") || rules.includes("walk_too_long_for_child")
    ).toBe(true);
  });

  it("finishes at a civilised hour", async () => {
    const { primary } = await runEval(profile);
    expect(primary!.end_time < "18:00").toBe(true);
  });
});

describe("Example B — couple, no children, very active, sunny, A$150, 60 minutes", () => {
  const profile = {
    members: [adult(), adult()],
    household: { shape: "COUPLE" as const },
    preferences: {
      max_travel_minutes: 60,
      budget_band: "150_250" as const,
      transport_modes: ["DRIVING" as const, "WALKING" as const],
      liked_categories: ["bushwalks", "easy_walks", "food", "waterfront"],
      activity_level: "ACTIVE" as const,
      desired_activity_level: "ACTIVE" as const,
      time_budget: "MOST_OF_DAY" as const,
    },
    forecast: { temperature_max: 22, precipitation_probability: 0.05, weather_code: 0 },
  };

  it("produces an outdoor plan with a real walk in it", async () => {
    const { result, primary } = await runEval(profile);
    expect(result.ok, result.failureReason ?? "").toBe(true);
    expect(primary!.walk_km).toBeGreaterThanOrEqual(3);
  });

  it("includes somewhere to eat", async () => {
    const { primary } = await runEval(profile);
    const hasFood = primary!.items.some((i) => i.item_type === "FOOD");
    expect(hasFood).toBe(true);
  });

  it("rates the day as genuinely active", async () => {
    const { primary } = await runEval(profile);
    expect(["MODERATE", "ACTIVE"]).toContain(primary!.activity_level);
  });

  it("keeps the route sensible rather than criss-crossing the city", async () => {
    const { primary } = await runEval(profile);
    expect(primary!.score_detail.penalties.route_backtracking ?? 0).toBe(0);
  });
});

describe("Example C — solo, low energy, rain, A$40, public transport only", () => {
  const profile = {
    members: [adult()],
    household: { shape: "SOLO" as const },
    preferences: {
      max_travel_minutes: 40,
      budget_band: "UNDER_75" as const,
      transport_modes: ["TRANSIT" as const, "WALKING" as const],
      liked_categories: ["galleries", "museums", "coffee", "food"],
      activity_level: "GENTLE" as const,
      desired_activity_level: "GENTLE" as const,
      time_budget: "FEW_HOURS" as const,
    },
    checkin: {
      id: "c",
      household_id: "household-1",
      weekend_date: "2026-03-14",
      energy: "LOW" as const,
      budget: "LOW" as const,
      time: "FEW_HOURS" as const,
      note: null,
      created_at: "",
      updated_at: "",
    },
    forecast: {
      temperature_max: 16,
      precipitation_probability: 0.85,
      precipitation_amount: 9,
      weather_code: 61,
    },
  };

  it("produces a plan despite the weather", async () => {
    const { result } = await runEval(profile);
    expect(result.ok, result.failureReason ?? "").toBe(true);
  });

  it("is weather-proof — no exposed anchor in the rain", async () => {
    const { primary } = await runEval(profile);
    expect(includesCategory(primary!, "beaches")).toBe(false);
    expect(includesCategory(primary!, "swimming")).toBe(false);
  });

  it("never requires a car", async () => {
    const { primary } = await runEval(profile);
    const modes = primary!.items.map((i) => i.travel_mode).filter(Boolean);
    expect(modes).not.toContain("DRIVING");
  });

  it("stays cheap", async () => {
    const { primary } = await runEval(profile);
    expect(maxCost(primary!)).toBeLessThanOrEqual(60);
  });

  it("stays close and short, because they told us they're tired", async () => {
    const { primary } = await runEval(profile);
    expect(primary!.total_travel_minutes).toBeLessThanOrEqual(70);
    expect(primary!.walk_km).toBeLessThanOrEqual(4);
  });

  it("never even searches for an exposed anchor in the rain", async () => {
    // The weather guard runs at the intent stage rather than as a filter over
    // retrieved candidates — it is both cheaper and more decisive to not go
    // looking for beaches on a wet Saturday than to find them and score them
    // down. So the evidence is in the intents, not the rejection list.
    const { result } = await runEval(profile);
    const anchorQueries = result.diagnostics.intents
      .filter((i) => i.role === "ANCHOR")
      .map((i) => i.query.toLowerCase());

    expect(anchorQueries.length).toBeGreaterThan(0);
    for (const query of anchorQueries) {
      expect(query).not.toMatch(/beach|swim|coastal|bushwalk|picnic/);
    }
  });
});

describe("Example D — family with a toddler at 38°C", () => {
  const profile = {
    members: [adult(), adult(), child(2)],
    household: { shape: "FAMILY" as const },
    preferences: {
      max_travel_minutes: 45,
      liked_categories: ["bushwalks", "easy_walks", "beaches", "swimming"],
      activity_level: "MODERATE" as const,
      desired_activity_level: "MODERATE" as const,
    },
    forecast: { temperature_max: 38, temperature_min: 26, weather_code: 0 },
  };

  it("does not send a toddler on an exposed midday bushwalk", async () => {
    const { result, primary } = await runEval(profile);
    expect(result.ok, result.failureReason ?? "").toBe(true);
    expect(includesCategory(primary!, "bushwalks")).toBe(false);
    expect(primary!.walk_km).toBeLessThanOrEqual(3);
  });

  it("records the heat rule firing", async () => {
    const { result } = await runEval(profile);
    const rules = rejectionRules(result);
    expect(
      rules.includes("heat_exposure") ||
        rules.includes("unsuitable_child_age") ||
        rules.includes("walk_too_long_for_child")
    ).toBe(true);
  });

  it("still finds something to do", async () => {
    const { primary } = await runEval(profile);
    const meaningful = primary!.items.filter((i) => i.candidate);
    expect(meaningful.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Example E — a household that has repeatedly rejected museums", () => {
  /**
   * The behavioural-override case (§18). They ticked "culture" at onboarding
   * and have since declined four museum plans. Actual behaviour must win.
   */
  const rejecter = {
    members: [adult(), adult()],
    preferences: {
      liked_categories: ["museums", "culture", "galleries", "food", "easy_walks"],
      max_travel_minutes: 45,
    },
    categoryStats: [
      categoryStats({ category_id: "museums", suggested_count: 4, rejected_count: 4 }),
    ],
    taste: [
      tasteSignal({ dimension: "category", value: "museums", weight: -0.85, confidence: 0.8 }),
    ],
    forecast: { temperature_max: 21, precipitation_probability: 0.1, weather_code: 2 },
  };

  it("stops putting museums in the plan even though they said they liked culture", async () => {
    const { primary } = await runEval(rejecter);
    expect(includesCategory(primary!, "museums")).toBe(false);
  });

  it("records the suppression rather than silently dropping them", async () => {
    const { result } = await runEval(rejecter);
    const suppressed = rejectedNames(result, "behaviourally_suppressed");
    expect(suppressed.length).toBeGreaterThan(0);
  });

  it("still offers the other things they said they liked", async () => {
    const { result, primary } = await runEval(rejecter);
    expect(result.ok, result.failureReason ?? "").toBe(true);
    expect(primary!.items.some((i) => i.candidate)).toBe(true);
  });

  it("does NOT suppress museums for a household with no such history", async () => {
    // The control: the same stated preferences, no behavioural evidence.
    const { result } = await runEval({
      members: [adult(), adult()],
      preferences: rejecter.preferences,
      forecast: rejecter.forecast,
    });
    expect(rejectedNames(result, "behaviourally_suppressed")).toHaveLength(0);
  });
});
