/**
 * The seam between Genome v1 and whatever answers the classification.
 *
 * Same arrangement as the v0 Genome and the merchandiser: `anthropic.ts` is
 * real, `mock.ts` is deterministic and free. The mock is never a fallback. A
 * value it produced is stored under the mock's name, so nothing downstream can
 * mistake a keyword match for a model's read.
 *
 * A provider returns runs, unvalidated. Parsing, consensus and every rule
 * happen above this line, identically for every provider.
 */

import type { ClassifierInput } from "./inputs";

export interface ClassifyRequest {
  /** Stable within one call: `p<index>-r<run>`. */
  customId: string;
  input: ClassifierInput;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** All cache writes, both TTLs. */
  cacheWriteTokens: number;
  /** The part of `cacheWriteTokens` written with the 1-hour TTL (2x input, not 1.25x). Absent in older records. */
  cacheWrite1hTokens?: number;
}

export interface RunResult {
  customId: string;
  /** Unvalidated model output, or null when the run failed. */
  output: unknown | null;
  error: string | null;
  usage: Usage | null;
  /** How this one request was billed, when it differs from the provider's (the batch's cache warm-up is a direct request). */
  billing?: "batch" | "standard";
}

export interface ClassifierProvider {
  readonly name: string;
  readonly model: string;
  /** Batch requests are billed at half price; the cost ledger needs to know. */
  readonly billing: "batch" | "standard" | "free";
  classify(requests: readonly ClassifyRequest[], onProgress?: (message: string) => void): Promise<RunResult[]>;
  /** Input tokens for one request, for the pre-flight cost estimate. */
  countInputTokens?(request: ClassifyRequest): Promise<number>;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0 };

export function addUsage(a: Usage, b: Usage | null): Usage {
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheWrite1hTokens: (a.cacheWrite1hTokens ?? 0) + (b.cacheWrite1hTokens ?? 0),
  };
}
