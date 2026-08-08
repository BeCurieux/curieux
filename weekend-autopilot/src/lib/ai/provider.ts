/**
 * AIProvider interface (§12).
 *
 * Provider-agnostic by construction: no vendor type appears in any signature,
 * and the planner imports only from this file. Swapping models is one adapter.
 *
 * Every method takes facts and returns a validated structure. The division of
 * labour throughout is the same (§13): the model decides, the APIs supply the
 * facts, and the model is never asked to recall a business, an address, an
 * opening time or a price.
 */

import type { z } from "zod";
import type {
  ActivityLevel,
  HouseholdMember,
  PreferenceProfile,
  TasteSignal,
  WeatherForecast,
  PlanFeedback,
} from "@/lib/types";
import type { SearchIntent, PlanCopy } from "./schemas";

// ------------------------------------------------------------ shared inputs

/** The household picture handed to every call. Contains no personal identifiers. */
export interface HouseholdContext {
  shape: string;
  adults: number;
  /** Ages only — never a child's name (§9 screen 2). */
  children_ages: number[];
  mobility_notes: string[];
  preferences: PreferenceProfile;
  /** Top structured taste signals, strongest first. */
  taste_signals: Array<Pick<TasteSignal, "dimension" | "value" | "weight" | "confidence">>;
  /** Anchors already suggested or completed recently, so we do not repeat. */
  recent_anchor_names: string[];
  completed_anchor_names: string[];
}

export interface WeekendContext {
  weekend_date: string;
  weather: WeatherForecast | null;
  /** Optional check-in overrides for this specific weekend. */
  energy: string | null;
  budget: string | null;
  time: string | null;
  /** Free text from the user. UNTRUSTED — see src/lib/security/sanitise.ts. */
  note: string | null;
  market_display_name: string;
  currency: string;
}

/** A candidate as presented to the model: facts only, each with a source. */
export interface CandidateSummary {
  candidate_id: string;
  name: string;
  categories: string[];
  travel_minutes: number;
  travel_mode: string;
  /** Cost band from a provider, or null when unknown. Never invented. */
  cost_min: number | null;
  cost_max: number | null;
  open_at_target_time: boolean | "unknown";
  busyness: number | null;
  /** Deterministic score already computed by our engine. */
  base_score: number;
}

/** An assembled bundle offered to the model for selection. */
export interface BundleSummary {
  bundle_id: string;
  archetype: string;
  items: Array<{
    sequence: number;
    item_type: string;
    name: string;
    start_time: string;
    end_time: string;
    travel_minutes: number | null;
    cost_min: number;
    cost_max: number;
  }>;
  total_cost_min: number;
  total_cost_max: number;
  total_travel_minutes: number;
  walk_km: number;
  activity_level: ActivityLevel;
  base_score: number;
}

// ------------------------------------------------------------ the interface

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  /** Readable taste summary for the end of onboarding (§9 screen 10). */
  buildTasteSummary(input: {
    household: HouseholdContext;
    members: Array<Pick<HouseholdMember, "member_type" | "age">>;
    currency: string;
  }): Promise<string>;

  /** Turn a profile plus this weekend's context into provider queries (§14). */
  generateSearchIntents(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
  }): Promise<SearchIntent[]>;

  /** Advisory re-rank of the shortlist. Blended with, never replacing, our score. */
  rankCandidates(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    candidates: CandidateSummary[];
  }): Promise<Array<{ candidate_id: string; score: number; reason: string }>>;

  /** Choose the primary and the backup from assembled bundles. */
  selectPlan(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundles: BundleSummary[];
  }): Promise<{
    primary_bundle_id: string;
    backup_bundle_id: string;
    primary_reason: string;
    backup_reason: string;
    confidence: number;
  }>;

  /** Adversarial pass before delivery: would a thoughtful friend send this? */
  critiquePlan(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundle: BundleSummary;
  }): Promise<{
    approve: boolean;
    problems: Array<{ severity: "BLOCKER" | "CONCERN"; item_sequence: number | null; description: string }>;
    quality: number;
  }>;

  /** Write the customer-facing copy over a structure that is already fixed. */
  writePlanCopy(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundle: BundleSummary;
    /** Evidence the fit_reason must be grounded in. */
    fit_evidence: string[];
  }): Promise<PlanCopy>;

  /** Turn free-text feedback into proposed structured signal changes (§24). */
  summariseFeedback(input: {
    household: HouseholdContext;
    feedback: Pick<PlanFeedback, "did_it" | "rating" | "not_done_reason" | "note">;
    plan_summary: string;
  }): Promise<Array<{ dimension: string; value: string; delta: number; evidence: string }>>;

  /** Periodic consolidation of the taste model (§19). */
  updateTasteModel(input: {
    household: HouseholdContext;
    recent_outcomes: string[];
  }): Promise<Array<{ dimension: string; value: string; weight: number; confidence: number; reason: string }>>;

  /** One-line dashboard insight, or null when the evidence is too thin (§34). */
  tasteInsight(input: { household: HouseholdContext }): Promise<string | null>;
}

// ------------------------------------------------------------ observability

/**
 * Every model call is recorded (§43). Note the absence of raw prompt text:
 * prompts contain household context, and operational logs are not the place
 * for it. We store a hash of the input and the structured output instead.
 */
export interface AIRunRecord {
  provider: string;
  model: string;
  prompt_version: string;
  operation: string;
  input_hash: string;
  output: unknown;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_cents: number;
  success: boolean;
  validation_errors: string[];
  attempts: number;
  household_id: string | null;
  generation_run_id: string | null;
}

export type AIRunSink = (record: AIRunRecord) => void | Promise<void>;

/** Options every adapter accepts, so the planner can wire observability in. */
export interface AIProviderOptions {
  sink?: AIRunSink;
  householdId?: string | null;
  generationRunId?: string | null;
  /** Retries on malformed structured output (§12). */
  maxAttempts?: number;
}

/** Convenience alias for adapters implementing schema-validated calls. */
export type SchemaOf<T> = z.ZodType<T>;
