import { describe, expect, it } from "vitest";
import { MAX_BASE_SCORE, SCORING_WEIGHTS } from "@/config/scoring";
import { scoreCandidate } from "@/lib/planner/scoring";
import { context, categoryStats, tasteSignal } from "../helpers/factories";
import { candidate } from "../helpers/candidates";

describe("scoring weights", () => {
  it("sums to 100, so a score is a percentage and not an arbitrary number", () => {
    expect(MAX_BASE_SCORE).toBe(100);
  });

  it("keeps interest fit as the single largest dimension", () => {
    const others = Object.entries(SCORING_WEIGHTS)
      .filter(([name]) => name !== "personal_interest_fit")
      .map(([, weight]) => weight);
    expect(SCORING_WEIGHTS.personal_interest_fit).toBeGreaterThanOrEqual(Math.max(...others));
  });
});

describe("scoreCandidate", () => {
  it("is deterministic — the same inputs always score the same", () => {
    const ctx = context();
    const c = candidate({ categories: ["beaches"] });
    const first = scoreCandidate(c, ctx);
    const second = scoreCandidate(candidate({ categories: ["beaches"] }), ctx);
    expect(first.total).toBe(second.total);
  });

  it("scores a stated interest above an unrelated category", () => {
    const ctx = context({ preferences: { liked_categories: ["beaches"] } });
    const liked = scoreCandidate(candidate({ categories: ["beaches"] }), ctx);
    const unrelated = scoreCandidate(candidate({ categories: ["museums"] }), ctx);
    expect(liked.total).toBeGreaterThan(unrelated.total);
  });

  it("prefers a closer candidate when everything else matches", () => {
    const ctx = context();
    const near = scoreCandidate(candidate({ travelMinutes: 12 }), ctx);
    const far = scoreCandidate(candidate({ travelMinutes: 38 }), ctx);
    expect(near.total).toBeGreaterThan(far.total);
  });

  it("treats a free anchor as a positive rather than merely neutral", () => {
    const ctx = context();
    const free = scoreCandidate(candidate({ cost: { min: 0, max: 0, certain: true } }), ctx);
    const paid = scoreCandidate(candidate({ cost: { min: 40, max: 60, certain: true } }), ctx);
    expect(free.dimensions.budget_fit).toBeGreaterThan(paid.dimensions.budget_fit ?? 0);
  });

  it("penalises an uncertain price", () => {
    const ctx = context();
    const uncertain = scoreCandidate(
      candidate({ cost: { min: 20, max: 45, certain: false } }),
      ctx
    );
    expect(uncertain.penalties.uncertain_price).toBeGreaterThan(0);
  });

  it("penalises a busy venue for a crowd-averse household", () => {
    const ctx = context({ preferences: { crowd_tolerance: 0.2, dislikes: ["crowds"] } });
    const busy = scoreCandidate(candidate({ busyness: 0.95 }), ctx);
    expect(busy.penalties.crowd_mismatch).toBeGreaterThan(0);
  });

  it("applies the explicit-dislike penalty to a behaviourally suppressed category", () => {
    const ctx = context({
      preferences: { liked_categories: ["museums"] },
      categoryStats: [categoryStats({ category_id: "museums", rejected_count: 4 })],
    });
    const scored = scoreCandidate(candidate({ categories: ["museums"] }), ctx);
    expect(scored.penalties.explicit_dislike).toBeGreaterThan(0);
  });

  it("lets confident behavioural evidence outweigh the onboarding selection", () => {
    // Ticked at signup, then consistently declined.
    const stated = context({ preferences: { liked_categories: ["museums"] } });
    const learned = context({
      preferences: { liked_categories: ["museums"] },
      taste: [
        tasteSignal({ dimension: "category", value: "museums", weight: -0.9, confidence: 0.9 }),
      ],
    });

    const before = scoreCandidate(candidate({ categories: ["museums"] }), stated);
    const after = scoreCandidate(candidate({ categories: ["museums"] }), learned);

    expect(after.dimensions.personal_interest_fit).toBeLessThan(
      before.dimensions.personal_interest_fit ?? 0
    );
  });

  it("never returns a negative total", () => {
    const ctx = context({
      preferences: { liked_categories: [], crowd_tolerance: 0, dislikes: ["crowds"] },
      categoryStats: [categoryStats({ category_id: "museums", rejected_count: 5 })],
    });
    const scored = scoreCandidate(
      candidate({
        categories: ["museums"],
        travelMinutes: 39,
        busyness: 1,
        cost: { min: 70, max: 70, certain: false },
      }),
      ctx
    );
    expect(scored.total).toBeGreaterThanOrEqual(0);
  });
});

describe("weather fit", () => {
  it("rewards an exposed outdoor anchor on a fine day", () => {
    const ctx = context({ weather: { temperature_max: 24, precipitation_probability: 0.05 } });
    const scored = scoreCandidate(candidate({ categories: ["beaches"] }), ctx);
    expect(scored.dimensions.weather_fit).toBeGreaterThan(10);
  });

  it("prefers an indoor anchor when it is going to rain", () => {
    const wet = context({
      weather: { precipitation_probability: 0.8, precipitation_amount: 8, weather_code: 61 },
    });
    const indoor = scoreCandidate(candidate({ categories: ["galleries"] }), wet);
    const outdoor = scoreCandidate(candidate({ categories: ["beaches"] }), wet);
    expect(indoor.dimensions.weather_fit).toBeGreaterThan(outdoor.dimensions.weather_fit ?? 0);
  });

  it("treats swimming as the right answer in serious heat", () => {
    const hot = context({ weather: { temperature_max: 38 } });
    const swim = scoreCandidate(candidate({ categories: ["swimming"] }), hot);
    const walk = scoreCandidate(candidate({ categories: ["easy_walks"] }), hot);
    expect(swim.dimensions.weather_fit).toBeGreaterThan(walk.dimensions.weather_fit ?? 0);
  });

  it("stays neutral rather than optimistic when there is no forecast", () => {
    const ctx = context({ weather: null });
    const scored = scoreCandidate(candidate({ categories: ["beaches"] }), ctx);
    // 0.6 of the 15-point weather weight.
    expect(scored.dimensions.weather_fit).toBeCloseTo(9, 1);
  });
});
