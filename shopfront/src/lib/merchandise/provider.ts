/**
 * The seam between the merchandiser's judgement and the model that supplies it.
 *
 * Two implementations. `anthropic.ts` is the real one. `mock.ts` is a
 * deterministic heuristic that assembles a defensible default shop from the
 * ingest alone — no API key, no network, no cost. That is not a stub: it makes
 * the whole pipeline testable, it gives step 3's renderer something to consume
 * without burning a call per reload, and it is the thing to compare the model
 * against when asking whether the merchandising is actually earning its keep.
 *
 * What it is *not* is a fallback. If the API is unreachable, the ingest fails
 * loudly rather than quietly shipping a heuristic shop under the model's name.
 */

import type { IngestResult } from "@/lib/ingest/types";
import type { MerchandisingPlan } from "./plan";

export interface GenerateRequest {
  ingest: IngestResult;
  /** The merchant's brief, verbatim. */
  prompt: string;
  system: string;
  /** The assembled brief — brand, voice, colour, links, catalogue. */
  brief: string;
  /**
   * Validation errors from the previous attempt, oldest first. Empty on the
   * first attempt. A provider that ignores these will loop.
   */
  corrections: Correction[];
}

export interface Correction {
  /** The raw plan the model produced, as it produced it. */
  attempted: unknown;
  errors: string[];
}

export interface GenerateResult {
  /** Unvalidated — the caller checks it. Providers must not pre-filter. */
  plan: unknown;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface MerchandiseProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

/** Which provider `merchandise()` builds when the caller doesn't pass one. */
export function providerNameFromEnv(): "anthropic" | "mock" {
  return process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "mock";
}

export type { MerchandisingPlan };
