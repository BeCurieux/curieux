/**
 * Two schemas describe one object, so they have to be made to agree.
 *
 * The JSON Schema constrains the API and carries the prompt surface; the zod
 * schema does the enforcing. They drift silently — a field renamed in one and
 * not the other produces a model dutifully filling a key nobody reads.
 */

import { describe, expect, it } from "vitest";
import { GENOME_INFERENCE_SCHEMA } from "@/lib/genome/inference-schema";
import { GenomeInference, ProductInferenceSchema } from "@/lib/genome/inference";
import { z } from "zod";

type JsonSchema = Record<string, any>;

const PRODUCT: JsonSchema = (GENOME_INFERENCE_SCHEMA as JsonSchema).properties.products.items;

describe("the JSON Schema and the zod schema agree", () => {
  it("names the same fields on a product", () => {
    const json = Object.keys(PRODUCT.properties).sort();
    const zodKeys = Object.keys(ProductInferenceSchema.shape).sort();
    expect(json).toEqual(zodKeys);
  });

  it("requires everything, because a partial read is not a cheaper read", () => {
    // Every field is load-bearing for some merchandising decision, and an
    // optional one comes back absent for the products it was hardest to judge —
    // which are exactly the products the field was worth having for.
    expect([...PRODUCT.required].sort()).toEqual(Object.keys(PRODUCT.properties).sort());
  });

  it("offers the same enum members", () => {
    for (const field of ["role", "giftability", "confidence"] as const) {
      const json = [...PRODUCT.properties[field].enum].sort();
      const shape = ProductInferenceSchema.shape[field];
      const zodValues = [...(shape as z.ZodEnum<[string, ...string[]]>).options].sort();
      expect(json, field).toEqual(zodValues);
    }
  });

  it("closes every object, so the model cannot invent a field", () => {
    const objects: JsonSchema[] = [GENOME_INFERENCE_SCHEMA as JsonSchema, PRODUCT];
    for (const object of objects) {
      expect(object.additionalProperties).toBe(false);
    }
  });

  it("uses no keyword structured outputs will reject", () => {
    // maxLength/minItems and friends are unsupported; the real limits live in
    // zod and are stated in prose in the descriptions.
    const banned = ["maxLength", "minLength", "minimum", "maximum", "multipleOf", "minItems", "maxItems"];
    const seen: string[] = [];
    walk(GENOME_INFERENCE_SCHEMA as JsonSchema, (node) => {
      for (const key of banned) if (key in node) seen.push(key);
    });
    expect(seen).toEqual([]);
  });

  it("describes every field, because the descriptions are the prompt", () => {
    // Named properties only. An array's `items` schema carries no description
    // of its own — the array above it says what its members are, and repeating
    // that on the element would just be two places to keep in step.
    const check = (node: JsonSchema): void => {
      expect(typeof node.description, JSON.stringify(node).slice(0, 80)).toBe("string");
      for (const child of Object.values(node.properties ?? {})) check(child as JsonSchema);
      const items = node.items as JsonSchema | undefined;
      if (items?.type === "object") check(items);
    };
    check(GENOME_INFERENCE_SCHEMA as JsonSchema);
  });

  it("accepts under zod what it accepts under the JSON Schema", () => {
    const valid = {
      catalogueRead: "Small-run knitwear and homewares.",
      products: [
        {
          handle: "oat-crew",
          problemSolved: "A warm layer that survives being worn every day.",
          audience: "Someone buying their first proper knitwear.",
          occasions: ["everyday"],
          role: "hero",
          giftability: "medium",
          complements: ["wool-throw"],
          substitutes: ["sage-cardigan"],
          confidence: "high",
        },
      ],
    };
    expect(GenomeInference.safeParse(valid).success).toBe(true);
  });
});

function walk(node: JsonSchema, visit: (node: JsonSchema) => void): void {
  visit(node);
  if (node.properties) for (const child of Object.values(node.properties)) walk(child as JsonSchema, visit);
  if (node.items) walk(node.items as JsonSchema, visit);
}
