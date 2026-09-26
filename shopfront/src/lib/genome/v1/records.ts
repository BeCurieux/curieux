/**
 * The Genome value record — HANDOFF §6.2, one row per value.
 *
 * A multi-label dimension is several rows. Every row says where it came from
 * (`provenance`), how sure we are as a *measured* number (`confidence`: repeat
 * run agreement for the model, 1 for a rule or a declaration, never a score
 * the model reported about itself), and, for a catalogue-relative value, what
 * it was compared against.
 *
 * `storeUrl` stands in for the spec's `merchant_id`. A merchant, in the sense
 * of an installation, does not exist until M0; the store row is what a public
 * catalogue has, and the installation will point at it when it arrives.
 */

import { TAXONOMY_VERSION, dimension, type DimensionId, type Layer, UNKNOWN } from "./taxonomy";

export const PROVENANCES = [
  "taxonomy_model",
  "deterministic_rule",
  "merchant_declared",
  "behaviour_inferred",
  "human_reviewed",
] as const;
export type Provenance = (typeof PROVENANCES)[number];

/**
 * Behavioural evidence states. Stored, never advanced: nothing in M1 or M2
 * reads a shopper event (owner's ruling, 2026-09-26), so a value that could
 * one day be behaviourally evidenced is recorded as `unobserved`, or
 * `provisional` when a cold-start rule assigned it. Null on dimensions that
 * have no behavioural layer.
 */
export const EVIDENCE_STATES = ["unobserved", "provisional", "evidenced"] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export type ComparisonScope = "product_type" | "store" | "global_reference";

export interface GenomeValue {
  storeUrl: string;
  handle: string;
  dimension: DimensionId;
  value: string;
  layer: Layer;
  taxonomyVersion: typeof TAXONOMY_VERSION;
  provenance: Provenance;
  /** 0–1, measured. Null where nothing was measured (e.g. a split vote). */
  confidence: number | null;
  evidenceState: EvidenceState | null;
  /** What the value was derived from, as a human would want to check it. */
  rawValue: string | null;
  comparisonScope: ComparisonScope | null;
  comparisonN: number | null;
  percentile: number | null;
  derivedAt: string;
  /** Hash of exactly the inputs this value was derived from. */
  inputsHash: string;
  /** Model-classified only: e.g. "4/5". */
  runAgreement: string | null;
  model: string | null;
  promptVersion: string | null;
}

/**
 * Highest first. A merchant's declaration overrides every other source for
 * that merchant (rule 3); a human review beats anything computed; a rule beats
 * an inference. `behaviour_inferred` sits below the rules deliberately, and in
 * M1 nothing produces it.
 */
export const PRECEDENCE: readonly Provenance[] = [
  "merchant_declared",
  "human_reviewed",
  "deterministic_rule",
  "behaviour_inferred",
  "taxonomy_model",
];

/**
 * The values that count, per product and dimension: every row from the
 * highest-precedence provenance present, and nothing from below it.
 *
 * Whole-group rather than per-value, because a declaration is a statement
 * about the dimension. A merchant who says a shirt is for `men` has said it is
 * not for `women`, even though no row says so.
 */
export function resolve(values: readonly GenomeValue[]): GenomeValue[] {
  const groups = new Map<string, GenomeValue[]>();
  for (const row of values) {
    const key = `${row.storeUrl}\u0000${row.handle}\u0000${row.dimension}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const out: GenomeValue[] = [];
  for (const group of groups.values()) {
    const winner = PRECEDENCE.find((p) => group.some((row) => row.provenance === p));
    out.push(...group.filter((row) => row.provenance === winner));
  }
  return out;
}

export interface EligibilityPolicy {
  /** Dimensions whose inter-labeller kappa passed the gate (≥ 0.6). */
  gatePassed: ReadonlySet<DimensionId>;
  /**
   * Minimum measured confidence for a model value. The spec leaves this open;
   * 0.8 means four of five runs agreed.
   */
  confidenceThreshold: number;
  minComparisonN: number;
}

export const DEFAULT_ELIGIBILITY: Omit<EligibilityPolicy, "gatePassed"> = {
  confidenceThreshold: 0.8,
  minComparisonN: 10,
};

/**
 * Whether a value may ever be used beyond its own merchant (HANDOFF §6.2).
 *
 * Computed, never stored as a flag, so it cannot go stale against the gate.
 * Nothing consumes it yet; cross-merchant learning is out of V1, and this
 * exists so the data logged now is honest about which of it could be used.
 */
export function crossMerchantEligible(row: GenomeValue, policy: EligibilityPolicy): boolean {
  const def = dimension(row.dimension);
  if (def.crossMerchantExcluded) return false;
  if (!policy.gatePassed.has(row.dimension)) return false;
  if (row.value === UNKNOWN) return false;

  const trusted =
    row.provenance === "human_reviewed" ||
    row.provenance === "merchant_declared" ||
    row.provenance === "deterministic_rule" ||
    (row.confidence !== null && row.confidence >= policy.confidenceThreshold);
  if (!trusted) return false;

  // A value on a behavioural layer counts only once it is evidenced. A
  // cold-start `provisional` role is a rule's guess about behaviour, not
  // evidence of it.
  if (row.evidenceState !== null && row.evidenceState !== "evidenced") return false;
  if (row.layer === "merchant_relative" && row.comparisonScope && row.comparisonScope !== "global_reference") {
    if ((row.comparisonN ?? 0) < policy.minComparisonN) return false;
  }
  return true;
}
