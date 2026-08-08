/**
 * Evaluation harness (§46).
 *
 * Runs the ENTIRE pipeline — intents, retrieval, filters, scoring, assembly,
 * selection, verification, copy — against synthetic profiles and the Sydney
 * fixtures, with no network and no paid provider calls (§48).
 *
 * These are the tests that answer the question the founder actually cares
 * about: not "does the code run?" but "would a person recognise this as a good
 * weekend for them?". They assert properties of the output rather than exact
 * plans, because the right answer is a class of plans, not one plan.
 */

import { getMarket } from "@/config/markets";
import { MockAIProvider } from "@/lib/ai/mock";
import { UsageLedger, type ProviderBundle } from "@/lib/providers";
import { MockPlaceProvider } from "@/lib/providers/places/mock";
import { MockRouteProvider } from "@/lib/providers/routes/mock";
import { MockWeatherProvider, type ScriptedForecast } from "@/lib/providers/weather/mock";
import { buildPlanningContext } from "@/lib/planner/context";
import { generateWeekend, type GenerationResult } from "@/lib/planner/generation";
import type { Bundle } from "@/lib/planner/types";
import { context, type ContextOverrides, TEST_WEEKEND } from "../helpers/factories";

export interface EvalOptions extends ContextOverrides {
  forecast?: ScriptedForecast;
}

export interface EvalOutcome {
  result: GenerationResult;
  primary: Bundle | null;
  backup: Bundle | null;
  /** Names of everything in the primary plan, for readable assertions. */
  stops: string[];
  categories: string[];
  providers: ProviderBundle;
}

/**
 * Run one synthetic household through the full pipeline.
 *
 * Note what is NOT mocked: the filters, the scorer, the assembler and the
 * verifier are the real implementations. Only the outside world is a fixture.
 */
export async function runEval(options: EvalOptions = {}): Promise<EvalOutcome> {
  const weather = new MockWeatherProvider(options.forecast);
  const market = getMarket("sydney");
  const weekendDate = options.weekendDate ?? TEST_WEEKEND;

  const forecast = await weather.getForecast({
    lat: -33.911,
    lng: 151.155,
    date: weekendDate,
    timezone: market.timezone,
  });

  // Build the context from the same factories the unit tests use, but with the
  // scripted forecast rather than a hand-written one.
  const base = context({ ...options, weekendDate });
  const ctx = buildPlanningContext({
    household: base.household,
    members: base.members,
    preferences: base.preferences,
    taste: base.taste,
    categoryStats: base.categoryStats,
    checkin: base.checkin,
    market,
    weekendDate,
    weather: forecast,
  });

  const providers: ProviderBundle = {
    places: new MockPlaceProvider(),
    routes: new MockRouteProvider(),
    weather,
    ledger: new UsageLedger(),
  };

  const result = await generateWeekend(ctx, new MockAIProvider(), providers);

  const primary = result.primary;
  const stops =
    primary?.items.filter((i) => i.candidate).map((i) => i.candidate!.name) ?? [];
  const categories = [
    ...new Set(primary?.items.flatMap((i) => i.candidate?.categories ?? []) ?? []),
  ];

  return { result, primary, backup: result.backup, stops, categories, providers };
}

/** Total walking distance in the plan. */
export function walkKm(bundle: Bundle): number {
  return bundle.walk_km;
}

/** Whole-household cost at the top of the estimate. */
export function maxCost(bundle: Bundle): number {
  return bundle.total_cost_max;
}

/** Does the plan contain anything from this category? */
export function includesCategory(bundle: Bundle, categoryId: string): boolean {
  return bundle.items.some((i) => i.candidate?.categories.includes(categoryId));
}

/** Which rules rejected candidates, for asserting that a filter actually fired. */
export function rejectionRules(result: GenerationResult): string[] {
  return result.diagnostics.candidatesRejected.map((r) => r.rule);
}

/** Every place the pipeline considered but did not use. */
export function rejectedNames(result: GenerationResult, rule?: string): string[] {
  return result.diagnostics.candidatesRejected
    .filter((r) => (rule ? r.rule === rule : true))
    .map((r) => r.name);
}
