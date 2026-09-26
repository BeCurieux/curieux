/**
 * The classifier's instructions, rendered from the taxonomy.
 *
 * The same definitions and boundary rules the labellers read, word for word,
 * because the eval compares the two. A model working from a paraphrase of the
 * spec the humans labelled against would be measured against the wrong thing.
 *
 * `PROMPT_VERSION` is a content fingerprint of this text and the output
 * schema, like the merchandiser's. It cannot drift from what it describes, and
 * any change to either makes the eval treat the run as new (HANDOFF §8:
 * re-run on every prompt, model or taxonomy change).
 */

import { CLASSIFICATION_SCHEMA } from "./classify-schema";
import { hashOf, stableJson, type ClassifierInput } from "./inputs";
import { DIMENSIONS, GLOBAL_BOUNDARY_RULES, TAXONOMY_VERSION, UNKNOWN } from "./taxonomy";

function renderTaxonomy(): string {
  return DIMENSIONS.filter((d) => d.derivation === "model")
    .map((d) => {
      const lines = [
        `## ${d.id} (${d.cardinality === "single" ? "exactly one" : `one or more${"maxLabels" in d && d.maxLabels ? `, at most ${d.maxLabels}` : ""}`})`,
        d.question,
        ...d.values.map((x) => `- ${x.id}: ${x.definition}`),
        `- ${UNKNOWN}: the listing does not support any value above, or the evidence is split.`,
        ...d.boundaryRules.map((r) => `Rule: ${r}`),
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

export const SYSTEM_PROMPT = [
  `You classify one product at a time against a fixed merchandising taxonomy (${TAXONOMY_VERSION}).`,
  "",
  "You choose only from the permitted values. You do not describe the product, explain your choices, or add anything the schema does not ask for. The answer is used to build shops from a merchant's own catalogue, and a wrong confident value does more harm than an honest unknown.",
  "",
  "# Rules for every dimension",
  ...GLOBAL_BOUNDARY_RULES.map((r) => `- ${r}`),
  "",
  "# Dimensions",
  renderTaxonomy(),
  "",
  "# parent_category",
  "The product's broad category, used only to pick price reference bands. Choose the closest; 'other' when none fits.",
].join("\n");

export const PROMPT_VERSION = `v1-${hashOf({ system: SYSTEM_PROMPT, schema: CLASSIFICATION_SCHEMA })}`;

/** The per-product message: the listing as data, and one image if there is one. */
export function productText(input: ClassifierInput): string {
  const { imageUrl: _image, ...listing } = input;
  return [
    "Classify this product. The listing, as the merchant wrote it:",
    "",
    stableJson(listing),
  ].join("\n");
}
