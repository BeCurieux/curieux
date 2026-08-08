import { describe, expect, it } from "vitest";
import { applyHardFilters, childWalkCapKm, chargeableHeads } from "@/lib/planner/filters";
import { context, adult, child, categoryStats } from "../helpers/factories";
import { candidate, openAllWeekend, UNKNOWN_HOURS } from "../helpers/candidates";

/** Convenience: run one candidate through the filters and report the rule. */
function ruleFor(c: ReturnType<typeof candidate>, ctx: ReturnType<typeof context>) {
  const { kept, rejected } = applyHardFilters([c], ctx);
  if (kept.length === 1) return null;
  return rejected[0]?.rejection?.rule ?? "unknown";
}

describe("travel and transport", () => {
  it("rejects a candidate beyond the household's travel budget", () => {
    const ctx = context({ preferences: { max_travel_minutes: 30 } });
    expect(ruleFor(candidate({ travelMinutes: 55 }), ctx)).toBe("outside_travel_radius");
  });

  it("keeps a candidate inside the budget", () => {
    const ctx = context({ preferences: { max_travel_minutes: 40 } });
    expect(ruleFor(candidate({ travelMinutes: 35 }), ctx)).toBeNull();
  });

  it("stretches the radius for an anchor when they asked to be surprised", () => {
    const ctx = context({
      preferences: { max_travel_minutes: 40, allow_occasional_further: true },
    });
    // 50 minutes is over 40 but inside the 1.35 stretch for anchors.
    expect(ruleFor(candidate({ travelMinutes: 50, role: "ANCHOR" }), ctx)).toBeNull();
  });

  it("does not stretch the radius for a food stop", () => {
    const ctx = context({
      preferences: { max_travel_minutes: 40, allow_occasional_further: true },
    });
    expect(ruleFor(candidate({ travelMinutes: 50, role: "FOOD" }), ctx)).toBe(
      "outside_travel_radius"
    );
  });

  it("rejects a candidate only reachable by a mode the household lacks", () => {
    const ctx = context({ preferences: { transport_modes: ["TRANSIT", "WALKING"] } });
    expect(ruleFor(candidate({ travelMode: "DRIVING" }), ctx)).toBe("incompatible_transport");
  });
});

describe("opening hours", () => {
  it("rejects a permanently closed venue", () => {
    const ctx = context();
    const closed = candidate({
      publicSpace: false,
      openingHours: { periods: {}, permanently_closed: true, unknown: false },
    });
    expect(ruleFor(closed, ctx)).toBe("permanently_closed");
  });

  it("rejects a venue closed on the target day", () => {
    const ctx = context();
    // Open weekdays only; the test weekend is a Saturday.
    const weekdaysOnly = candidate({
      publicSpace: false,
      openingHours: {
        periods: { 1: [{ open: "09:00", close: "17:00" }] },
        permanently_closed: false,
        unknown: false,
      },
    });
    expect(ruleFor(weekdaysOnly, ctx)).toBe("closed_on_target_day");
  });

  it("rejects a venue whose hours miss the household's usable window", () => {
    // Household is out 09:00 for five hours; this place opens at 18:00.
    const ctx = context({ preferences: { start_time_preference: "AROUND_9" } });
    const evening = candidate({
      publicSpace: false,
      openingHours: openAllWeekend("18:00", "23:00"),
    });
    expect(ruleFor(evening, ctx)).toBe("closed_during_usable_window");
  });

  it("does NOT reject a venue whose hours are simply unknown", () => {
    // Unknown is penalised later, not rejected: conflating "we don't know"
    // with "closed" would delete most small venues from the pool.
    const ctx = context();
    const unknown = candidate({ publicSpace: false, openingHours: UNKNOWN_HOURS });
    expect(ruleFor(unknown, ctx)).toBeNull();
  });

  it("does not apply opening hours to a public space", () => {
    const ctx = context();
    expect(ruleFor(candidate({ publicSpace: true, openingHours: null }), ctx)).toBeNull();
  });
});

describe("child suitability", () => {
  it("rejects a category below the youngest child's age", () => {
    const ctx = context({ members: [adult(), adult(), child(3)] });
    // Bushwalks are marked 5+.
    expect(ruleFor(candidate({ categories: ["bushwalks"], walkKm: 1 }), ctx)).toBe(
      "unsuitable_child_age"
    );
  });

  it("rejects a walk longer than a small child could realistically manage", () => {
    const ctx = context({ members: [adult(), child(4)] });
    expect(ruleFor(candidate({ categories: ["easy_walks"], walkKm: 6 }), ctx)).toBe(
      "walk_too_long_for_child"
    );
  });

  it("allows the same walk for a household of adults", () => {
    const ctx = context({ members: [adult(), adult()] });
    expect(ruleFor(candidate({ categories: ["easy_walks"], walkKm: 6 }), ctx)).toBeNull();
  });

  it("scales the realistic walking distance with age", () => {
    expect(childWalkCapKm(2)).toBeLessThan(childWalkCapKm(5));
    expect(childWalkCapKm(5)).toBeLessThan(childWalkCapKm(10));
  });

  it("rejects an adult-only venue when there are young children", () => {
    const ctx = context({ members: [adult(), child(4)] });
    expect(ruleFor(candidate({ categories: ["wellness"], publicSpace: false }), ctx)).toBe(
      "adult_only_destination"
    );
  });
});

