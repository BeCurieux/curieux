/**
 * The generation pipeline (§13).
 *
 *   PROFILE → LIVE CONTEXT → SEARCH INTENTS → API CANDIDATES → HARD FILTERS
 *   → SCORING → PLAN ASSEMBLY → AI SELECTION → FACTUAL VERIFICATION
 *   → AI COPY → FINAL VALIDATION → DELIVERY
 *
 * Two rules govern the whole thing:
 *
 *   AI decides. APIs provide facts.
 *   If verification fails, we do not deliver the plan — we retry with the
 *   next-ranked candidates, and if we still cannot build something we would
 *   genuinely recommend, we say so rather than sending filler (§39).
 *
 * This module is pure with respect to storage: it takes a context and
 * providers, and returns a result. Persistence is the job's concern, which
 * keeps the engine testable end-to-end without a database (§46).
 */

import { GENERATION_CONFIG, VERIFICATION_CONFIG } from "@/config/planner";
import { SCORING_CONFIG } from "@/config/scoring";
import type { AIProvider, BundleSummary, HouseholdContext, WeekendContext } from "@/lib/ai/provider";
import type { ProviderBundle } from "@/lib/providers";
import type { ActivityLevel, GenerationStage } from "@/lib/types";
import { sanitiseUserText } from "@/lib/security/sanitise";
import { buildFitEvidence, tasteSignalsForPrompt } from "@/lib/taste/summary";
import { assembleBundles } from "./bundle-builder";
import { enrichShortlist, retrieveCandidates } from "./candidate-builder";
import { applyHardFilters } from "./filters";
import { generateSearchIntents } from "./search-intents";
import { scoreBundle, scoreCandidate } from "./scoring";
import { verifyBundle } from "./verification";
import type { Bundle, Candidate, PlanningContext } from "./types";

export interface GenerationResult {
  ok: boolean;
  primary: Bundle | null;
  backup: Bundle | null;
  /** Model-written copy for each, keyed by bundle id. */
  copy: Map<string, import("@/lib/ai/schemas").PlanCopy>;
  fitEvidence: string[];
  confidence: number;
  /** Why we could not build one, when ok is false. */
  failureReason: string | null;
  diagnostics: GenerationDiagnostics;
}

export interface GenerationDiagnostics {
  stage: GenerationStage;
  attempt: number;
  intents: Array<{ query: string; role: string }>;
  candidatesRetrieved: number;
  candidatesRejected: Array<{ name: string; rule: string; detail: string }>;
  shortlist: Array<{ name: string; score: number }>;
  bundlesAssembled: Array<{ bundle_id: string; archetype: string; score: number }>;
  verification: Array<{ bundle_id: string; score: number; passed: boolean; failures: string[] }>;
  critique: Array<{ bundle_id: string; approve: boolean; problems: string[] }>;
  emptyIntents: string[];
  providerCostCents: number;
}

export type StageListener = (stage: GenerationStage) => void | Promise<void>;

export interface GenerateOptions {
  onStage?: StageListener;
  /** Anchors to avoid — set when regenerating after a failure or a swap. */
  excludeAnchorIds?: Set<string>;
  /** Bias toward an easier plan (§25 swap buttons). */
  preferEasier?: boolean;
}

