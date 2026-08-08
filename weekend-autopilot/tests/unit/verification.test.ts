import { describe, expect, it } from "vitest";
import { isOpenDuring, verifyBundle } from "@/lib/planner/verification";
import { VERIFICATION_CONFIG } from "@/config/planner";
import { assembleBundles } from "@/lib/planner/bundle-builder";
import { scoreCandidate } from "@/lib/planner/scoring";
import { MockPlaceProvider } from "@/lib/providers/places/mock";
import { MockRouteProvider } from "@/lib/providers/routes/mock";
import { context, TEST_WEEKEND } from "../helpers/factories";
import { candidate, openAllWeekend, UNKNOWN_HOURS } from "../helpers/candidates";
import type { Bundle } from "@/lib/planner/types";

describe("isOpenDuring", () => {
  const saturday = TEST_WEEKEND;

  it("accepts a visit comfortably inside the opening period", () => {
    expect(isOpenDuring(openAllWeekend("09:00", "17:00"), saturday, "11:00", "12:30")).toBe("OPEN");
  });

  it("rejects a visit before opening", () => {
    expect(isOpenDuring(openAllWeekend("12:00", "20:00"), saturday, "10:00", "11:00")).toBe(
      "CLOSED"
    );
  });

  it("rejects a visit that runs into closing time", () => {
    // A 90-minute visit finishing exactly at close is not "open" in any sense
    // that helps a customer standing at the door.
    expect(isOpenDuring(openAllWeekend("09:00", "17:00"), saturday, "15:30", "17:00")).toBe(
      "CLOSED"
    );
  });

  it("keeps a configurable buffer clear of closing", () => {
    const buffer = VERIFICATION_CONFIG.opening_hours_buffer_minutes;
    expect(buffer).toBeGreaterThan(0);
    // Finishing exactly one buffer before close is fine.
    expect(isOpenDuring(openAllWeekend("09:00", "17:00"), saturday, "14:00", "16:30")).toBe("OPEN");
  });

  it("reports unknown hours as UNKNOWN, never as CLOSED", () => {
    expect(isOpenDuring(UNKNOWN_HOURS, saturday, "11:00", "12:00")).toBe("UNKNOWN");
  });

  it("reports a permanently closed venue as CLOSED", () => {
    expect(
      isOpenDuring(
        { periods: {}, permanently_closed: true, unknown: false },
        saturday,
        "11:00",
        "12:00"
      )
    ).toBe("CLOSED");
  });

  it("rejects a day with no periods at all", () => {
    const weekdaysOnly = {
      periods: { 1: [{ open: "09:00", close: "17:00" }] },
      permanently_closed: false,
      unknown: false,
    };
    expect(isOpenDuring(weekdaysOnly, saturday, "11:00", "12:00")).toBe("CLOSED");
  });
});

// ------------------------------------------------------------ whole bundles

/** Build one real bundle from candidates so verification has something to chew. */
function bundleFrom(candidates: ReturnType<typeof candidate>[]): Bundle {
  const ctx = context();
  for (const c of candidates) c.score = scoreCandidate(c, ctx);
  const bundles = assembleBundles(candidates, ctx, { limit: 1 });
  const bundle = bundles[0];
  if (!bundle) throw new Error("test setup: no bundle assembled");
  return bundle;
}

describe("verifyBundle", () => {
  const places = new MockPlaceProvider();
  const routes = new MockRouteProvider();

  it("passes a plan whose venues are all real and open", async () => {
    // Real fixture IDs, so the mock provider can re-fetch them.
    const anchor = candidate({
      name: "Coogee Beach",
      categories: ["beaches"],
      publicSpace: true,
      lat: -33.9205,
      lng: 151.2578,
    });
    anchor.provider_place_id = "syd_coogee_beach";

    const food = candidate({
      name: "Coogee Pavilion",
      categories: ["food"],
      role: "FOOD",
      publicSpace: false,
      lat: -33.9195,
      lng: 151.2585,
      cost: { min: 28, max: 60, certain: false },
    });
    food.provider_place_id = "syd_coogee_pavilion";

    const bundle = bundleFrom([anchor, food]);
    const result = await verifyBundle(bundle, context(), places, routes);

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(VERIFICATION_CONFIG.min_verification_score);
  });

  it("fails a plan whose anchor is permanently closed", async () => {
    const anchor = candidate({
      name: "The Former Corner Cafe",
      categories: ["coffee"],
      publicSpace: false,
      lat: -33.8905,
      lng: 151.1799,
    });
    anchor.provider_place_id = "syd_closed_cafe";

    const bundle = bundleFrom([anchor]);
    const result = await verifyBundle(bundle, context(), places, routes);

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toMatch(/closed/i);
  });

  it("marks a venue with unknown hours uncertain rather than failed", async () => {
    const anchor = candidate({
      name: "Little Harbour Kiosk",
      categories: ["coffee"],
      publicSpace: false,
      lat: -33.8452,
      lng: 151.2515,
    });
    anchor.provider_place_id = "syd_unknown_hours_venue";

    const bundle = bundleFrom([anchor]);
    const result = await verifyBundle(bundle, context(), places, routes);

    const item = result.items.find((i) => i.sequence >= 0);
    expect(item?.status).toBe("UNCERTAIN");
    // Uncertainty costs score without automatically blocking delivery.
    expect(result.score).toBeLessThan(1);
  });

  it("fails a venue the provider has never heard of", async () => {
    const anchor = candidate({ publicSpace: false });
    anchor.provider_place_id = "does_not_exist";

    const bundle = bundleFrom([anchor]);
    const result = await verifyBundle(bundle, context(), places, routes);

    expect(result.passed).toBe(false);
  });

  it("weights the anchor above an incidental stop", async () => {
    // A plan whose anchor verifies and whose secondary stop is uncertain
    // should still be deliverable.
    // Coordinates must match the fixtures: the verifier fails an item whose
    // re-fetched position disagrees with the one the plan was built on, which
    // is exactly what it should do.
    const anchor = candidate({
      name: "Balmoral Beach",
      categories: ["beaches"],
      publicSpace: true,
      lat: -33.8266,
      lng: 151.2513,
      // The mock router puts Marrickville→Balmoral at ~32 minutes; the plan
      // was built with a comparable figure, so the re-check agrees.
      travelMinutes: 35,
    });
    anchor.provider_place_id = "syd_balmoral_beach";

    const kiosk = candidate({
      name: "Little Harbour Kiosk",
      categories: ["coffee"],
      role: "FOOD",
      publicSpace: false,
      lat: -33.8452,
      lng: 151.2515,
    });
    kiosk.provider_place_id = "syd_unknown_hours_venue";

    const bundle = bundleFrom([anchor, kiosk]);
    const result = await verifyBundle(bundle, context(), places, routes);

    expect(result.passed).toBe(true);
  });
});
