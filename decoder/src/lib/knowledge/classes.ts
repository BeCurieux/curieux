/**
 * The ontology, as a tree.
 *
 * BRIEF.md §14 asks for relationships:
 *
 * > sunflower oil → vegetable oil → sunflower-derived → seed oil
 * > gelatin → animal-derived → potential species uncertainty
 *
 * Those arrows are these parent links. A rule targeting `oil-seed` matches
 * sunflower oil without naming it; a rule targeting `animal-derived` matches
 * gelatin, carmine, whey, shellac and lanolin-derived D3 without a list.
 *
 * This is the part §15 calls the moat and §31 says competitors cannot copy by
 * adding a camera: a new sweetener classified once inherits every rule anybody
 * has ever written about sweeteners, including the custom ones. The entry count
 * grows linearly; the number of questions the graph can answer does not.
 *
 * ## Why the tree is shallow and boring
 *
 * Every extra level is a chance for a rule to match something the user did not
 * mean. `oil-fruit` (olive, avocado, coconut, palm) exists as a sibling of
 * `oil-seed` rather than as a child, because the entire seed-oil audience is
 * defined by that distinction and a shared parent that quietly united them
 * would be the single most damaging wrong match this product could make.
 */

import type { ClassId } from "@/lib/schema";

type ClassNode = {
  /** What the user sees when a rule targets this class. */
  label: string;
  parent: ClassId | null;
};

export const CLASS_TREE: Record<ClassId, ClassNode> = {
  /* ---- Provenance -------------------------------------------------------- */
  "animal-derived": { label: "Animal-derived ingredients", parent: null },
  dairy: { label: "Dairy", parent: "animal-derived" },
  egg: { label: "Egg", parent: "animal-derived" },
  fish: { label: "Fish", parent: "animal-derived" },
  shellfish: { label: "Shellfish", parent: "animal-derived" },
  meat: { label: "Meat", parent: "animal-derived" },
  "pork-derived": { label: "Pork-derived ingredients", parent: "meat" },
  "insect-derived": { label: "Insect-derived ingredients", parent: "animal-derived" },
  "plant-derived": { label: "Plant-derived ingredients", parent: null },

  /* ---- Allergens ---------------------------------------------------------
   * Separate from provenance on purpose. A vegan rule and a milk-allergy rule
   * both match whey, but they must produce completely different output — one is
   * a preference and one is the never-certify path in §17 Rule 1 — so they are
   * different classes rather than one class with two meanings.
   */
  "allergen-milk": { label: "Milk", parent: null },
  "allergen-egg": { label: "Egg", parent: null },
  "allergen-fish": { label: "Fish", parent: null },
  "allergen-shellfish": { label: "Shellfish", parent: null },
  "allergen-tree-nut": { label: "Tree nuts", parent: null },
  "allergen-peanut": { label: "Peanuts", parent: null },
  "allergen-wheat": { label: "Wheat", parent: null },
  "allergen-soy": { label: "Soy", parent: null },
  "allergen-sesame": { label: "Sesame", parent: null },

  /* ---- Fats and oils ----------------------------------------------------- */
  oil: { label: "Oils", parent: null },
  "oil-vegetable": { label: "Vegetable oils", parent: "oil" },
  // Siblings, never parent and child. See the note at the top of this file.
  "oil-seed": { label: "Seed oils", parent: "oil-vegetable" },
  "oil-fruit": { label: "Fruit oils (olive, avocado, coconut)", parent: "oil-vegetable" },
  "oil-hydrogenated": { label: "Hydrogenated oils", parent: "oil" },
  "fat-animal": { label: "Animal fats", parent: "oil" },

  /* ---- Sweetness --------------------------------------------------------- */
  sweetener: { label: "Sweeteners", parent: null },
  "sugar-added": { label: "Added sugars", parent: "sweetener" },
  "sweetener-artificial": { label: "Artificial sweeteners", parent: "sweetener" },
  "sweetener-sugar-alcohol": { label: "Sugar alcohols", parent: "sweetener" },
  "sweetener-plant": { label: "Plant sweeteners (stevia, monk fruit)", parent: "sweetener" },

  /* ---- Additives by function --------------------------------------------- */
  additive: { label: "Additives", parent: null },
  emulsifier: { label: "Emulsifiers", parent: "additive" },
  preservative: { label: "Preservatives", parent: "additive" },
  "antioxidant-synthetic": { label: "Synthetic antioxidants", parent: "preservative" },
  colour: { label: "Colours", parent: "additive" },
  "colour-synthetic": { label: "Synthetic colours", parent: "colour" },
  "colour-natural": { label: "Naturally derived colours", parent: "colour" },
  thickener: { label: "Thickeners and gums", parent: "additive" },
  "flavour-enhancer": { label: "Flavour enhancers", parent: "additive" },
  "flour-treatment": { label: "Flour treatments", parent: "additive" },
  "anti-caking": { label: "Anti-caking agents", parent: "additive" },

  /* ---- Everything else rules get written about --------------------------- */
  "caffeine-source": { label: "Caffeine", parent: null },
  grain: { label: "Grains", parent: null },
  "gluten-grain": { label: "Gluten grains", parent: "grain" },
  "starch-refined": { label: "Refined starches", parent: null },
  "nitrite-source": { label: "Nitrites", parent: "preservative" },
  "sulfite-source": { label: "Sulfites", parent: "preservative" },
  "high-fodmap": { label: "High-FODMAP ingredients", parent: null },
  alcohol: { label: "Alcohol", parent: null },
  "umbrella-term": { label: "Umbrella terms", parent: null },
};

/**
 * A class and every class above it.
 *
 * Sunflower oil is classed `oil-seed`; this returns
 * `[oil-seed, oil-vegetable, oil]`, so a rule about any of the three matches.
 */
export function ancestry(id: ClassId): ClassId[] {
  const chain: ClassId[] = [];
  let cursor: ClassId | null = id;
  // Bounded by the tree's depth; the cycle check below is the real guard.
  while (cursor && !chain.includes(cursor)) {
    chain.push(cursor);
    cursor = CLASS_TREE[cursor].parent;
  }
  return chain;
}

/** Does an entry with these classes fall under `target`? */
export function isA(classes: ClassId[], target: ClassId): boolean {
  return classes.some((id) => ancestry(id).includes(target));
}

export function classLabel(id: ClassId): string {
  return CLASS_TREE[id].label;
}

/** Every class, for the rule-authoring vocabulary and the coverage report. */
export const ALL_CLASSES = Object.keys(CLASS_TREE) as ClassId[];