export async function generateWeekend(
  ctx: PlanningContext,
  ai: AIProvider,
  providers: ProviderBundle,
  options: GenerateOptions = {}
): Promise<GenerationResult> {
  const diagnostics: GenerationDiagnostics = {
    stage: "CONTEXT",
    attempt: 1,
    intents: [],
    candidatesRetrieved: 0,
    candidatesRejected: [],
    shortlist: [],
    bundlesAssembled: [],
    verification: [],
    critique: [],
    emptyIntents: [],
    providerCostCents: 0,
  };

  const stage = async (next: GenerationStage) => {
    diagnostics.stage = next;
    await options.onStage?.(next);
  };

  const household = toHouseholdContext(ctx);
  const weekend = toWeekendContext(ctx);

  // ---------------------------------------------------------------- intents
  await stage("INTENTS");
  const intents = await generateSearchIntents(ctx, ai, household, weekend);
  diagnostics.intents = intents.map((i) => ({ query: i.query, role: i.role }));

  // ------------------------------------------------------------- candidates
  await stage("CANDIDATES");
  const retrieval = await retrieveCandidates(ctx, intents, providers.places, providers.routes);
  diagnostics.candidatesRetrieved = retrieval.candidates.length;
  diagnostics.emptyIntents = retrieval.emptyIntents;

  if (retrieval.candidates.length === 0) {
    return failure(diagnostics, "No candidates were returned for this household's area");
  }

  // ---------------------------------------------------------------- filters
  await stage("FILTERING");
  const filtered = applyHardFilters(retrieval.candidates, ctx);
  diagnostics.candidatesRejected = filtered.rejected.map((c) => ({
    name: c.name,
    rule: c.rejection?.rule ?? "unknown",
    detail: c.rejection?.detail ?? "",
  }));

  if (filtered.kept.length === 0) {
    return failure(diagnostics, "Every candidate was excluded by hard filters");
  }

  // ---------------------------------------------------------------- scoring
  await stage("SCORING");
  for (const candidate of filtered.kept) {
    candidate.score = scoreCandidate(candidate, ctx);
  }

  const shortlist = filtered.kept
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
    .slice(0, GENERATION_CONFIG.shortlist_size);

  // Facts we are about to assert cost money to fetch, so we fetch them for the
  // shortlist only (§44).
  await enrichShortlist(shortlist, providers.places, ctx.market.currency);

  // Enrichment can reveal a venue is closed or unaffordable; re-filter and
  // re-score with what we now know rather than carrying stale assumptions.
  const reFiltered = applyHardFilters(shortlist, ctx);
  for (const candidate of reFiltered.kept) {
    candidate.score = scoreCandidate(candidate, ctx);
  }
  diagnostics.candidatesRejected.push(
    ...reFiltered.rejected.map((c) => ({
      name: c.name,
      rule: c.rejection?.rule ?? "unknown",
      detail: c.rejection?.detail ?? "",
    }))
  );

  const scored = reFiltered.kept.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  diagnostics.shortlist = scored.map((c) => ({ name: c.name, score: c.score?.total ?? 0 }));

  if (scored.length === 0) {
    return failure(diagnostics, "No candidate survived verification-time detail checks");
  }

  await applyAdvisoryRanking(scored, ai, household, weekend);

  // --------------------------------------------------------------- assembly
  await stage("ASSEMBLY");
  const bundles = assembleBundles(scored, ctx, {
    limit: 6,
    excludeAnchorIds: options.excludeAnchorIds,
  });
  for (const bundle of bundles) scoreBundle(bundle, ctx);
  bundles.sort((a, b) => b.base_score - a.base_score);

  diagnostics.bundlesAssembled = bundles.map((b) => ({
    bundle_id: b.bundle_id,
    archetype: b.archetype,
    score: b.base_score,
  }));

  const deliverable = bundles.filter((b) => b.base_score >= SCORING_CONFIG.min_deliverable_score);
  if (deliverable.length === 0) {
    return failure(
      diagnostics,
      bundles.length === 0
        ? "No plan could be assembled that fits the available time"
        : `Best plan scored ${bundles[0]?.base_score ?? 0}, below the deliverable threshold`
    );
  }

  // -------------------------------------------------------------- selection
  await stage("SELECTION");
  const selection = await selectWithFallback(deliverable, ai, household, weekend, options);

  let primary = deliverable.find((b) => b.bundle_id === selection.primary_bundle_id) ?? deliverable[0];
  if (!primary) return failure(diagnostics, "Selection returned no usable plan");

  let backup =
    deliverable.find((b) => b.bundle_id === selection.backup_bundle_id) ??
    pickBackup(deliverable, primary);

  // ----------------------------------------------------------- verification
  await stage("VERIFICATION");
  const verifiedPrimary = await verifyWithRetries(
    primary,
    deliverable,
    ctx,
    providers,
    diagnostics
  );
  if (!verifiedPrimary) {
    return failure(diagnostics, "No plan passed factual verification");
  }
  primary = verifiedPrimary;

  // The backup must be verified too — it is a plan we are sending, not a note.
  const primaryId = primary.bundle_id;
  if (backup && backup.bundle_id === primaryId) {
    backup = pickBackup(deliverable, primary);
  }
  if (backup) {
    backup = await verifyWithRetries(
      backup,
      deliverable.filter((b) => b.bundle_id !== primaryId),
      ctx,
      providers,
      diagnostics
    );
  }

  // -------------------------------------------------------------- critique
  const critique = await critiqueSafely(ai, household, weekend, primary);
  diagnostics.critique.push({
    bundle_id: primaryId,
    approve: critique.approve,
    problems: critique.problems.map((p) => `${p.severity}: ${p.description}`),
  });

  if (!critique.approve) {
    // The critic blocking is a real signal, not advice. Try the next plan.
    const alternatives = deliverable.filter((b) => b.bundle_id !== primaryId);
    const replacement = await verifyWithRetries(
      alternatives[0] ?? null,
      alternatives,
      ctx,
      providers,
      diagnostics
    );
    if (!replacement) {
      return failure(
        diagnostics,
        `Plan was rejected at critique: ${critique.problems.map((p) => p.description).join("; ")}`
      );
    }
    primary = replacement;
  }

  // ------------------------------------------------------------------ copy
  await stage("COPY");
  const fitEvidence = buildFitEvidence(ctx, primary);
  const copy = new Map<string, import("@/lib/ai/schemas").PlanCopy>();

  copy.set(
    primary.bundle_id,
    await ai.writePlanCopy({
      household,
      weekend,
      bundle: toBundleSummary(primary),
      fit_evidence: fitEvidence,
    })
  );
  if (backup) {
    copy.set(
      backup.bundle_id,
      await ai.writePlanCopy({
        household,
        weekend,
        bundle: toBundleSummary(backup),
        fit_evidence: [`A lighter alternative to ${copy.get(primary.bundle_id)?.title ?? "the main plan"}`],
      })
    );
  }

  // ------------------------------------------------------------ validation
  await stage("VALIDATION");
  const validationError = finalValidation(primary, ctx);
  if (validationError) return failure(diagnostics, validationError);

  await stage("DONE");
  diagnostics.providerCostCents = providers.ledger.totalCents();

  return {
    ok: true,
    primary,
    backup,
    copy,
    fitEvidence,
    // Confidence blends the deterministic score, the verification result and
    // the model's own read. All three have to be good for us to be confident.
    confidence: round2(
      Math.min(
        1,
        (primary.base_score / 100) * 0.45 +
          (primary.verification?.score ?? 0) * 0.35 +
          Math.min(selection.confidence, critique.quality) * 0.2
      )
    ),
    failureReason: null,
    diagnostics,
  };
}

