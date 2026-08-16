/**
 * Labels, as they actually print.
 *
 * These are transcriptions of the shapes real ingredient lists take, not tidy
 * examples: the awkward capitalisation, the nested parentheses, the "Contains"
 * line in a different sentence case, and one label photographed badly enough
 * that part of it is unreadable — which is the case the whole safety design
 * exists for and the easiest one to forget to test.
 *
 * They are shared by the tests, the press script and the CLI so that the thing
 * being filmed for Phase 0 is the same thing the suite asserts on.
 */

import { ParsedLabel } from "@/lib/schema";

const clear = (text: string, contains: string[] = []) => ({
  text,
  legibility: "clear" as const,
  readConfidence: 0.99,
  contains,
});

/** A supermarket "protein" biscuit — the §7 demo shape: marketed clean, isn't. */
export const PROTEIN_BISCUIT = ParsedLabel.parse({
  category: "confectionery",
  productName: "Protein Crunch Bar, Chocolate Chip",
  ingredients: [
    clear("Protein Blend (Milk Protein Isolate, Whey Protein Concentrate, Soy Protein Isolate)", [
      "Milk Protein Isolate",
      "Whey Protein Concentrate",
      "Soy Protein Isolate",
    ]),
    clear("Soluble Corn Fiber"),
    clear("Chocolate Flavored Chips (Sugar, Palm Kernel Oil, Cocoa Powder, Soy Lecithin)", [
      "Sugar",
      "Palm Kernel Oil",
      "Cocoa Powder",
      "Soy Lecithin",
    ]),
    clear("Maltitol"),
    clear("Sunflower Oil"),
    clear("Maltodextrin"),
    clear("Natural Flavors"),
    clear("Sucralose"),
    clear("Salt"),
    clear("Tocopherols"),
  ],
  containsStatement: ["Milk", "Soy"],
  truncated: false,
  note: null,
});

/** A brightly coloured children's snack. The clean-label demo. */
export const RAINBOW_SNACK = ParsedLabel.parse({
  category: "snack",
  productName: "Rainbow Fruit Bites",
  ingredients: [
    clear("Corn Syrup"),
    clear("Sugar"),
    clear("Modified Corn Starch"),
    clear("Partially Hydrogenated Cottonseed Oil"),
    clear("Citric Acid"),
    clear("Natural and Artificial Flavors"),
    clear("Red 40"),
    clear("Yellow 5"),
    clear("Blue 1"),
    clear("Titanium Dioxide"),
    clear("Carnauba Wax"),
  ],
  containsStatement: [],
  truncated: false,
  note: null,
});

/**
 * A badly photographed label. The list runs off the edge and two ingredients
 * are smudged.
 *
 * This is the fixture that matters most: for an allergen profile it must
 * produce "cannot be checked from this photograph" rather than a clean result,
 * and the moment it stops doing that is the moment the product is dangerous.
 */
export const HALF_READ_LABEL = ParsedLabel.parse({
  category: "bakery",
  productName: null,
  ingredients: [
    clear("Enriched Flour"),
    clear("Water"),
    clear("Sugar"),
    { text: "Yeas?", legibility: "partial", readConfidence: 0.44, contains: [] },
    { text: "unreadable", legibility: "unreadable", readConfidence: 0.08, contains: [] },
    clear("Salt"),
  ],
  containsStatement: [],
  truncated: true,
  note: "The ingredient list continues around the fold of the packet.",
});

/** A supplement with a proprietary blend. §4 ICP 5. */
export const PRE_WORKOUT = ParsedLabel.parse({
  category: "supplement",
  productName: "Surge Pre-Workout, Blue Raspberry",
  ingredients: [
    clear("Proprietary Blend (Beta-Alanine, L-Citrulline, Caffeine Anhydrous, Taurine)", [
      "Beta-Alanine",
      "L-Citrulline",
      "Caffeine Anhydrous",
      "Taurine",
    ]),
    clear("Citric Acid"),
    clear("Natural and Artificial Flavors"),
    clear("Sucralose"),
    clear("Acesulfame Potassium"),
    clear("Blue 1"),
    clear("Silicon Dioxide"),
    clear("Magnesium Stearate"),
  ],
  containsStatement: [],
  truncated: false,
  note: null,
});

/** A short, genuinely plain label — the control. Not everything is 34/100. */
export const PLAIN_OAT_CRACKERS = ParsedLabel.parse({
  category: "bakery",
  productName: "Stoneground Oat Crackers",
  ingredients: [
    clear("Wholegrain Oats"),
    clear("Olive Oil"),
    clear("Sea Salt"),
  ],
  containsStatement: [],
  truncated: false,
  note: null,
});

export const FIXTURES = {
  "protein-biscuit": PROTEIN_BISCUIT,
  "rainbow-snack": RAINBOW_SNACK,
  "half-read": HALF_READ_LABEL,
  "pre-workout": PRE_WORKOUT,
  "oat-crackers": PLAIN_OAT_CRACKERS,
};

export type FixtureName = keyof typeof FIXTURES;
