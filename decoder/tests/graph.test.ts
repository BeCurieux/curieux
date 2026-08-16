/**
 * The ontology and the matcher, tested from both directions.
 *
 * Missing a match answers the wrong question silently. A wrong match inflates
 * §25's dispute rate, which the brief calls out as its own metric because
 * "a growth product with untrustworthy answers is not succeeding".
 */

import { describe, expect, it } from "vitest";
import { ALL_CLASSES, CLASS_TREE, KNOWLEDGE, ancestry, entriesInClass, isA, match, tokenise } from "@/lib/knowledge";
import { ALL_PRESETS } from "@/lib/rules/presets";

const ids = (text: string) => match(text).map((m) => m.entry.id);

describe("the class tree", () => {
  it("has no cycles and every parent exists", () => {
    for (const id of ALL_CLASSES) {
      const chain = ancestry(id);
      expect(new Set(chain).size, `${id} has a cycle`).toBe(chain.length);
      const parent = CLASS_TREE[id].parent;
      if (parent) expect(ALL_CLASSES).toContain(parent);
    }
  });

  it("keeps seed oils and fruit oils as siblings, never as ancestors", () => {
    // The single most damaging wrong match available: the whole seed-oil
    // audience is defined by this distinction, and a shared ancestor would
    // quietly unite them.
    expect(isA(["oil-fruit"], "oil-seed")).toBe(false);
    expect(isA(["oil-seed"], "oil-fruit")).toBe(false);
    // They do share `oil-vegetable`, which is correct and is why a rule
    // targeting that class is a different rule from one targeting seed oils.
    expect(isA(["oil-seed"], "oil-vegetable")).toBe(true);
    expect(isA(["oil-fruit"], "oil-vegetable")).toBe(true);
  });

  it("keeps allergen classes out of the provenance tree", () => {
    // A vegan rule and a milk-allergy rule both reach whey and must produce
    // completely different output, so they are different classes rather than
    // one class with two meanings.
    expect(isA(["allergen-milk"], "animal-derived")).toBe(false);
    expect(isA(["dairy"], "allergen-milk")).toBe(false);
  });

  it("lets one rule reach a whole family", () => {
    // The thing §15 calls the moat: "I'm vegan" is one rule, not forty.
    const animal = entriesInClass("animal-derived").map((e) => e.id);
    for (const id of ["milk", "egg", "fish", "shellfish", "gelatin", "carmine", "shellac", "tallow", "pork"]) {
      expect(animal, `animal-derived should reach ${id}`).toContain(id);
    }
  });

  it("reaches every class from at least one entry", () => {
    // An empty class is a rule somebody can write that silently never matches.
    const empty = ALL_CLASSES.filter((id) => entriesInClass(id).length === 0);
    expect(empty).toEqual([]);
  });

  it("has no preset rule that reaches nothing", () => {
    // The same failure one level up: the user sees their rule in the list and
    // never gets a finding from it.
    const dead: string[] = [];
    for (const preset of ALL_PRESETS) {
      for (const rule of preset.rules) {
        const reach =
          rule.target.kind === "class"
            ? entriesInClass(rule.target.value).length
            : KNOWLEDGE.filter((e) => e.id === rule.target.value).length;
        if (reach === 0) dead.push(`${preset.id}/${rule.id}`);
      }
    }
    expect(dead).toEqual([]);
  });
});