// ------------------------------------------------------------ helpers

/**
 * Verify a bundle; on failure, work down the ranked alternatives rather than
 * giving up (§13). Bounded so a bad week cannot spend unlimited provider calls.
 */
async function verifyWithRetries(
  first: Bundle | null,
  alternatives: Bundle[],
  ctx: PlanningContext,
  providers: ProviderBundle,
  diagnostics: GenerationDiagnostics
): Promise<Bundle | null> {
  const queue = [first, ...alternatives.filter((b) => b.bundle_id !== first?.bundle_id)].filter(
    (b): b is Bundle => b !== null
  );

  const attempts = Math.min(queue.length, GENERATION_CONFIG.max_assembly_attempts);

  for (let i = 0; i < attempts; i++) {
    const bundle = queue[i];
    if (!bundle) continue;

    if (providers.ledger.totalCents() > GENERATION_CONFIG.max_provider_cost_cents_per_run) {
      // Cost ceiling reached (§44). Better to fail loudly and retry the job
      // later than to quietly spend without bound.
      diagnostics.verification.push({
        bundle_id: bundle.bundle_id,
        score: 0,
        passed: false,
        failures: ["Provider cost ceiling reached for this run"],
      });
      return null;
    }

    const verification = await verifyBundle(bundle, ctx, providers.places, providers.routes);
    bundle.verification = verification;
    diagnostics.verification.push({
      bundle_id: bundle.bundle_id,
      score: verification.score,
      passed: verification.passed,
      failures: verification.failures,
    });

    if (verification.passed) return bundle;
  }

  return null;
}

