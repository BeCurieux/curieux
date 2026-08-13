/**
 * What produced a shop, recorded so a shop can be traced back to it.
 *
 * The build brief calls the provenance log the moat and says it is
 * "unrecoverable if not captured now". Two of the four fields it asks for were
 * missing: the model that actually served the generation, and which revision
 * of the prompt was in force. Both are cheap today and impossible to backfill
 * for shops already generated, which is the entire argument for adding them
 * before the first real catalogues rather than after.
 *
 * The prompt revision is a **content fingerprint, not a hand-set version**, and
 * that is the important decision in this file. A `PROMPT_VERSION = 3` constant
 * has one failure mode and it is the exact failure this is meant to prevent:
 * somebody edits the prompt and does not bump the number, so every shop after
 * the edit is filed under the revision before it — silently, and in a way no
 * test can catch without recomputing the thing the constant was standing in
 * for. A fingerprint cannot drift from what it describes, because it is
 * derived from it.
 *
 * The cost is that fingerprints do not sort. Ordering comes from `created_at`,
 * which is a better source for it anyway.
 */

import { createHash } from "node:crypto";

/**
 * A short, stable identifier for a prompt's exact text.
 *
 * Twelve hex characters. Long enough that two prompts in this codebase will not
 * collide, short enough to read in a log line and compare by eye.
 */
export function promptFingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

/**
 * The provenance of one generation.
 *
 * `model` is the model that **answered**, not the one that was asked for. With
 * `fallbacks: "default"` in force those can differ — a policy decline is
 * re-served by another model and the response says which. Recording the
 * requested model would quietly attribute a fallback's work to a model that
 * refused to do it.
 */
export interface Provenance {
  /** The model that served the merchandising call, as it reported itself. */
  model: string;
  /** Fingerprint of the merchandiser's system prompt at generation time. */
  promptVersion: string;
  /**
   * Fingerprint of the Genome pass behind this shop's input, and the model
   * that served it — `null` when the shop was generated without a Genome.
   *
   * On the shop version rather than per product, which is not what the brief
   * asks for. Per-product versioning needs a column on an enrichment table
   * that does not exist yet; this answers the question that matters today —
   * *which* Genome fed this shop — and is a strict subset of the eventual
   * shape rather than something that has to be undone to get there.
   */
  genomeVersion: string | null;
}

/** The `genomeVersion` string, kept in one place so both writers agree. */
export function genomeVersionOf(model: string, promptFingerprintValue: string): string {
  return `${model}/${promptFingerprintValue}`;
}
