/**
 * Deterministic AIProvider used in development, CI and the eval suite.
 *
 * It is rule-based rather than random, and that is the point: the eval suite
 * (§46) asserts properties of the *engine* — child suitability, weather logic,
 * budget fit, learned rejection of museums — and those assertions must not
 * flake because a model phrased something differently. When these tests pass
 * with the mock, the deterministic half of the system is correct; the model's
 * contribution is judgement on top of an already-sound shortlist.
 *
 * It implements the same contract with the same schemas, so swapping in the
 * real provider changes quality, not behaviour.
 */

import type {
  AIProvider,
  BundleSummary,
  CandidateSummary,
  HouseholdContext,
  WeekendContext,
} from "./provider";
import type { PlanCopy, SearchIntent } from "./schemas";
import type { HouseholdMember, PlanFeedback } from "@/lib/types";
import { category } from "@/config/taxonomy";

export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "deterministic-rules-v1";

  async buildTasteSummary(input: {
    household: HouseholdContext;
    members: Array<Pick<HouseholdMember, "member_type" | "age">>;
    currency: string;
  }): Promise<string> {
    const p = input.household.preferences;
    const likes = p.liked_categories
      .slice(0, 3)
      .map((c) => category(c)?.label.toLowerCase() ?? c)
      .join(", ");
    const budget = BUDGET_PHRASE[p.budget_band] ?? "a flexible budget";
    const activity = ACTIVITY_PHRASE[p.activity_level] ?? "moderately active";

    return `${capitalise(likes)}. Usually ${budget}. Happy to travel about ${p.max_travel_minutes} minutes. ${activity}.`;
  }

  async generateSearchIntents(input: { household: HouseholdContext; weekend: WeekendContext }) {
    const { household, weekend } = input;
    const wet = (weekend.weather?.precipitation_probability ?? 0) > 0.5;
    const hot = (weekend.weather?.temperature_max ?? 20) > 32;

    // Anchor intents come from stated likes, filtered by what the weather
    // permits, then supplemented so we never hand the pipeline a single option.
    const liked = household.preferences.liked_categories
      .map((id) => category(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .filter((c) => c.can_anchor)
      .filter((c) => (wet ? c.weatherproof : true))
      .filter((c) => (hot ? c.exposure < 0.7 || c.id === "swimming" || c.id === "beaches" : true));

    const anchors = (liked.length > 0 ? liked : fallbackAnchors(wet)).slice(0, 4);

    const intents: SearchIntent[] = anchors.map((c, index) => ({
      query: c.search_hints[0] ?? c.label.toLowerCase(),
      categories: [c.id],
      role: "ANCHOR" as const,
      rationale: `Stated interest in ${c.label.toLowerCase()}`,
      priority: Math.max(1, 5 - index),
    }));

    // Food: cuisine-led when we know one, generic otherwise.
    const cuisine = household.preferences.food.cuisines_loved[0];
    intents.push({
      query: cuisine ? `${cuisine.toLowerCase()} restaurant` : "lunch",
      categories: ["food"],
      role: "FOOD" as const,
      rationale: cuisine ? `Loves ${cuisine}` : "Every plan needs somewhere to eat",
      priority: 5,
    });

    if (household.preferences.food.coffee_importance > 0.5) {
      intents.push({
        query: "specialty coffee",
        categories: ["coffee"],
        role: "ADDON" as const,
        rationale: "Coffee matters to this household",
        priority: 2,
      });
    }

    if (household.children_ages.some((age) => age <= 10)) {
      intents.push({
        query: "playground",
        categories: ["playgrounds"],
        role: "ADDON" as const,
        rationale: "Young children in the household",
        priority: 3,
      });
    }

    return intents;
  }

  async rankCandidates(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    candidates: CandidateSummary[];
  }) {
    // Defers entirely to the deterministic engine, which is honest about what
    // this mock is: it adds no judgement, so it should not pretend to.
    return input.candidates.map((c) => ({
      candidate_id: c.candidate_id,
      score: c.base_score,
      reason: "Deterministic score (mock provider adds no judgement)",
    }));
  }

  async selectPlan(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundles: BundleSummary[];
  }) {
    const sorted = [...input.bundles].sort((a, b) => b.base_score - a.base_score);
    const primary = sorted[0];
    if (!primary) throw new Error("selectPlan called with no bundles");

    // The backup must be genuinely easier, not merely different (§2). Prefer
    // the highest-scoring bundle that is lower effort than the primary in at
    // least one dimension; fall back to the least demanding available.
    const easier = sorted
      .slice(1)
      .filter(
        (b) =>
          effort(b) < effort(primary) ||
          b.total_travel_minutes < primary.total_travel_minutes * 0.75 ||
          b.total_cost_max < primary.total_cost_max * 0.7
      );
    const backup =
      easier[0] ?? sorted.slice(1).sort((a, b) => effort(a) - effort(b))[0] ?? primary;

    return {
      primary_bundle_id: primary.bundle_id,
      backup_bundle_id: backup.bundle_id,
      primary_reason: `Highest scoring plan for this household and forecast (${primary.base_score.toFixed(0)}/100).`,
      backup_reason:
        backup.bundle_id === primary.bundle_id
          ? "No easier alternative was available this week."
          : `Shorter and less demanding: ${backup.total_travel_minutes} minutes of travel and ${backup.walk_km.toFixed(1)} km on foot.`,
      confidence: Math.min(1, primary.base_score / 100),
    };
  }

  async critiquePlan(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundle: BundleSummary;
  }) {
    const problems: Array<{
      severity: "BLOCKER" | "CONCERN";
      item_sequence: number | null;
      description: string;
    }> = [];

    // These duplicate checks the deterministic filters already make. That is
    // deliberate: the critic is a second pair of eyes, and in production it is
    // a model that may catch something the rules did not encode.
    if (input.bundle.items.length > 6) {
      problems.push({
        severity: "CONCERN",
        item_sequence: null,
        description: "The day has a lot of components; it may not feel relaxed.",
      });
    }
    if (input.bundle.total_travel_minutes > input.household.preferences.max_travel_minutes * 2.5) {
      problems.push({
        severity: "BLOCKER",
        item_sequence: null,
        description: "Total travel exceeds what this household tolerates.",
      });
    }

    return {
      approve: !problems.some((p) => p.severity === "BLOCKER"),
      problems,
      quality: Math.min(1, input.bundle.base_score / 100),
    };
  }

  async writePlanCopy(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundle: BundleSummary;
    fit_evidence: string[];
  }): Promise<PlanCopy> {
    const named = input.bundle.items.filter(
      (i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK"
    );
    const title = named
      .slice(0, 3)
      .map((i) => i.name)
      .join(" + ");

    return {
      title: title.slice(0, 80) || "Your Saturday",
      short_description: `${named.length} stops, ${input.bundle.total_travel_minutes} minutes of travel.`,
      fit_reason:
        input.fit_evidence.length > 0
          ? `Based on what you've told us and done: ${input.fit_evidence.slice(0, 3).join("; ")}.`
          : "Built from the preferences you gave us when you signed up.",
      items: input.bundle.items.map((i) => ({
        sequence: i.sequence,
        title: i.name,
        description: null,
      })),
    };
  }

  async summariseFeedback(input: {
    household: HouseholdContext;
    feedback: Pick<PlanFeedback, "did_it" | "rating" | "not_done_reason" | "note">;
    plan_summary: string;
  }) {
    // Only the unambiguous structured signals; the mock does not read prose.
    const signals: Array<{ dimension: string; value: string; delta: number; evidence: string }> = [];
    if (input.feedback.not_done_reason === "TOO_FAR") {
      signals.push({
        dimension: "travel_max_minutes",
        value: "reduce",
        delta: -0.3,
        evidence: "Reported the plan was too far",
      });
    }
    if (input.feedback.not_done_reason === "TOO_EXPENSIVE") {
      signals.push({
        dimension: "spend_activity",
        value: "reduce",
        delta: -0.3,
        evidence: "Reported the plan was too expensive",
      });
    }
    return signals;
  }

  async updateTasteModel() {
    // Consolidation is the deterministic updater's job (src/lib/taste/updater.ts).
    return [];
  }

  async tasteInsight(input: { household: HouseholdContext }): Promise<string | null> {
    const strongest = [...input.household.taste_signals]
      .filter((s) => s.dimension === "category" && s.confidence > 0.5)
      .sort((a, b) => b.weight - a.weight)[0];
    if (!strongest || strongest.weight < 0.4) return null;
    const label = category(strongest.value)?.label.toLowerCase() ?? strongest.value;
    return `Your best weekends have involved ${label}.`;
  }
}

const BUDGET_PHRASE: Record<string, string> = {
  FREE: "keeping it free",
  UNDER_75: "under 75",
  "75_150": "between 75 and 150",
  "150_250": "between 150 and 250",
  FLEXIBLE: "flexible about spending",
};

const ACTIVITY_PHRASE: Record<string, string> = {
  GENTLE: "Gentle rather than strenuous",
  EASY: "Happy walking a few kilometres",
  MODERATE: "Moderately active",
  ACTIVE: "Genuinely active",
};

const EFFORT_RANK: Record<string, number> = { GENTLE: 0, EASY: 1, MODERATE: 2, ACTIVE: 3 };

function effort(bundle: BundleSummary): number {
  return (EFFORT_RANK[bundle.activity_level] ?? 1) * 10 + bundle.walk_km;
}

function fallbackAnchors(wet: boolean) {
  const ids = wet ? ["galleries", "museums", "markets"] : ["easy_walks", "waterfront", "gardens"];
  return ids.map((id) => category(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