describe("accessibility", () => {
  it("rejects a bush track when a household member needs step-free access", () => {
    const ctx = context({
      members: [adult(), adult({ mobility_notes: "uses a wheelchair" })],
    });
    expect(ruleFor(candidate({ categories: ["bushwalks"], walkKm: 2 }), ctx)).toBe(
      "accessibility_mismatch"
    );
  });
});

describe("budget", () => {
  it("rejects a candidate whose minimum cost is already over budget", () => {
    const ctx = context({ preferences: { budget_band: "UNDER_75" } });
    const expensive = candidate({
      publicSpace: false,
      cost: { min: 60, max: 90, certain: true },
    });
    // Two adults at 60 each is 120, over the 75 ceiling.
    expect(ruleFor(expensive, ctx)).toBe("over_budget");
  });

  it("counts children over four as paying, and under four as not", () => {
    const withToddler = context({ members: [adult(), adult(), child(2)] });
    const withSchoolAge = context({ members: [adult(), adult(), child(8)] });
    expect(chargeableHeads(withToddler)).toBe(2);
    expect(chargeableHeads(withSchoolAge)).toBe(3);
  });

  it("rejects a paid attraction whose price we cannot establish", () => {
    const ctx = context({ preferences: { budget_band: "UNDER_75" } });
    const unknownPrice = candidate({
      categories: ["museums"],
      publicSpace: false,
      cost: null,
      priceLevel: null,
    });
    expect(ruleFor(unknownPrice, ctx)).toBe("unknown_price_material_to_budget");
  });
});

describe("weather", () => {
  it("rejects a long exposed walk in serious heat", () => {
    const ctx = context({ weather: { temperature_max: 38 } });
    expect(ruleFor(candidate({ categories: ["easy_walks"], walkKm: 8 }), ctx)).toBe(
      "heat_exposure"
    );
  });

  it("still allows swimming in serious heat", () => {
    const ctx = context({ weather: { temperature_max: 38 } });
    expect(ruleFor(candidate({ categories: ["swimming"], walkKm: 0.5 }), ctx)).toBeNull();
  });

  it("rejects exposed activities when storms are forecast", () => {
    const ctx = context({ weather: { weather_code: 95 } });
    expect(ruleFor(candidate({ categories: ["beaches"] }), ctx)).toBe("storm_exposure");
  });

  it("rejects an exposed walk in heavy rain", () => {
    const ctx = context({
      weather: { precipitation_amount: 12, precipitation_probability: 0.85, weather_code: 65 },
    });
    expect(ruleFor(candidate({ categories: ["beaches"] }), ctx)).toBe("heavy_rain_exposure");
  });

  it("leaves indoor options alone in bad weather", () => {
    const ctx = context({
      weather: { precipitation_amount: 12, precipitation_probability: 0.85, weather_code: 65 },
    });
    expect(ruleFor(candidate({ categories: ["galleries"], publicSpace: false }), ctx)).toBeNull();
  });
});

describe("behaviour and preference", () => {
  it("rejects an anchor in a category the household keeps turning down", () => {
    const ctx = context({
      preferences: { liked_categories: ["museums"] },
      categoryStats: [categoryStats({ category_id: "museums", rejected_count: 4 })],
    });
    expect(ruleFor(candidate({ categories: ["museums"], role: "ANCHOR" }), ctx)).toBe(
      "behaviourally_suppressed"
    );
  });

  it("honours the free-text 'absolutely not'", () => {
    const ctx = context({ preferences: { hard_no: "museums" } });
    expect(ruleFor(candidate({ categories: ["museums"] }), ctx)).toBe("explicit_hard_no");
  });

  it("ignores a hard_no that is too short to match safely", () => {
    const ctx = context({ preferences: { hard_no: "no" } });
    expect(ruleFor(candidate({ categories: ["museums"] }), ctx)).toBeNull();
  });

  it("rejects an activity far more intense than the household's level", () => {
    const ctx = context({ preferences: { activity_level: "GENTLE", nudge: "NONE" } });
    expect(ruleFor(candidate({ categories: ["bushwalks"], walkKm: 1 }), ctx)).toBe(
      "activity_too_intense"
    );
  });

  it("allows one step up when they asked to be nudged", () => {
    const ctx = context({
      preferences: {
        activity_level: "EASY",
        desired_activity_level: "MODERATE",
        nudge: "LITTLE",
      },
    });
    expect(ruleFor(candidate({ categories: ["bushwalks"], walkKm: 4 }), ctx)).toBeNull();
  });
});

describe("bookings", () => {
  it("rejects something that needs booking with no way to book it", () => {
    const ctx = context();
    const unbookable = candidate({
      publicSpace: false,
      bookingRequired: true,
      website: null,
    });
    expect(ruleFor(unbookable, ctx)).toBe("booking_required_no_mechanism");
  });

  it("allows it when there is a booking link", () => {
    const ctx = context();
    const bookable = candidate({
      publicSpace: false,
      bookingRequired: true,
      website: "https://example.test/book",
    });
    expect(ruleFor(bookable, ctx)).toBeNull();
  });
});
