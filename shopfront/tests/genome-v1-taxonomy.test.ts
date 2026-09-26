import { describe, expect, it } from "vitest";
import {
  allValueIds,
  DIMENSIONS,
  type DimensionDef,
  MODEL_DIMENSIONS,
  permittedValues,
  TAXONOMY_VERSION,
  UNKNOWN,
  valueId,
} from "@/lib/genome/v1/taxonomy";
import { CLASSIFICATION_SCHEMA, parseClassification } from "@/lib/genome/v1/classify-schema";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/genome/v1/prompt";
import { PRICE_BAND_REFERENCES } from "@/lib/genome/v1/price-bands";

/**
 * The released v1 IDs, as a literal. HANDOFF §6.1 rule 1: stable value IDs,
 * never renamed in place, changes ship as a new version. If this fails, the
 * change belongs in a `v2` taxonomy, not in an edit to this list.
 */
const RELEASED_V1: Record<string, string[]> = {
  occasion_fit: ["everyday", "mothers_day", "fathers_day", "christmas_holiday", "valentines", "birthday", "summer_travel", "unknown"],
  gift_role: ["practical", "indulgent", "novelty", "not_giftable", "unknown"],
  use_context: ["home", "outdoor", "water_coastal", "travel", "work", "social_evening", "fitness", "personal_care", "unknown"],
  seasonality: ["warm_weather", "cold_weather", "all_season", "unknown"],
  audience_fit: ["women", "men", "unisex_adult", "kids", "baby", "household", "unknown"],
  item_type: ["core_item", "accessory", "consumable", "set_bundle", "unknown"],
  style_register: ["casual", "elevated_casual", "formal", "playful", "functional", "unknown"],
  price_band: ["budget", "mid", "premium", "luxury", "unknown"],
  price_position: ["entry", "mid", "premium", "unknown"],
  assortment_role: ["hero", "supporting", "add_on", "neutral", "unknown"],
  inventory_depth: ["low", "normal", "high", "unknown"],
  margin_band: ["low", "mid", "high", "unknown"],
};

describe("genome taxonomy v1", () => {
  it("is exactly the released value IDs — nothing renamed, removed or added", () => {
    const expected = Object.entries(RELEASED_V1).flatMap(([dim, values]) => values.map((v) => `${dim}:${v}`));
    expect(allValueIds()).toEqual(expected);
    expect(TAXONOMY_VERSION).toBe("genome_taxonomy_v1");
  });

  it("allows unknown on every enumerable dimension", () => {
    for (const d of DIMENSIONS) {
      if ("productRefs" in d && d.productRefs) continue;
      expect(permittedValues(d.id)).toContain(UNKNOWN);
    }
  });

  it("has the shape the handoff specifies", () => {
    const byId: Record<string, DimensionDef> = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));
    expect(byId.use_context!.cardinality).toBe("multi");
    expect(byId.use_context!.maxLabels).toBe(3);
    expect(byId.style_register!.crossMerchantExcluded).toBe("provisional");
    expect(byId.margin_band!.crossMerchantExcluded).toBe("never");
    expect(MODEL_DIMENSIONS).toEqual(["occasion_fit", "gift_role", "use_context", "seasonality", "audience_fit", "item_type", "style_register"]);
    expect(valueId("gift_role", "practical")).toBe("gift_role:practical");
  });
});

describe("the classifier contract", () => {
  it("constrains every model dimension to exactly the taxonomy's values", () => {
    const props = CLASSIFICATION_SCHEMA.properties as Record<string, { enum?: string[]; items?: { enum: string[] } }>;
    for (const dim of MODEL_DIMENSIONS) {
      const schema = props[dim]!;
      expect(schema.enum ?? schema.items!.enum).toEqual(permittedValues(dim));
    }
    // No free text: nothing the model could put a self-reported score or a
    // rationale into.
    for (const [key, schema] of Object.entries(props)) {
      const s = schema as { type: string; enum?: unknown; items?: { enum?: unknown } };
      expect(s.enum ?? s.items?.enum, key).toBeDefined();
    }
  });

  const good = {
    parent_category: "apparel",
    occasion_fit: ["fathers_day", "summer_travel"],
    gift_role: "practical",
    use_context: ["water_coastal", "travel", "outdoor", "home"],
    seasonality: "warm_weather",
    audience_fit: ["men"],
    item_type: "core_item",
    style_register: "elevated_casual",
  };

  it("parses a valid run and caps use_context at three, keeping the first", () => {
    const parsed = parseClassification(good);
    expect(parsed.answers.use_context).toEqual(["water_coastal", "travel", "outdoor"]);
    expect(parsed.parent_category).toBe("apparel");
  });

  it("rejects a value outside the taxonomy rather than repairing it", () => {
    expect(() => parseClassification({ ...good, gift_role: "sentimental" })).toThrow();
    expect(() => parseClassification({ ...good, confidence: 0.9 })).toThrow();
  });

  it("reads an empty multi-label answer as unknown", () => {
    expect(parseClassification({ ...good, audience_fit: [] }).answers.audience_fit).toEqual([UNKNOWN]);
  });

  it("puts the labellers' definitions in the prompt, word for word, and fingerprints it", () => {
    expect(SYSTEM_PROMPT).toContain("Colour never implies audience or use context");
    const practical = DIMENSIONS.find((d) => d.id === "gift_role")!.values.find((v) => v.id === "practical")!;
    expect(SYSTEM_PROMPT).toContain(practical.definition);
    expect(PROMPT_VERSION).toMatch(/^v1-[0-9a-f]{32}$/);
  });
});

describe("price band references", () => {
  it("have ascending ceilings for every row", () => {
    expect(PRICE_BAND_REFERENCES.length).toBeGreaterThan(0);
    for (const r of PRICE_BAND_REFERENCES) {
      expect(r.budgetMax).toBeLessThan(r.midMax);
      expect(r.midMax).toBeLessThan(r.premiumMax);
    }
  });
});
