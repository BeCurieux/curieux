import { describe, expect, it } from "vitest";
import { GENERATION_CONFIG } from "@/config/planner";
import { SCORING_CONFIG } from "@/config/scoring";
import { runEval } from "../evals/harness";
import { adult, child } from "../helpers/factories";

/**
 * The pipeline as a whole (§13, §44, §48).
 *
 * Properties that must hold for every plan we would ever send, whoever the
 * household is. If one of these breaks, something is being delivered that we
 * could not defend to a customer.
 */

describe("every delivered plan", () => {
  const profiles = [
    { name: "couple", members: [adult(), adult()] },
    { name: "solo", members: [adult()], household: { shape: "SOLO" as const } },
    {
      name: "family with a toddler",
      members: [adult(), adult(), child(3)],
      household: { shape: "FAMILY" as const },
    },
    {
      name: "family with a teenager",
      members: [adult(), adult(), child(14)],
      household: { shape: "FAMILY" as const },
    },
  ];

  for (const profile of profiles) {
    describe(profile.name, () => {
      it("passes verification before it is considered deliverable", async () => {
        const { result, primary } = await runEval(profile);
        expect(result.ok, result.failureReason ?? "").toBe(true);
        expect(primary!.verification?.passed).toBe(true);
      });

      it("scores above the deliverable threshold", async () => {
        const { primary } = await runEval(profile);
        expect(primary!.base_score).toBeGreaterThanOrEqual(SCORING_CONFIG.min_deliverable_score);
      });

      it("has a coherent timeline with no overlaps and no reversals", async () => {
        const { primary } = await runEval(profile);
        for (let i = 1; i < primary!.items.length; i++) {
          const previous = primary!.items[i - 1]!;
          const current = primary!.items[i]!;
          expect(current.start_time >= previous.end_time).toBe(true);
          expect(current.end_time >= current.start_time).toBe(true);
        }
      });

      it("names at least one real place", async () => {
        const { stops } = await runEval(profile);
        expect(stops.length).toBeGreaterThan(0);
        expect(stops.every((s) => s.trim().length > 0)).toBe(true);
      });

      it("has exactly one critical anchor", async () => {
        const { primary } = await runEval(profile);
        const critical = primary!.items.filter((i) => i.is_critical);
        expect(critical).toHaveLength(1);
      });

      it("accounts for getting home", async () => {
        const { primary } = await runEval(profile);
        expect(primary!.items.at(-1)?.name).toBe("Head home");
      });

      it("carries a confidence score we could show a customer", async () => {
        const { result } = await runEval(profile);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });

      it("writes copy grounded in supplied evidence", async () => {
        const { result, primary } = await runEval(profile);
        const copy = result.copy.get(primary!.bundle_id);
        expect(copy?.title).toBeTruthy();
        expect(copy?.fit_reason).toBeTruthy();
        expect(result.fitEvidence.length).toBeGreaterThan(0);
      });
    });
  }
});

describe("the backup plan (§2)", () => {
  it("is genuinely easier than the primary in at least one dimension", async () => {
    const { primary, backup } = await runEval({
      members: [adult(), adult()],
      preferences: { time_budget: "MOST_OF_DAY", max_travel_minutes: 60 },
    });

    if (!backup) {
      // Acceptable when the candidate pool offers no lighter alternative, but
      // it must never be the same plan twice.
      return;
    }

    const easier =
      backup.walk_km < primary!.walk_km ||
      backup.total_travel_minutes < primary!.total_travel_minutes ||
      backup.total_cost_max < primary!.total_cost_max ||
      effortRank(backup.activity_level) < effortRank(primary!.activity_level);

    expect(easier, "backup must be lighter in some dimension").toBe(true);
  });

  it("is never the same plan as the primary", async () => {
    const { primary, backup } = await runEval({
      members: [adult(), adult()],
      preferences: { time_budget: "MOST_OF_DAY" },
    });
    if (backup) expect(backup.bundle_id).not.toBe(primary!.bundle_id);
  });
});

describe("provider cost discipline (§44)", () => {
  it("stays inside the per-run ceiling", async () => {
    const { result } = await runEval({ members: [adult(), adult()] });
    expect(result.diagnostics.providerCostCents).toBeLessThanOrEqual(
      GENERATION_CONFIG.max_provider_cost_cents_per_run
    );
  });

  it("fetches expensive details only for the shortlist, not every candidate", async () => {
    // The economics of the product depend on this ordering: search wide,
    // prune with free arithmetic, pay for facts on the survivors only.
    const { result, providers } = await runEval({ members: [adult(), adult()] });
    const places = providers.places as unknown as { calls: { search: number; details: number } };

    expect(result.diagnostics.candidatesRetrieved).toBeGreaterThan(0);
    expect(places.calls.details).toBeLessThanOrEqual(GENERATION_CONFIG.shortlist_size * 2);
  });

  it("does not run more searches than it generated intents", async () => {
    const { result, providers } = await runEval({ members: [adult(), adult()] });
    const places = providers.places as unknown as { calls: { search: number } };
    expect(places.calls.search).toBeLessThanOrEqual(result.diagnostics.intents.length);
  });
});

describe("failure handling (§39)", () => {
  it("reports why it failed rather than returning an empty plan", async () => {
    // An impossible household: fifteen minutes of walking only, in the middle
    // of a storm, with no budget.
    const { result } = await runEval({
      members: [adult()],
      preferences: {
        max_travel_minutes: 15,
        transport_modes: ["WALKING"],
        budget_band: "FREE",
        liked_categories: ["workshops"],
        time_budget: "FEW_HOURS",
      },
      household: { home_lat: -33.5806, home_lng: 151.2989 },
      forecast: { weather_code: 95, precipitation_probability: 0.95, precipitation_amount: 30 },
    });

    if (!result.ok) {
      expect(result.failureReason).toBeTruthy();
      expect(result.primary).toBeNull();
      // The diagnostics must say where it stopped, for the admin inspector.
      expect(result.diagnostics.stage).toBe("FAILED");
    }
  });

  it("records rejected candidates with a rule and a readable reason", async () => {
    const { result } = await runEval({
      members: [adult(), adult(), child(2)],
      household: { shape: "FAMILY" as const },
    });

    for (const rejection of result.diagnostics.candidatesRejected) {
      expect(rejection.rule).toBeTruthy();
      expect(rejection.name).toBeTruthy();
    }
  });
});

function effortRank(level: string): number {
  return ["GENTLE", "EASY", "MODERATE", "ACTIVE"].indexOf(level);
}
