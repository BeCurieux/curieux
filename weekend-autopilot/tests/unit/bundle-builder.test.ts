import { describe, expect, it } from "vitest";
import { assembleBundles } from "@/lib/planner/bundle-builder";
import { scoreBundle, scoreCandidate, totalElapsedMinutes } from "@/lib/planner/scoring";
import { SCORING_CONFIG } from "@/config/scoring";
import { context } from "../helpers/factories";
import { candidate } from "../helpers/candidates";
import type { Candidate, PlanningContext } from "@/lib/planner/types";

function assemble(candidates: Candidate[], ctx: PlanningContext, limit = 4) {
  for (const c of candidates) c.score = scoreCandidate(c, ctx);
  const bundles = assembleBundles(candidates, ctx, { limit });
  for (const bundle of bundles) scoreBundle(bundle, ctx);
  return bundles;
}

/** A beach, a café near it, and a bakery near both — a normal candidate set. */
function typicalCandidates() {
  return [
    candidate({
      name: "Balmoral Beach",
      categories: ["beaches"],
      lat: -33.8266,
      lng: 151.2513,
      travelMinutes: 30,
      durationMinutes: 90,
      walkKm: 1,
    }),
    candidate({
      name: "The Boathouse",
      categories: ["food"],
      role: "FOOD",
      publicSpace: false,
      lat: -33.8272,
      lng: 151.2519,
      travelMinutes: 31,
      cost: { min: 30, max: 55, certain: false },
      durationMinutes: 70,
    }),
    candidate({
      name: "Harbour Bakery",
      categories: ["bakeries"],
      role: "ADDON",
      publicSpace: false,
      lat: -33.828,
      lng: 151.2505,
      travelMinutes: 30,
      cost: { min: 8, max: 18, certain: false },
      durationMinutes: 25,
    }),
  ];
}

