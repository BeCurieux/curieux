/**
 * Labels, as they actually print.
 *
 * Transcriptions of the shapes real ingredient lists take rather than tidy
 * examples: the awkward capitalisation, the nested parentheses, the "Contains"
 * line in a different sentence case, and two labels photographed badly enough
 * that part of them is unreadable — the case BRIEF.md §8 Step 2 and §17 Rule 2
 * exist for, and the easiest one to forget to test.
 *
 * Shared by the tests, the press script and the CLI, so the thing being filmed
 * for Phase 0 is the same thing the suite asserts on.
 */

import { ParsedLabel } from "@/lib/schema";

const clear = (text: string, contains: string[] = []) => ({
  text,
  legibility: "clear" as const,
  readConfidence: 0.99,
  contains,
});

/**
 * §4's demonstration product.
 *
 * Chosen so that USER A and USER B get genuinely different answers from it: it
 * has an animal-derived protein and an artificial sweetener (USER A's rules),
 * and a seed oil, added sugar and two emulsifiers (USER B's). Same packet, two
 * verdicts — which §4 says should appear throughout the product and the
 * marketing, so it had better be a real label rather than a contrived one.
 */
export const PROTEIN_BAR = ParsedLabel.parse({
  category: "confectionery",
  productName: "Protein Crunch Bar, Chocolate Chip",
  ingredients: [
    clear("Protein Blend (Milk Protein Isolate, Whey Protein Concentrate, Soy Protein Isolate)", [
      "Milk Protein Isolate",
      "Whey Protein Concentrate",
      "Soy Protein Isolate",
    ]),
    clear("Soluble Corn Fiber"),
    clear("Chocolate Flavored Chips (Cane Sugar, Palm Kernel Oil, Cocoa Powder, Soy Lecithin)", [
      "Cane Sugar",
      "Palm Kernel Oil",
      "Cocoa Powder",
      "Soy Lecithin",
    ]),
    clear("Maltitol"),
    clear("Sunflower Oil"),
    clear("Maltodextrin"),
    clear("Natural Flavors"),
    clear("Sucralose"),
    clear("Mono- and Diglycerides"),
    clear("Sea Salt"),
    clear("Tocopherols"),
  ],
  containsStatement: ["Milk", "Soy"],
  truncated: false,
  note: null,
});

/** §12 Creative 4 — the brightly coloured thing marketed at children. */
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
 * §9's Product B — the competitor for Compare mode.
 *
 * Deliberately a plausible rival to the protein bar rather than an obviously
 * worse one: it wins on some rules and loses on others, which is what makes
 * the comparison worth running and the video worth watching.
 */
export const RIVAL_BAR = ParsedLabel.parse({
  category: "confectionery",
  productName: "Clean Crunch Bar, Cocoa",
  ingredients: [
    clear("Dates"),
    clear("Almonds"),
    clear("Pea Protein Isolate"),
    clear("Cocoa Powder"),
    clear("Chicory Root Fiber"),
    clear("Coconut Oil"),
    clear("Sea Salt"),
    clear("Natural Flavors"),
  ],
  containsStatement: ["Almonds"],
  truncated: false,
  note: null,
});

/**
 * A badly photographed label. The list runs off a fold and two ingredients are
 * smudged.
 *
 * The most important fixture in the file: §8 Step 2 says never silently guess,
 * and this is the label that proves the product would rather say nothing than
 * say something confident and wrong.
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

/** §29 Phase 4 territory, reachable today because the graph already holds it. */
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

/** The control. §17 Rule 5 — not everything is alarming, and the product must be able to say so. */
export const OAT_CRACKERS = ParsedLabel.parse({
  category: "bakery",
  productName: "Stoneground Oat Crackers",
  ingredients: [clear("Wholegrain Oats"), clear("Olive Oil"), clear("Sea Salt")],
  containsStatement: [],
  truncated: false,
  note: null,
});

export const FIXTURES = {
  "protein-bar": PROTEIN_BAR,
  "rival-bar": RIVAL_BAR,
  "rainbow-snack": RAINBOW_SNACK,
  "half-read": HALF_READ_LABEL,
  "pre-workout": PRE_WORKOUT,
  "oat-crackers": OAT_CRACKERS,
};

export type FixtureName = keyof typeof FIXTURES;