async function applyAdvisoryRanking(
  candidates: Candidate[],
  ai: AIProvider,
  household: HouseholdContext,
  weekend: WeekendContext
): Promise<void> {
  try {
    const rankings = await ai.rankCandidates({
      household,
      weekend,
      candidates: candidates.map((c) => ({
        candidate_id: c.candidate_id,
        name: c.name,
        categories: c.categories,
        travel_minutes: c.travel?.minutes ?? 0,
        travel_mode: c.travel?.mode ?? "UNKNOWN",
        cost_min: c.cost?.min ?? null,
        cost_max: c.cost?.max ?? null,
        open_at_target_time: c.openingHours?.unknown ? "unknown" : true,
        busyness: c.busyness,
        base_score: c.score?.total ?? 0,
      })),
    });

    const byId = new Map(rankings.map((r) => [r.candidate_id, r.score]));
    for (const candidate of candidates) {
      const advisory = byId.get(candidate.candidate_id);
      if (advisory === undefined || !candidate.score) continue;
      candidate.score.advisory = advisory;
      // The model gets a minority vote. Its judgement is valuable, but the
      // deterministic score is the one we can test, explain and defend.
      candidate.score.total = round2(candidate.score.total * 0.75 + advisory * 0.25);
    }
  } catch {
    // Ranking is an enhancement, not a dependency.
  }
}

async function selectWithFallback(
  bundles: Bundle[],
  ai: AIProvider,
  household: HouseholdContext,
  weekend: WeekendContext,
  options: GenerateOptions
) {
  const ordered = options.preferEasier
    ? [...bundles].sort((a, b) => effortOf(a) - effortOf(b))
    : bundles;

  try {
    return await ai.selectPlan({
      household,
      weekend,
      bundles: ordered.map(toBundleSummary),
    });
  } catch {
    const primary = ordered[0];
    const backup = pickBackup(ordered, primary);
    return {
      primary_bundle_id: primary?.bundle_id ?? "",
      backup_bundle_id: backup?.bundle_id ?? "",
      primary_reason: "Selected by deterministic score (model unavailable)",
      backup_reason: "Least demanding alternative available",
      confidence: 0.6,
    };
  }
}

async function critiqueSafely(
  ai: AIProvider,
  household: HouseholdContext,
  weekend: WeekendContext,
  bundle: Bundle
) {
  try {
    return await ai.critiquePlan({ household, weekend, bundle: toBundleSummary(bundle) });
  } catch {
    // A missing critic must not block delivery of a plan that already passed
    // hard filters, scoring and factual verification.
    return { approve: true, problems: [], quality: 0.7 };
  }
}

/**
 * The backup should be genuinely easier, not merely different (§2). We prefer
 * the best-scoring plan that is lighter in at least one dimension.
 */
function pickBackup(bundles: Bundle[], primary: Bundle | undefined): Bundle | null {
  if (!primary) return null;
  const others = bundles.filter((b) => b.bundle_id !== primary.bundle_id);
  if (others.length === 0) return null;

  const easier = others.filter(
    (b) =>
      effortOf(b) < effortOf(primary) ||
      b.total_travel_minutes < primary.total_travel_minutes * 0.75 ||
      b.total_cost_max < primary.total_cost_max * 0.7 ||
      weatherproofness(b) > weatherproofness(primary)
  );

  return (
    easier.sort((a, b) => b.base_score - a.base_score)[0] ??
    others.sort((a, b) => effortOf(a) - effortOf(b))[0] ??
    null
  );
}

const EFFORT_RANK: Record<ActivityLevel, number> = { GENTLE: 0, EASY: 1, MODERATE: 2, ACTIVE: 3 };

function effortOf(bundle: Bundle): number {
  return EFFORT_RANK[bundle.activity_level] * 10 + bundle.walk_km + bundle.total_travel_minutes / 30;
}

