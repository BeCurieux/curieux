/**
 * The classifier's output contract, generated from `taxonomy.ts`.
 *
 * Two forms of one thing: a JSON Schema for `output_config.format`, which makes
 * the API itself refuse to emit a value outside the enums, and a zod parser
 * that re-checks every run in code, because the application is where a rule
 * is enforced, not the model. Both are built from `DIMENSIONS`, so neither can
 * drift from the taxonomy or from the other.
 *
 * There is no free-text field anywhere: no rationale, no confidence. A
 * self-reported score is exactly what rule 4 forbids storing, and an
 * explanation is generated *from* a classification, never alongside it
 * (rule 2).
 */

import { z } from "zod";
import {
  DIMENSIONS,
  MODEL_DIMENSIONS,
  PARENT_CATEGORIES,
  permittedValues,
  UNKNOWN,
  type ModelDimensionId,
  type ParentCategory,
} from "./taxonomy";

type JsonSchema = Record<string, unknown>;

const modelDims = DIMENSIONS.filter((d) => d.derivation === "model");

export const CLASSIFICATION_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["parent_category", ...MODEL_DIMENSIONS],
  properties: {
    parent_category: {
      type: "string",
      enum: [...PARENT_CATEGORIES],
      description: "The product's broad category. Used to choose price reference bands; 'other' when none fits.",
    },
    ...Object.fromEntries(
      modelDims.map((d) => {
        const values = permittedValues(d.id);
        const schema: JsonSchema =
          d.cardinality === "single"
            ? { type: "string", enum: values, description: d.question }
            : {
                type: "array",
                items: { type: "string", enum: values },
                description: `${d.question}${"maxLabels" in d && d.maxLabels ? ` At most ${d.maxLabels}, most characteristic first.` : ""} Use ["${UNKNOWN}"] when none can be supported.`,
              };
        return [d.id, schema];
      }),
    ),
  },
};

export interface Classification {
  parent_category: ParentCategory;
  answers: Record<ModelDimensionId, string | string[]>;
}

const single = (dim: ModelDimensionId) => z.enum(permittedValues(dim) as [string, ...string[]]);

const parser = z
  .object({
    parent_category: z.enum(PARENT_CATEGORIES),
    ...Object.fromEntries(
      modelDims.map((d) => {
        const item = single(d.id as ModelDimensionId);
        return [d.id, d.cardinality === "single" ? item : z.array(item)];
      }),
    ),
  })
  .strict();

/**
 * Parse one run. A multi-label answer over its cap is truncated to the first
 * N, because the model is told to list most characteristic first. An empty
 * array means `unknown`. Anything else outside the contract throws, and the
 * run counts as failed rather than being repaired.
 */
export function parseClassification(raw: unknown): Classification {
  const parsed = parser.parse(raw) as Record<string, unknown>;
  const answers = {} as Record<ModelDimensionId, string | string[]>;
  for (const d of modelDims) {
    const value = parsed[d.id] as string | string[];
    if (Array.isArray(value)) {
      const unique = [...new Set(value)];
      const cap = "maxLabels" in d && d.maxLabels ? d.maxLabels : unique.length;
      answers[d.id as ModelDimensionId] = unique.length === 0 ? [UNKNOWN] : unique.slice(0, cap);
    } else {
      answers[d.id as ModelDimensionId] = value;
    }
  }
  return { parent_category: parsed.parent_category as ParentCategory, answers };
}
