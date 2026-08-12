/**
 * The JSON Schema handed to the model and the zod schema that enforces its
 * output describe the same object. Two sources of truth is a real risk, so
 * this is the thing that stops them drifting.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MERCHANDISING_PLAN_SCHEMA } from "@/lib/merchandise/plan-schema";
import { SPRINT_1_BLOCK_TYPES } from "@/lib/merchandise/plan";
import {
  DropBlock,
  HeroBlock,
  LinkListBlock,
  OfferBlock,
  ProductGridBlock,
  RoutineBlock,
  ThemeTokens,
} from "@/lib/schema";

type Node = Record<string, any>;

const root = MERCHANDISING_PLAN_SCHEMA as Node;
const blockVariants: Node[] = root["properties"].blocks.items.properties.block.anyOf;

/** Required and optional keys of a zod object, as JSON Schema would name them. */
function zodKeys(schema: z.ZodObject<z.ZodRawShape>): { all: string[]; required: string[] } {
  const shape = schema.shape;
  return {
    all: Object.keys(shape),
    required: Object.entries(shape)
      .filter(([, value]) => !(value as z.ZodTypeAny).isOptional())
      .map(([key]) => key),
  };
}

function variantFor(type: string): Node {
  const found = blockVariants.find((variant) => variant.properties?.type?.const === type);
  if (!found) throw new Error(`No JSON Schema variant for block type "${type}"`);
  return found;
}

function* objectNodes(node: unknown): Generator<Node> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) yield* objectNodes(child);
    return;
  }
  const record = node as Node;
  if (record["type"] === "object") yield record;
  for (const value of Object.values(record)) yield* objectNodes(value);
}

describe("the schema handed to the model", () => {
  it("offers exactly the block types this sprint supports", () => {
    const types = blockVariants.map((variant) => variant.properties.type.const).sort();
    expect(types).toEqual([...SPRINT_1_BLOCK_TYPES].sort());
  });

  it("does not offer reviews or capture", () => {
    // Reviews were never ingested and email capture is not wired up. The model
    // cannot choose a block it is never shown.
    const types = blockVariants.map((variant) => variant.properties.type.const);
    expect(types).not.toContain("reviews");
    expect(types).not.toContain("capture");
  });

  it("agrees with zod on every block's fields", () => {
    const pairs: [string, z.ZodObject<z.ZodRawShape>][] = [
      ["hero", HeroBlock],
      ["productGrid", ProductGridBlock],
      ["routine", RoutineBlock],
      ["drop", DropBlock],
      ["offer", OfferBlock],
      ["linkList", LinkListBlock],
    ];

    for (const [type, schema] of pairs) {
      const variant = variantFor(type);
      const zod = zodKeys(schema);
      expect(Object.keys(variant.properties).sort(), `${type} properties`).toEqual(zod.all.sort());
      expect([...variant.required].sort(), `${type} required`).toEqual(zod.required.sort());
    }
  });

  it("agrees with zod on the theme's closed sets", () => {
    const theme = root["properties"].theme;
    expect(theme.properties.typography.enum).toEqual(ThemeTokens.shape.typography.options);
    expect(theme.properties.mood.enum).toEqual(ThemeTokens.shape.mood.options);
    expect(theme.properties.density.enum).toEqual(ThemeTokens.shape.density.options);
    expect(theme.properties.cornerRadius.enum).toEqual(ThemeTokens.shape.cornerRadius.options);
    expect([...theme.required].sort()).toEqual(zodKeys(ThemeTokens).required.sort());
  });

  it("closes every object, as structured outputs require", () => {
    const nodes = [...objectNodes(root)];
    expect(nodes.length).toBeGreaterThan(8);
    for (const node of nodes) {
      expect(node["additionalProperties"], JSON.stringify(node).slice(0, 80)).toBe(false);
      expect(Array.isArray(node["required"])).toBe(true);
      // A required key with no property is a schema the API rejects.
      for (const key of node["required"] as string[]) {
        expect(Object.keys(node["properties"]), `required "${key}"`).toContain(key);
      }
    }
  });

  it("uses no constraint keyword structured outputs would silently drop", () => {
    // maxLength, minimum and maxItems are unsupported. The limits are real —
    // they live in schema.ts — so they are stated in prose and enforced by zod
    // instead of being written here and quietly ignored.
    const unsupported = ["maxLength", "minLength", "minimum", "maximum", "multipleOf", "minItems", "maxItems"];
    const serialised = JSON.stringify(root);
    for (const keyword of unsupported) {
      expect(serialised, keyword).not.toContain(`"${keyword}"`);
    }
  });

  it("describes every field it asks the model to fill", () => {
    // Descriptions are prompt surface, not documentation — the model reads
    // them while filling the field.
    for (const node of objectNodes(root)) {
      for (const [key, value] of Object.entries(node["properties"] as Node)) {
        // A discriminator is a fixed literal — there is no choice to describe.
        if ((value as Node)["const"] !== undefined) continue;
        expect(typeof (value as Node)["description"], `${key} description`).toBe("string");
      }
    }
  });
});
