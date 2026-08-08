/**
 * Stage 2 — search intents (§14).
 *
 * We never ask the model to name businesses from memory. We ask it what KIND
 * of thing to look for, and then we go and look. This stage produces the
 * queries; the next one runs them against the provider.
 *
 * The model's intents are then passed through deterministic guards, because a
 * plausible-sounding intent can still be unsafe or pointless: a category the
 * household has demonstrably rejected, an exposed walk on a 38° day, or a
 * banned activity class. Guarding here is much cheaper than filtering the
 * candidates it would have returned.
 */

import { SAFETY_CONFIG, WEATHER_RULES } from "@/config/planner";
import { GENERATION_CONFIG } from "@/config/planner";
import { anchorCategories, category, type CategoryId } from "@/config/taxonomy";
import type { AIProvider } from "@/lib/ai/provider";
import type { SearchIntent } from "@/lib/ai/schemas";
import type { HouseholdContext, WeekendContext } from "@/lib/ai/provider";
import type { PlanningContext } from "./types";
import { weatherBucket } from "@/lib/providers/weather/provider";

export async function generateSearchIntents(
  ctx: PlanningContext,
  ai: AIProvider,
  household: HouseholdContext,
  weekend: WeekendContext
): Promise<SearchIntent[]> {
  let intents: SearchIntent[];
  try {
    intents = await ai.generateSearchIntents({ household, weekend });
  } catch {
    // A model failure must not fail the weekend. The deterministic fallback is
    // less imaginative but produces a perfectly serviceable plan (§39).
    intents = [];
  }

  const guarded = intents.filter((intent) => isPermitted(intent, ctx));
  const complete = ensureCoverage(guarded, ctx);

  return complete
    .sort((a, b) => b.priority - a.priority)
    .slice(0, GENERATION_CONFIG.max_search_intents);
}

/**
 * Deterministic intents, used when the model is unavailable and merged in
 * whenever its output leaves a gap. Every plan needs an anchor and food; if
 * the model returned neither we supply them rather than proceeding with a
 * shortlist that cannot assemble into a day.
 */
export function fallbackIntents(ctx: PlanningContext): SearchIntent[] {
  const permitted = permittedAnchorCategories(ctx);
  const liked = ctx.preferences.liked_categories.filter((id) =>
    permitted.some((c) => c.id === id)
  );

  const chosen = (liked.length > 0 ? liked : permitted.map((c) => c.id)).slice(0, 4);

  const intents: SearchIntent[] = chosen.map((id, index) => {
    const c = category(id);
    return {
      query: c?.search_hints[0] ?? c?.label.toLowerCase() ?? id,
      categories: [id],
      role: "ANCHOR",
      rationale: `Fallback intent from stated interest in ${c?.label ?? id}`,
      priority: Math.max(1, 5 - index),
    };
  });

  const cuisine = ctx.preferences.food.cuisines_loved[0];
  intents.push({
    query: cuisine ? `${cuisine.toLowerCase()} restaurant` : "casual lunch",
    categories: ["food"],
    role: "FOOD",
    rationale: "Every plan needs somewhere to eat",
    priority: 5,
  });

  return intents;
}

// ------------------------------------------------------------ guards

function isPermitted(intent: SearchIntent, ctx: PlanningContext): boolean {
  const categories = intent.categories.filter((id): id is CategoryId => Boolean(category(id)));
  // An intent naming only categories we do not recognise cannot be scored or
  // filtered downstream, so it is dropped rather than passed through blind.
  if (categories.length === 0) return false;

  // Behavioural suppression (§18) applies before we spend a provider call.
  if (categories.every((id) => ctx.derived.suppressedCategories.has(id))) return false;

  // Safety envelope (§21).
  if (categories.some((id) => SAFETY_CONFIG.banned_categories.includes(id))) return false;
  if (
    ctx.derived.hasChildren &&
    categories.some((id) => SAFETY_CONFIG.banned_categories_with_children.includes(id))
  ) {
    return false;
  }

  // Weather-driven exclusion at the intent level (§21). Cheaper and more
  // decisive than letting the scorer penalise a shortlist full of bad ideas.
  const weather = ctx.weather;
  if (weather) {
    const bucket = weatherBucket(weather.weather_code);
    const wet =
      weather.precipitation_probability >= WEATHER_RULES.wet_precipitation_probability ||
      weather.precipitation_amount >= WEATHER_RULES.wet_precipitation_mm;

    if ((wet || bucket === "storm" || bucket === "severe") && intent.role === "ANCHOR") {
      const anyWeatherproof = categories.some((id) => category(id)?.weatherproof);
      if (!anyWeatherproof) return false;
    }

    if (weather.temperature_max >= WEATHER_RULES.very_hot_temp_c) {
      const allExposed = categories.every((id) => (category(id)?.exposure ?? 0) > 0.7);
      // Swimming is the exception: exposed, and exactly what you want at 38°.
      const isWater = categories.some((id) => id === "swimming" || id === "beaches");
      if (allExposed && !isWater) return false;
    }

    if (weather.wind_speed >= WEATHER_RULES.windy_kmh) {
      const exposedCoastal = categories.every(
        (id) => (category(id)?.exposure ?? 0) >= 0.8 && category(id)?.group === "outdoors"
      );
      if (exposedCoastal) return false;
    }
  }

  // Child age suitability at the intent level: no point searching for wine
  // tastings for a household with a three-year-old.
  const youngest = ctx.derived.youngestChildAge;
  if (youngest !== null) {
    const allTooOld = categories.every((id) => (category(id)?.min_child_age ?? 0) > youngest);
    if (allTooOld) return false;
  }

  return true;
}

function permittedAnchorCategories(ctx: PlanningContext) {
  return anchorCategories().filter((c) =>
    isPermitted(
      {
        query: c.label,
        categories: [c.id],
        role: "ANCHOR",
        rationale: "",
        priority: 1,
      },
      ctx
    )
  );
}

/** Guarantee at least one anchor intent and one food intent survive. */
function ensureCoverage(intents: SearchIntent[], ctx: PlanningContext): SearchIntent[] {
  const result = [...intents];
  const fallback = fallbackIntents(ctx);

  if (!result.some((i) => i.role === "ANCHOR")) {
    result.push(...fallback.filter((i) => i.role === "ANCHOR").slice(0, 3));
  }
  if (!result.some((i) => i.role === "FOOD")) {
    result.push(...fallback.filter((i) => i.role === "FOOD"));
  }

  // A single anchor intent means a single point of failure at verification;
  // top up so the assembler has alternatives when the first choice is closed.
  const anchors = result.filter((i) => i.role === "ANCHOR");
  if (anchors.length < 2) {
    const extra = fallback
      .filter((i) => i.role === "ANCHOR")
      .filter((i) => !result.some((r) => r.query === i.query));
    result.push(...extra.slice(0, 2));
  }

  return dedupe(result);
}

function dedupe(intents: SearchIntent[]): SearchIntent[] {
  const seen = new Set<string>();
  return intents.filter((intent) => {
    const key = `${intent.role}:${intent.query.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
