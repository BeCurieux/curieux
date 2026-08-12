/**
 * The seam between the Genome and the model that supplies it.
 *
 * Same arrangement as the merchandiser's, for the same reasons: `anthropic.ts`
 * is real, `mock.ts` is a deterministic heuristic read that costs nothing and
 * always validates. The mock is not a fallback — a Genome silently produced by
 * heuristics and stored under a model's name would make every downstream
 * decision look better-founded than it is.
 */

import type { GenomeInference } from "./inference";

export interface GenomeRequest {
  system: string;
  brief: string;
  /** Handles offered, in order — a provider may need them to answer at all. */
  handles: string[];
  corrections: GenomeCorrection[];
}

export interface GenomeCorrection {
  attempted: unknown;
  errors: string[];
}

export interface GenomeResult {
  /** Unvalidated. Providers must not pre-filter. */
  inference: unknown;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface GenomeProvider {
  readonly name: string;
  read(request: GenomeRequest): Promise<GenomeResult>;
}

export function providerNameFromEnv(): "anthropic" | "mock" {
  return process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "mock";
}

export type { GenomeInference };