function weatherproofness(bundle: Bundle): number {
  const indoor = bundle.items.filter(
    (i) => i.candidate && !i.candidate.public_space && i.item_type !== "TRAVEL"
  ).length;
  const total = bundle.items.filter((i) => i.candidate).length || 1;
  return indoor / total;
}

/**
 * Last gate before anything is persisted (§13). These are invariants rather
 * than judgements: if one of them is violated we have a bug, and shipping the
 * plan anyway would mean lying to a customer.
 */
function finalValidation(bundle: Bundle, ctx: PlanningContext): string | null {
  if (bundle.items.length === 0) return "Plan has no items";

  const named = bundle.items.filter((i) => i.candidate);
  if (named.length === 0) return "Plan has no actual destinations";

  for (const item of bundle.items) {
    if (item.end_time < item.start_time) {
      return `Item ${item.sequence} ends before it starts`;
    }
  }

  for (let i = 1; i < bundle.items.length; i++) {
    const previous = bundle.items[i - 1];
    const current = bundle.items[i];
    if (previous && current && current.start_time < previous.end_time) {
      return `Items ${previous.sequence} and ${current.sequence} overlap`;
    }
  }

  if (!bundle.verification?.passed) return "Plan was not verified";

  if (bundle.total_cost_min > ctx.derived.effectiveBudgetMax) {
    return "Plan's minimum cost exceeds the household's budget";
  }

  const anchorItem = bundle.items.find((i) => i.is_critical);
  if (!anchorItem?.candidate) return "Plan has no critical anchor item";

  const anchorVerification = bundle.verification.items.find(
    (v) => v.sequence === anchorItem.sequence
  );
  if (anchorVerification && anchorVerification.status === "FAILED") {
    return "Anchor activity failed verification";
  }

  return null;
}

// ------------------------------------------------------------ conversions

export function toHouseholdContext(ctx: PlanningContext): HouseholdContext {
  return {
    shape: ctx.household.shape,
    adults: ctx.derived.adults,
    children_ages: ctx.derived.childAges,
    mobility_notes: ctx.derived.mobilityNotes.map(sanitiseUserText),
    preferences: {
      ...ctx.preferences,
      hard_no: ctx.preferences.hard_no ? sanitiseUserText(ctx.preferences.hard_no) : null,
    },
    taste_signals: tasteSignalsForPrompt(ctx.taste),
    recent_anchor_names: [...ctx.derived.recentlySuggested.keys()],
    completed_anchor_names: [...ctx.derived.recentlyCompleted.keys()],
  };
}

export function toWeekendContext(ctx: PlanningContext): WeekendContext {
  return {
    weekend_date: ctx.weekendDate,
    weather: ctx.weather,
    energy: ctx.checkin?.energy ?? null,
    budget: ctx.checkin?.budget ?? null,
    time: ctx.checkin?.time ?? null,
    note: ctx.checkin?.note ? sanitiseUserText(ctx.checkin.note) : null,
    market_display_name: ctx.market.display_name,
    currency: ctx.market.currency,
  };
}

export function toBundleSummary(bundle: Bundle): BundleSummary {
  return {
    bundle_id: bundle.bundle_id,
    archetype: bundle.archetype,
    items: bundle.items.map((i) => ({
      sequence: i.sequence,
      item_type: i.item_type,
      name: i.name,
      start_time: i.start_time,
      end_time: i.end_time,
      travel_minutes: i.travel_minutes,
      cost_min: i.cost_min,
      cost_max: i.cost_max,
    })),
    total_cost_min: bundle.total_cost_min,
    total_cost_max: bundle.total_cost_max,
    total_travel_minutes: bundle.total_travel_minutes,
    walk_km: bundle.walk_km,
    activity_level: bundle.activity_level,
    base_score: bundle.base_score,
  };
}

function failure(diagnostics: GenerationDiagnostics, reason: string): GenerationResult {
  diagnostics.stage = "FAILED";
  return {
    ok: false,
    primary: null,
    backup: null,
    copy: new Map(),
    fitEvidence: [],
    confidence: 0,
    failureReason: reason,
    diagnostics,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Re-exported so callers do not need to know the module layout. */
export { VERIFICATION_CONFIG };
