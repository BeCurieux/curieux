/**
 * The matcher, tested from both directions.
 *
 * Missing a match on an allergen is §10.1's harmed child. A wrong match is §6's
 * confidently-wrong screenshot. Both are the product dying, so both get a
 * table.
 */

import { describe, expect, it } from "vitest";
import { KNOWLEDGE, match, tokenise } from "@/lib/knowledge";

const ids = (text: string) => match(text).map((m) => m.entry.id);

describe("the knowledge base itself", () => {
  it("has unique ids", () => {
    const seen = new Set<string>();
    for (const entry of KNOWLEDGE) {
      expect(seen.has(entry.id), `duplicate id ${entry.id}`).toBe(false);
      seen.add(entry.id);
    }
  });

  it("has no entry whose name list is empty after normalisation", () => {
    for (const entry of KNOWLEDGE) {
      for (const name of entry.names) {
        expect(tokenise(name).length, `${entry.id}: "${name}" normalises to nothing`).toBeGreaterThan(0);
      }
    }
  });

  it("covers every launch niche", () => {
    // §4's five ICPs. A knowledge base that only knows about additives is an
    // app for one of the five creator communities, not five.
    const kinds = new Set(KNOWLEDGE.flatMap((e) => e.concerns.map((c) => c.axis.kind)));
    expect([...kinds].sort()).toEqual(["allergen", "avoidance", "intolerance", "life-stage", "protocol"]);
  });
});

describe("what must be found", () => {
  // The failure that ends the company is on the left of this table.
  const MUST: [string, string][] = [
    ["Peanuts", "peanut"],
    ["ROASTED PEANUTS", "peanut"],
    ["Peanut Oil", "peanut"],
    ["Arachis Oil", "peanut"],
    ["Ground Nuts", "peanut"],
    ["Almonds", "tree-nut"],
    ["Almond Flour", "tree-nut"],
    ["Cashew Butter", "tree-nut"],
    ["Whey Protein Concentrate", "milk"],
    ["Sodium Caseinate", "milk"],
    ["Nonfat Dry Milk", "milk"],
    ["Ghee", "milk"],
    ["Albumen", "egg"],
    ["Ovalbumin", "egg"],
    ["Semolina", "wheat"],
    ["Enriched Flour", "wheat"],
    ["Vital Wheat Gluten", "wheat"],
    ["Textured Vegetable Protein", "soy"],
    ["Soy Lecithin", "soy"],
    ["Tahini", "sesame"],
    ["Anchovies", "fish"],
    ["Worcestershire Sauce", "fish"],
    ["Krill Oil", "shellfish"],
    ["Malt Extract", "barley"],
    ["Sodium Metabisulfite", "sulfites"],
    ["Carmine", "carmine"],
    ["Cochineal Extract", "carmine"],
    ["Confectioner's Glaze", "shellac"],
    ["Mono- and Diglycerides", "mono-and-diglycerides"],
    ["FD&C Yellow No. 5", "yellow-5"],
    ["Tartrazine", "yellow-5"],
    ["E129", "red-40"],
    ["Titanium Dioxide", "titanium-dioxide"],
    ["Partially Hydrogenated Soybean Oil", "partially-hydrogenated"],
    ["High Fructose Corn Syrup", "hfcs"],
    ["Chicory Root Fiber", "inulin"],
    ["Acesulfame Potassium", "acesulfame-k"],
    ["Organic Sunflower Oil", "seed-oil"],
    ["Expeller Pressed Canola Oil", "seed-oil"],
    ["Natural Flavors", "natural-flavors"],
    ["Proprietary Blend", "proprietary-blend"],
    ["Cultured Celery Extract", "nitrite"],
    ["Guarana Extract", "caffeine"],
    ["Swordfish", "high-mercury-fish"],
    ["Sorbitol", "sorbitol"],
    ["Gelatine", "gelatin"],
  ];

  for (const [label, id] of MUST) {
    it(`finds ${id} in "${label}"`, () => {
      expect(ids(label)).toContain(id);
    });
  }
});

describe("what must not be found", () => {
  /**
   * Every line is a screenshot somebody would otherwise post.
   *
   * A milk allergy that reds coconut milk, oat milk and cocoa butter is an app
   * that reds most of the plant-based aisle — and the person who notices is a
   * creator with an audience and a reason to make a video about it.
   */
  const MUST_NOT: [string, string][] = [
    ["Coconut Milk", "milk"],
    ["Oat Milk", "milk"],
    ["Almond Milk", "milk"],
    ["Soy Milk", "milk"],
    ["Cocoa Butter", "milk"],
    ["Shea Butter", "milk"],
    ["Peanut Butter", "milk"],
    ["Apple Butter", "milk"],
    ["Milk Thistle Extract", "milk"],
    ["Butterfly Pea Flower", "milk"],
    ["Cauliflower", "wheat"],
    ["Buckwheat Flour", "wheat"],
    ["Rice Flour", "wheat"],
    ["Almond Flour", "wheat"],
    ["Nutmeg", "tree-nut"],
    ["Water Chestnuts", "tree-nut"],
    ["Extra Virgin Olive Oil", "seed-oil"],
    ["Avocado Oil", "seed-oil"],
    ["Coconut Oil", "seed-oil"],
    ["Sesame Oil", "seed-oil"],
    ["Non-Alcoholic Beer Flavor", "alcohol"],
    ["Sugar Alcohols", "alcohol"],
    ["Protein Blend", "proprietary-blend"],
    ["Amino Acid Blend", "proprietary-blend"],
  ];

  for (const [label, id] of MUST_NOT) {
    it(`does not read "${label}" as ${id}`, () => {
      expect(ids(label)).not.toContain(id);
    });
  }

  it("matches nothing in ordinary store-cupboard words", () => {
    for (const plain of ["Water", "Sea Salt", "Black Pepper", "Rolled Oats", "Baking Soda", "Citric Acid"]) {
      expect(ids(plain), `${plain} should not match anything`).toEqual([]);
    }
  });

  it("does not match a word inside a longer word", () => {
    // Substring matching is the cheapest way to generate a wrong answer, so the
    // matcher is whole-token. "Milkweed" is not milk.
    expect(ids("Milkweed Extract")).not.toContain("milk");
    expect(ids("Eggplant")).not.toContain("egg");
  });
});

describe("multiple truths about one ingredient", () => {
  it("reads soy lecithin as both the lecithin and the soy", () => {
    // Both matches are correct and the matcher must lose neither: the lecithin
    // entry carries the seed-oil nuance, the soy entry carries the allergen.
    expect(ids("Soy Lecithin").sort()).toEqual(["soy", "sunflower-lecithin"]);
  });

  it("reads coconut as a tree nut, because US labelling does", () => {
    expect(ids("Coconut Flour")).toContain("coconut");
    const entry = KNOWLEDGE.find((e) => e.id === "coconut")!;
    expect(entry.concerns.some((c) => c.axis.kind === "allergen" && c.axis.value === "tree-nut")).toBe(true);
  });
});