describe("the graph itself", () => {
  it("has unique ids", () => {
    const seen = new Set<string>();
    for (const entry of KNOWLEDGE) {
      expect(seen.has(entry.id), `duplicate id ${entry.id}`).toBe(false);
      seen.add(entry.id);
    }
  });

  it("has no name that normalises to nothing", () => {
    for (const entry of KNOWLEDGE) {
      for (const name of entry.names) {
        expect(tokenise(name).length, `${entry.id}: "${name}" normalises to nothing`).toBeGreaterThan(0);
      }
    }
  });

  it("dates every citation, so a stale one is visible", () => {
    for (const entry of KNOWLEDGE) {
      for (const e of entry.evidence) {
        expect(e.lastReviewed, `${entry.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.jurisdiction, `${entry.id}`).toBeTruthy();
      }
    }
  });

  it("scopes every uncertainty, or declares it total", () => {
    // `affects: []` means the contents are unknown altogether — an umbrella
    // term. Anything else has to name what it casts doubt on, or it clouds
    // rules it has nothing to do with.
    for (const entry of KNOWLEDGE) {
      for (const u of entry.uncertainty) {
        const isUmbrella = isA(entry.classes, "umbrella-term");
        if (!isUmbrella && u.kind === "umbrella-term") {
          throw new Error(`${entry.id}: umbrella uncertainty on a non-umbrella entry`);
        }
        for (const cls of u.affects) expect(ALL_CLASSES).toContain(cls);
      }
    }
  });
});

describe("what must be found", () => {
  const MUST: [string, string][] = [
    ["Peanuts", "peanut"],
    ["ROASTED PEANUTS", "peanut"],
    ["Arachis Oil", "peanut"],
    ["Ground Nuts", "peanut"],
    ["Almonds", "tree-nut"],
    ["Cashew Butter", "tree-nut"],
    ["Whey Protein Concentrate", "milk"],
    ["Sodium Caseinate", "milk"],
    ["Nonfat Dry Milk", "milk"],
    ["Ghee", "milk"],
    ["Albumen", "egg"],
    ["Semolina", "wheat"],
    ["Enriched Flour", "wheat"],
    ["Textured Vegetable Protein", "soy"],
    ["Tahini", "sesame"],
    ["Worcestershire Sauce", "fish"],
    ["Krill Oil", "shellfish"],
    ["Malt Extract", "barley"],
    ["Sodium Metabisulfite", "sulfites"],
    ["Cochineal Extract", "carmine"],
    ["Confectioner's Glaze", "shellac"],
    ["Mono- and Diglycerides", "mono-and-diglycerides"],
    ["FD&C Yellow No. 5", "yellow-5"],
    ["Tartrazine", "yellow-5"],
    ["E129", "red-40"],
    ["Partially Hydrogenated Soybean Oil", "partially-hydrogenated"],
    ["High Fructose Corn Syrup", "hfcs"],
    ["Chicory Root Fiber", "inulin"],
    ["Organic Sunflower Oil", "seed-oil"],
    ["Expeller Pressed Canola Oil", "seed-oil"],
    ["Natural Flavors", "natural-flavors"],
    ["Proprietary Blend", "proprietary-blend"],
    ["Cultured Celery Extract", "nitrite"],
    ["Guarana Extract", "caffeine"],
    ["Swordfish", "high-mercury-fish"],
    ["Lard", "pork"],
    ["Beef Tallow", "tallow"],
  ];

  for (const [label, id] of MUST) {
    it(`finds ${id} in "${label}"`, () => {
      expect(ids(label)).toContain(id);
    });
  }
});

describe("what must not be found", () => {
  /** Every line is a dispute somebody would otherwise file. */
  const MUST_NOT: [string, string][] = [
    ["Coconut Milk", "milk"],
    ["Oat Milk", "milk"],
    ["Almond Milk", "milk"],
    ["Cocoa Butter", "milk"],
    ["Shea Butter", "milk"],
    ["Peanut Butter", "milk"],
    ["Milk Thistle Extract", "milk"],
    ["Cauliflower", "wheat"],
    ["Buckwheat Flour", "wheat"],
    ["Rice Flour", "wheat"],
    ["Nutmeg", "tree-nut"],
    ["Water Chestnuts", "tree-nut"],
    ["Extra Virgin Olive Oil", "seed-oil"],
    ["Avocado Oil", "seed-oil"],
    ["Coconut Oil", "seed-oil"],
    ["Palm Oil", "seed-oil"],
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
    expect(ids("Milkweed Extract")).not.toContain("milk");
    expect(ids("Eggplant")).not.toContain("egg");
  });

  it("classes the fruit oils away from the seed-oil rule", () => {
    // The class does the work, not an exception list: coconut, olive, avocado
    // and palm are `oil-fruit`, so a seed-oil rule never reaches them.
    for (const id of ["coconut", "olive-oil", "avocado-oil", "palm-oil"]) {
      const entry = KNOWLEDGE.find((e) => e.id === id)!;
      expect(isA(entry.classes, "oil-seed"), id).toBe(false);
    }
  });
});

describe("multiple truths about one ingredient", () => {
  it("reads soy lecithin as both the emulsifier and the soy", () => {
    expect(ids("Soy Lecithin").sort()).toEqual(["lecithin", "soy"]);
  });

  it("classes coconut as a tree nut and as a fruit oil at once", () => {
    // US labelling counts it as a tree nut; it is not a seed oil. Both are true
    // and the two rules that care must get different answers.
    const entry = KNOWLEDGE.find((e) => e.id === "coconut")!;
    expect(isA(entry.classes, "allergen-tree-nut")).toBe(true);
    expect(isA(entry.classes, "oil-fruit")).toBe(true);
    expect(isA(entry.classes, "oil-seed")).toBe(false);
  });
});
