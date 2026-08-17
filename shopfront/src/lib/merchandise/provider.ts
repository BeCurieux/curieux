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
  usage?: TokenUsage;
}

/**
 * What a generation cost, in tokens.
 *
 * `inputTokens` is every input token the request was billed for, cached ones
 * included. The API reports cached reads and cache writes separately from
 * `input_tokens`, and the brief is deliberately cached — so reading only
 * `input_tokens` reports a two-token prompt for a request that actually sent a
 * whole catalogue, which is how the first real merchandising runs appeared to
 * cost nothing. The split is kept because the two are billed at different
 * rates, and a cost estimate that ignores that is wrong in the other direction.
 */
export interface TokenUsage {
  /** Total billed input, including `cachedInputTokens` and `cacheWriteTokens`. */
  inputTokens: number;
  outputTokens: number;
  /** Read from the cache — billed at a fraction of the base input rate. */
  cachedInputTokens: number;
  /** Written to the cache on this request — billed above the base input rate. */
  cacheWriteTokens: number;
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
