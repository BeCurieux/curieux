/**
 * Merchant declarations (HANDOFF §6.1 rule 3).
 *
 * An override is not a separate table or a patch on a model row. It is a
 * `genome_values` row with `provenance: merchant_declared`, which `resolve()`
 * ranks above everything else for that merchant. The model's answer is kept
 * beside it, unchanged, so the eval can still ask how often merchants
 * disagreed with the model.
 *
 * `known_pairings` is only ever written here. A pairing the model suggests is
 * shown to the merchant and never stored until the merchant confirms it —
 * confirming it *is* calling this.
 */

import type { GenomeValue } from "./records";
import { dimension, isPermitted, TAXONOMY_VERSION, UNKNOWN, type DimensionId } from "./taxonomy";

export class OverrideError extends Error {}

export function declare(input: {
  storeUrl: string;
  handle: string;
  dimension: DimensionId;
  values: readonly string[];
  /** Every handle in the merchant's catalogue, to check pairings against. */
  catalogueHandles: ReadonlySet<string>;
  now?: Date;
}): GenomeValue[] {
  const def = dimension(input.dimension);
  const values = [...new Set(input.values.map((x) => x.trim()).filter(Boolean))];

  if (values.length === 0) throw new OverrideError(`Declare at least one value for ${def.id}, or "${UNKNOWN}".`);
  if (!input.catalogueHandles.has(input.handle)) throw new OverrideError(`No product "${input.handle}" in this catalogue.`);

  if (def.productRefs) {
    const missing = values.filter((h) => !input.catalogueHandles.has(h));
    if (missing.length) throw new OverrideError(`Pairings must be products in this catalogue; not found: ${missing.join(", ")}.`);
    if (values.includes(input.handle)) throw new OverrideError("A product cannot pair with itself.");
  } else {
    const illegal = values.filter((x) => !isPermitted(def.id as DimensionId, x));
    if (illegal.length) {
      throw new OverrideError(`${illegal.join(", ")} not permitted for ${def.id} in ${TAXONOMY_VERSION}.`);
    }
    if (def.cardinality === "single" && values.length > 1) throw new OverrideError(`${def.id} takes one value.`);
    if (def.maxLabels && values.length > def.maxLabels) throw new OverrideError(`${def.id} takes at most ${def.maxLabels}.`);
    if (values.length > 1 && values.includes(UNKNOWN)) throw new OverrideError(`"${UNKNOWN}" cannot sit beside a value.`);
  }

  const derivedAt = (input.now ?? new Date()).toISOString();
  return values.map((value) => ({
    storeUrl: input.storeUrl,
    handle: input.handle,
    dimension: def.id as DimensionId,
    value,
    layer: def.layer,
    taxonomyVersion: TAXONOMY_VERSION,
    provenance: "merchant_declared",
    confidence: 1,
    evidenceState: null,
    rawValue: "declared by merchant",
    comparisonScope: null,
    comparisonN: null,
    percentile: null,
    derivedAt,
    inputsHash: "merchant_declared",
    runAgreement: null,
    model: null,
    promptVersion: null,
  }));
}
