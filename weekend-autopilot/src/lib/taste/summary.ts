/**
 * Rendering the taste model for humans and for prompts (§19, §34).
 *
 * Two audiences:
 *  - the model, which needs the strongest signals compactly
 *  - the customer, who needs the "why this fits you" line to be true
 *
 * The second is the one that matters commercially. A fit reason grounded in
 * something the household actually did is the difference between "this app
 * knows me" and "this is generic". So the evidence is assembled here, from
 * real signals and real history, and the model is told to ground its sentence
 * in it rather than inventing a pattern.
 */

import { category } from "@/config/taxonomy";
import { formatDistance } from "@/config/markets";
import type { CategoryStats, TasteSignal } from "@/lib/types";
import type { Bundle, PlanningContext } from "@/lib/planner/types";

/** Strongest signals, compacted for the prompt. */
export function tasteSignalsForPrompt(
  signals: TasteSignal[]
): Array<Pick<TasteSignal, "dimension" | "value" | "weight" | "confidence">> {
  return [...signals]
    .filter((s) => s.confidence >= 0.2)
    .sort((a, b) => Math.abs(b.weight) * b.confidence - Math.abs(a.weight) * a.confidence)
    .slice(0, 24)
    .map(({ dimension, value, weight, confidence }) => ({
      dimension,
      value,
      weight,
      confidence,
    }));
}

/**
 * Evidence for the "why this fits you" line.
 *
 * Only facts go in here: categories they have completed and loved, distances
 * they have accepted, constraints they set. If there is nothing to say we
 * return the stated preferences and let the copy be modest — a fabricated
 * pattern in this sentence is worse than a bland one, because it is the
 * sentence that tells the customer whether we are paying attention.
 */
export function buildFitEvidence(ctx: PlanningContext, bundle: Bundle): string[] {
  const evidence: string[] = [];

  // What they have actually done.
  const completed = ctx.categoryStats
    .filter((s) => s.completed_count > 0)
    .sort((a, b) => b.completed_count - a.completed_count)
    .slice(0, 3);

  for (const stat of completed) {
    const label = category(stat.category_id)?.label.toLowerCase() ?? stat.category_id;
    const loved = stat.loved_count > 0 ? " and rated them highly" : "";
    evidence.push(
      `Has done ${stat.completed_count} ${label} plan${stat.completed_count === 1 ? "" : "s"}${loved}`
    );
  }

  // Strong learned signals relevant to this specific plan.
  const bundleCategories = new Set(bundle.items.flatMap((i) => i.candidate?.categories ?? []));
  for (const signal of ctx.taste) {
    if (signal.dimension !== "category") continue;
    if (!bundleCategories.has(signal.value)) continue;
    if (signal.confidence < 0.4 || Math.abs(signal.weight) < 0.4) continue;
    const label = category(signal.value)?.label.toLowerCase() ?? signal.value;
    evidence.push(
      signal.weight > 0
        ? `Consistently positive about ${label}`
        : `Has been lukewarm about ${label}`
    );
  }

  // Constraints they set, which the plan respects.
  evidence.push(
    `Travel kept to ${bundle.total_travel_minutes} minutes against a stated limit of ${ctx.derived.effectiveTravelMinutes}`
  );

  if (bundle.walk_km > 0) {
    evidence.push(
      `Walking is ${formatDistance(ctx.market, bundle.walk_km)}, in the range they have accepted before`
    );
  }

  if (ctx.derived.hasChildren) {
    evidence.push(`Suitable for a child aged ${ctx.derived.youngestChildAge}`);
  }

  if (ctx.checkin?.energy === "LOW") {
    evidence.push("They told us this week they are low on energy");
  }
  if (ctx.checkin?.note) {
    evidence.push(`They mentioned: ${ctx.checkin.note}`);
  }

  // Fall back to stated preferences when there is no behavioural history yet.
  if (completed.length === 0) {
    const stated = ctx.preferences.liked_categories
      .slice(0, 3)
      .map((id) => category(id)?.label.toLowerCase() ?? id);
    if (stated.length > 0) {
      evidence.unshift(`Said at signup they like ${stated.join(", ")} (no history yet)`);
    }
  }

  return evidence;
}

/**
 * The dashboard insight line (§34), computed deterministically as a fallback
 * when the model declines to offer one. Returns null rather than reaching for
 * something weak: "we noticed nothing yet" is an honest state.
 */
export function deterministicInsight(categoryStats: CategoryStats[]): string | null {
  const strong = categoryStats
    .filter((s) => s.completed_count >= 2)
    .sort((a, b) => b.loved_count - a.loved_count || b.completed_count - a.completed_count)[0];

  if (!strong) return null;
  const label = category(strong.category_id)?.label.toLowerCase();
  if (!label) return null;

  if (strong.loved_count >= 2) return `Your best weekends have involved ${label}.`;
  if (strong.completed_count >= 3) return `You keep coming back to ${label}.`;
  return null;
}