describe("assembleBundles", () => {
  it("builds a day with a beginning, a middle and a way home", () => {
    const ctx = context();
    const [bundle] = assemble(typicalCandidates(), ctx);
    expect(bundle).toBeDefined();

    const first = bundle!.items[0];
    const last = bundle!.items[bundle!.items.length - 1];
    expect(first?.item_type).toBe("TRAVEL");
    expect(last?.name).toBe("Head home");
  });

  it("never uses the same place twice in one day", () => {
    // Regression: a harbour kiosk matches both "coffee" and the add-on search,
    // and was being scheduled as the morning stop and lunch.
    const kiosk = candidate({
      name: "Harbour Kiosk",
      categories: ["coffee"],
      publicSpace: false,
      lat: -33.8452,
      lng: 151.2515,
      travelMinutes: 28,
    });
    const beach = candidate({
      name: "Balmoral Beach",
      categories: ["beaches"],
      lat: -33.8266,
      lng: 151.2513,
      travelMinutes: 30,
    });

    const ctx = context({ preferences: { time_budget: "MOST_OF_DAY" } });
    const [bundle] = assemble([beach, kiosk], ctx);

    const visited = bundle!.items
      .filter((i) => i.candidate)
      .map((i) => i.candidate!.provider_place_id);
    expect(new Set(visited).size).toBe(visited.length);
  });

  it("marks the anchor as the critical item, not whatever is scheduled first", () => {
    // Regression: an early bakery was being marked critical, which meant
    // verification weighted the pastry above the reason for the day.
    const ctx = context({ preferences: { time_budget: "MOST_OF_DAY" } });
    const candidates = typicalCandidates();
    const [bundle] = assemble(candidates, ctx);

    const critical = bundle!.items.filter((i) => i.is_critical);
    expect(critical).toHaveLength(1);
    expect(critical[0]?.candidate?.provider_place_id).toBe(bundle!.anchor.provider_place_id);
  });

  it("keeps the day to a relaxed number of components", () => {
    const ctx = context({ preferences: { time_budget: "MOST_OF_DAY" } });
    const [bundle] = assemble(typicalCandidates(), ctx);

    const meaningful = bundle!.items.filter(
      (i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK"
    );
    expect(meaningful.length).toBeGreaterThanOrEqual(SCORING_CONFIG.ideal_components.min);
    expect(meaningful.length).toBeLessThanOrEqual(SCORING_CONFIG.ideal_components.max);
  });

  it("produces a timeline with no overlapping items", () => {
    const ctx = context();
    const [bundle] = assemble(typicalCandidates(), ctx);

    for (let i = 1; i < bundle!.items.length; i++) {
      const previous = bundle!.items[i - 1]!;
      const current = bundle!.items[i]!;
      expect(current.start_time >= previous.end_time).toBe(true);
    }
  });

  it("skips the add-on when the household only has a few hours", () => {
    const short = context({ preferences: { time_budget: "FEW_HOURS" } });
    const [bundle] = assemble(typicalCandidates(), short);

    const meaningful = bundle!.items.filter(
      (i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK"
    );
    expect(meaningful.length).toBeLessThanOrEqual(2);
  });

  it("skips the add-on when they told us their energy is low", () => {
    const tired = context({
      preferences: { time_budget: "MOST_OF_DAY" },
      checkin: {
        id: "c",
        household_id: "household-1",
        weekend_date: "2026-03-14",
        energy: "LOW",
        budget: null,
        time: null,
        note: null,
        created_at: "",
        updated_at: "",
      },
    });
    const [bundle] = assemble(typicalCandidates(), tired);
    const meaningful = bundle!.items.filter(
      (i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK"
    );
    expect(meaningful.length).toBeLessThanOrEqual(2);
  });

  it("builds one bundle per anchor rather than several around the same place", () => {
    const beach = candidate({ name: "Beach", categories: ["beaches"], lat: -33.83, lng: 151.25 });
    const garden = candidate({
      name: "Garden",
      categories: ["gardens"],
      lat: -33.86,
      lng: 151.21,
    });
    const food = candidate({
      name: "Lunch",
      categories: ["food"],
      role: "FOOD",
      publicSpace: false,
      lat: -33.84,
      lng: 151.24,
      cost: { min: 20, max: 40, certain: false },
    });

    const ctx = context();
    const bundles = assemble([beach, garden, food], ctx);
    const anchors = bundles.map((b) => b.anchor.provider_place_id);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("refuses to build a day that does not fit the time available", () => {
    const ctx = context({ preferences: { time_budget: "FEW_HOURS", max_travel_minutes: 90 } });
    // A distant anchor with a long stay cannot fit into three hours.
    const distant = candidate({
      categories: ["day_trips"],
      lat: -33.7185,
      lng: 150.3736,
      travelMinutes: 85,
      durationMinutes: 240,
    });
    const bundles = assemble([distant], ctx);
    expect(bundles).toHaveLength(0);
  });

  it("accounts for the journey home in the finish time", () => {
    const ctx = context();
    const [bundle] = assemble(typicalCandidates(), ctx);
    const lastStop = [...bundle!.items].reverse().find((i) => i.candidate);
    expect(bundle!.end_time > (lastStop?.end_time ?? "00:00")).toBe(true);
  });

  it("derives the activity level from how much walking there is", () => {
    const ctx = context({
      preferences: { activity_level: "ACTIVE", desired_activity_level: "ACTIVE" },
    });
    const longWalk = candidate({ categories: ["easy_walks"], walkKm: 9, durationMinutes: 150 });
    const shortWalk = candidate({ categories: ["gardens"], walkKm: 1, durationMinutes: 60 });

    const [active] = assemble([longWalk], ctx);
    const [gentle] = assemble([shortWalk], ctx);

    expect(active!.activity_level).toBe("ACTIVE");
    expect(gentle!.activity_level).toBe("GENTLE");
  });
});

describe("scoreBundle", () => {
  it("penalises a day that spends most of itself travelling", () => {
    const ctx = context({ preferences: { max_travel_minutes: 90 } });
    const near = assemble(
      [candidate({ travelMinutes: 10, durationMinutes: 120, lat: -33.9, lng: 151.16 })],
      ctx
    )[0];
    const far = assemble(
      [candidate({ travelMinutes: 85, durationMinutes: 120, lat: -33.72, lng: 150.38 })],
      ctx
    )[0];

    expect(near!.score_detail.dimensions.travel_share).toBeGreaterThan(
      far!.score_detail.dimensions.travel_share ?? 0
    );
  });

  it("reports an elapsed time that matches the timeline", () => {
    const ctx = context();
    const [bundle] = assemble(typicalCandidates(), ctx);
    const elapsed = totalElapsedMinutes(bundle!);
    expect(elapsed).toBeGreaterThan(60);
    expect(elapsed).toBeLessThan(12 * 60);
  });
});
