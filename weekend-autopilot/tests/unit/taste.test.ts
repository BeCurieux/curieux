import { describe, expect, it } from "vitest";
import { applyDelta, seedFromOnboarding, type SignalDelta } from "@/lib/taste/signals";
import { deltasFromFeedback, shouldSuppress, updatedStats } from "@/lib/taste/updater";
import { categoryStats, preferences, tasteSignal } from "../helpers/factories";
import type { PlanWithItems, PlanItem } from "@/lib/types";

function delta(overrides: Partial<SignalDelta> = {}): SignalDelta {
  return {
    dimension: "category",
    value: "beaches",
    delta: 0.5,
    source: "ONBOARDING",
    evidence: "test",
    ...overrides,
  };
}

describe("applyDelta", () => {
  it("starts a new signal at low confidence however strong the evidence", () => {
    const result = applyDelta(null, delta({ delta: 1, source: "LOVED_IT" }));
    expect(result.confidence).toBeLessThanOrEqual(0.35);
  });

  it("weights doing something far above ticking a box about it", () => {
    const stated = applyDelta(null, delta({ delta: 0.6, source: "ONBOARDING" }));
    const done = applyDelta(null, delta({ delta: 0.6, source: "DID_IT" }));
    expect(done.weight).toBeGreaterThan(stated.weight);
  });

  it("raises confidence when new evidence agrees", () => {
    const existing = tasteSignal({ weight: 0.5, confidence: 0.4 });
    const result = applyDelta(existing, delta({ delta: 0.5, source: "DID_IT" }));
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it("lowers confidence when new evidence contradicts", () => {
    const existing = tasteSignal({ weight: 0.8, confidence: 0.8 });
    const result = applyDelta(existing, delta({ delta: -0.6, source: "PLAN_REJECTED" }));
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.weight).toBeLessThan(0.8);
  });

  it("does not overturn a well-established signal on one bad weekend", () => {
    const established = tasteSignal({ weight: 0.9, confidence: 0.9 });
    const result = applyDelta(established, delta({ delta: -0.6, source: "PLAN_REJECTED" }));
    // Weakened, but still positive.
    expect(result.weight).toBeGreaterThan(0);
  });

  it("keeps weights inside −1…1", () => {
    let signal = tasteSignal({ weight: 0.95, confidence: 0.9 });
    for (let i = 0; i < 10; i++) {
      const next = applyDelta(signal, delta({ delta: 1, source: "LOVED_IT" }));
      signal = { ...signal, ...next };
    }
    expect(signal.weight).toBeLessThanOrEqual(1);
  });
});

describe("seedFromOnboarding", () => {
  it("creates a positive signal for each selected category", () => {
    const deltas = seedFromOnboarding(
      preferences({ liked_categories: ["beaches", "food"] })
    );
    const categories = deltas.filter((d) => d.dimension === "category");
    expect(categories).toHaveLength(2);
    expect(categories.every((d) => d.delta > 0)).toBe(true);
  });

  it("turns a dislike into a negative category signal where one maps", () => {
    const deltas = seedFromOnboarding(preferences({ dislikes: ["steep_hikes"] }));
    const bushwalks = deltas.find((d) => d.value === "bushwalks");
    expect(bushwalks?.delta).toBeLessThan(0);
  });

  it("records crowd aversion as a tolerance rather than a category", () => {
    const deltas = seedFromOnboarding(preferences({ dislikes: ["crowds"] }));
    const tolerance = deltas.filter((d) => d.dimension === "crowd_tolerance");
    expect(tolerance.length).toBeGreaterThan(0);
    expect(Number(tolerance.at(-1)?.value)).toBeLessThan(0.5);
  });

  it("marks everything as ONBOARDING, so evidence weighting applies", () => {
    const deltas = seedFromOnboarding(preferences());
    expect(deltas.every((d) => d.source === "ONBOARDING")).toBe(true);
  });
});

// ------------------------------------------------------------ feedback

function planWithItems(overrides: Partial<PlanWithItems> = {}): PlanWithItems {
  const item = (id: string, type: PlanItem["item_type"], critical: boolean): PlanItem =>
    ({
      id,
      plan_id: "plan-1",
      sequence: 0,
      item_type: type,
      title: id,
      description: null,
      provider: "test",
      provider_place_id: id,
      place_ref_id: null,
      lat: null,
      lng: null,
      address: null,
      start_time: "09:30",
      end_time: "11:00",
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      walk_distance_km: null,
      travel_mode: null,
      booking_required: false,
      booking_url: null,
      commercial_url: null,
      affiliate_url: null,
      affiliate_provider: null,
      maps_url: null,
      verification_status: "VERIFIED",
      verification_timestamp: null,
      verification_notes: null,
      is_critical: critical,
      source_provenance: { facts: {}, model_fields: [], ai_run_id: null },
      created_at: "",
      updated_at: "",
    }) satisfies PlanItem;

  return {
    id: "plan-1",
    household_id: "household-1",
    user_id: "user-1",
    market_id: "sydney",
    weekend_date: "2026-03-14",
    plan_duration_days: 1,
    plan_type: "PRIMARY",
    title: "A walk and lunch",
    short_description: "",
    start_time: "09:30",
    estimated_finish_time: "14:00",
    estimated_total_cost_min: 40,
    estimated_total_cost_max: 70,
    currency: "AUD",
    total_travel_minutes: 30,
    total_activity_distance_km: 5,
    activity_level: "EASY",
    weather_summary: null,
    fit_reason: "",
    confidence_score: 0.8,
    base_score: 70,
    verification_score: 1,
    status: "DELIVERED",
    swap_reason: null,
    swapped_from_plan_id: null,
    generation_run_id: null,
    created_at: "",
    verified_at: null,
    delivered_at: null,
    opened_at: null,
    completed_at: null,
    updated_at: "",
    items: [item("anchor", "WALK", true), item("food", "FOOD", false)],
    ...overrides,
  };
}

const CATEGORIES_BY_ITEM = new Map([
  ["anchor", ["waterfront"]],
  ["food", ["food"]],
]);

describe("deltasFromFeedback", () => {
  it("treats completion as a strong positive for the anchor", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "YES", rating: null, not_done_reason: null },
      CATEGORIES_BY_ITEM
    );
    const anchor = deltas.find((d) => d.value === "waterfront");
    expect(anchor?.delta).toBeGreaterThan(0);
    expect(anchor?.source).toBe("DID_IT");
  });

  it("attributes 'loved it' more to the anchor than to the café", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "YES", rating: "LOVED", not_done_reason: null },
      CATEGORIES_BY_ITEM
    );
    const anchor = deltas.filter((d) => d.value === "waterfront" && d.source === "LOVED_IT")[0];
    const food = deltas.filter((d) => d.value === "food")[0];
    expect(anchor!.delta).toBeGreaterThan(food!.delta);
  });

  it("learns the shape of a loved day, not just its subject", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "YES", rating: "LOVED", not_done_reason: null },
      CATEGORIES_BY_ITEM
    );
    expect(deltas.some((d) => d.dimension === "walk_preferred_km")).toBe(true);
    expect(deltas.some((d) => d.dimension === "start_time")).toBe(true);
  });

  it("learns nothing about taste when the reason was 'plans changed'", () => {
    // The critical case: someone's sister visited. That says nothing about
    // whether they like waterfronts, and recording it as a rejection would
    // teach the engine nonsense.
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "NO", rating: null, not_done_reason: "PLANS_CHANGED" },
      CATEGORIES_BY_ITEM
    );
    expect(deltas).toHaveLength(0);
  });

  it("learns nothing about taste when our own weather logic failed", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "NO", rating: null, not_done_reason: "WEATHER" },
      CATEGORIES_BY_ITEM
    );
    expect(deltas).toHaveLength(0);
  });

  it("turns 'too far' into a travel signal, not a category signal", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "NO", rating: null, not_done_reason: "TOO_FAR" },
      CATEGORIES_BY_ITEM
    );
    expect(deltas.every((d) => d.dimension === "travel_max_minutes")).toBe(true);
    expect(Number(deltas[0]!.value)).toBeLessThan(30);
  });

  it("turns 'too expensive' into a spend signal", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "NO", rating: null, not_done_reason: "TOO_EXPENSIVE" },
      CATEGORIES_BY_ITEM
    );
    expect(deltas[0]?.dimension).toBe("spend_activity");
  });

  it("only downweights the category when they say it didn't appeal", () => {
    const deltas = deltasFromFeedback(
      planWithItems(),
      { did_it: "NO", rating: null, not_done_reason: "DIDNT_APPEAL" },
      CATEGORIES_BY_ITEM
    );
    const anchor = deltas.find((d) => d.value === "waterfront");
    expect(anchor?.delta).toBeLessThan(0);
  });
});

describe("suppression (the museum case from the brief)", () => {
  it("suppresses a category after four rejections and no completions", () => {
    let stats = categoryStats({ category_id: "museums" });
    for (let i = 0; i < 4; i++) {
      stats = updatedStats(stats, { didIt: "NO" }, "2026-03-14T00:00:00Z");
    }
    expect(shouldSuppress(stats)).toBe(true);
  });

  it("does not suppress when they have actually done one", () => {
    let stats = categoryStats({ category_id: "museums" });
    stats = updatedStats(stats, { didIt: "YES" }, "2026-01-01T00:00:00Z");
    for (let i = 0; i < 4; i++) {
      stats = updatedStats(stats, { didIt: "NO" }, "2026-03-14T00:00:00Z");
    }
    expect(shouldSuppress(stats)).toBe(false);
  });

  it("counts a completion as both accepted and completed", () => {
    const stats = updatedStats(
      categoryStats(),
      { didIt: "YES", rating: "LOVED" },
      "2026-03-14T00:00:00Z"
    );
    expect(stats.completed_count).toBe(1);
    expect(stats.accepted_count).toBe(1);
    expect(stats.loved_count).toBe(1);
    expect(stats.last_completed_at).toBe("2026-03-14T00:00:00Z");
  });
});
