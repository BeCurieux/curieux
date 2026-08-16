/**
 * The presets from BRIEF.md §6, and the rule sets the Phase 0 films need.
 *
 * A preset is a starting point, not a profile: §6 says the rules are editable
 * at any time, and §28 makes "users create increasingly sophisticated custom
 * rules" a scale signal. So these are ordinary `Rule` objects with
 * `origin: "preset"` — nothing about them is privileged, and a user can delete
 * any of them or bury one under a `never-flag`.
 *
 * Every `because` is written in the second person and attributes the decision
 * to the user. That is not a tone preference: §17 Rule 4 removes the app's
 * standing to have an opinion, and the schema rejects a rule whose sentence
 * does not say whose opinion it is.
 */

import { RuleSet, type RuleInput, type RuleSetInput } from "@/lib/schema";

const avoidClass = (id: string, cls: string, label: string, because: string): RuleInput => ({
  id,
  kind: "avoid",
  target: { kind: "class", value: cls as never },
  label,
  because,
  origin: "preset",
});

const flagClass = (id: string, cls: string, label: string, because: string): RuleInput => ({
  id,
  kind: "flag",
  target: { kind: "class", value: cls as never },
  label,
  because,
  origin: "preset",
});

/* -------------------------------------------------------------------------- */
/* Reusable rules                                                              */
/* -------------------------------------------------------------------------- */

const NO_ANIMAL = avoidClass(
  "no-animal-derived",
  "animal-derived",
  "Animal-derived ingredients",
  "You asked us to avoid animal-derived ingredients.",
);
const NO_ARTIFICIAL_SWEETENERS = avoidClass(
  "no-artificial-sweeteners",
  "sweetener-artificial",
  "Artificial sweeteners",
  "You asked us to avoid artificial sweeteners.",
);
const NO_SEED_OILS = avoidClass(
  "no-seed-oils",
  "oil-seed",
  "Seed oils",
  "You asked us to avoid seed oils.",
);
const NO_ADDED_SUGAR = avoidClass(
  "no-added-sugar",
  "sugar-added",
  "Added sugars",
  "You asked us to avoid added sugars.",
);
const NO_SYNTHETIC_COLOURS = avoidClass(
  "no-synthetic-colours",
  "colour-synthetic",
  "Synthetic colours",
  "You asked us to avoid synthetic colours.",
);
const NO_SYNTHETIC_PRESERVATIVES = avoidClass(
  "no-synthetic-preservatives",
  "antioxidant-synthetic",
  "Synthetic antioxidants and preservatives",
  "You asked us to avoid synthetic preservatives.",
);
const NO_EMULSIFIERS = avoidClass(
  "no-emulsifiers",
  "emulsifier",
  "Emulsifiers",
  "You asked us to avoid emulsifiers.",
);
// No umbrella-term rule here on purpose. An umbrella term limits every rule at
// once, so the engine surfaces it whenever the user has any rules at all — see
// `evaluate.ts`. A preset rule for it would be redundant and would imply the
// check is optional.

/* -------------------------------------------------------------------------- */
/* The presets                                                                 */
/* -------------------------------------------------------------------------- */

export const PRESETS: Record<string, RuleSetInput> = {
  /**
   * §6's first named preset, and §5's ICP 1 — the launch segment. Not a health
   * claim and not a diet: a list of the additive classes this audience already
   * reads labels for.
   */
  "simple-ingredients": {
    id: "simple-ingredients",
    label: "Simple ingredients",
    rules: [
      NO_SYNTHETIC_COLOURS,
      NO_SYNTHETIC_PRESERVATIVES,
      NO_ARTIFICIAL_SWEETENERS,
      flagClass("flag-emulsifiers", "emulsifier", "Emulsifiers", "You asked us to flag emulsifiers."),
      flagClass(
        "flag-refined-starch",
        "starch-refined",
        "Refined starches",
        "You asked us to flag refined starches and fillers.",
      ),
    ],
  },

  /** §5 ICP 2, and §23's vegan creator line: "catches the weird ones". */
  vegan: {
    id: "vegan",
    label: "Vegan",
    // One rule, and it is enough. Mono- and diglycerides, L-cysteine, D3 and
    // stearates are not classed animal-derived, because they may not be — the
    // engine still reaches them through their declared uncertainty and reports
    // "we can't tell from this label". A blunt "flag every additive" rule used
    // to stand in for that and flagged silicon dioxide at the same time.
    rules: [NO_ANIMAL],
  },

  vegetarian: {
    id: "vegetarian",
    label: "Vegetarian",
    rules: [
      avoidClass("no-meat", "meat", "Meat", "You asked us to avoid meat."),
      avoidClass("no-fish", "fish", "Fish", "You asked us to avoid fish."),
      avoidClass("no-shellfish", "shellfish", "Shellfish", "You asked us to avoid shellfish."),
      flagClass(
        "flag-insect",
        "insect-derived",
        "Insect-derived ingredients",
        "You asked us to flag insect-derived ingredients, since vegetarian definitions differ on them.",
      ),
    ],
  },

  /** §6's "No artificial sweeteners" preset. */
  "no-artificial-sweeteners": {
    id: "no-artificial-sweeteners",
    label: "No artificial sweeteners",
    rules: [
      NO_ARTIFICIAL_SWEETENERS,
      flagClass(
        "flag-sugar-alcohols",
        "sweetener-sugar-alcohol",
        "Sugar alcohols",
        "You asked us to flag sugar alcohols.",
      ),
    ],
  },

  /** §6's "Low added sugar" preset, and §23's low-sugar creator line. */
  "low-added-sugar": {
    id: "low-added-sugar",
    label: "Low added sugar",
    rules: [
      NO_ADDED_SUGAR,
      flagClass(
        "flag-refined-starch-sugar",
        "starch-refined",
        "Refined starches",
        "You asked us to flag refined starches, which don't appear as sugar on the label.",
      ),
    ],
  },

  /** §6's "Avoid seed oils" preset. */
  "avoid-seed-oils": {
    id: "avoid-seed-oils",
    label: "Avoid seed oils",
    rules: [
      NO_SEED_OILS,
      avoidClass(
        "no-hydrogenated",
        "oil-hydrogenated",
        "Hydrogenated oils",
        "You asked us to avoid hydrogenated oils.",
      ),
    ],
  },

  /**
   * §5 ICP 4. "Worth checking", never "unsafe during pregnancy" — every rule
   * here is a `flag`, and there is deliberately not a single `avoid` in the
   * set, because a blocker is the app reaching a conclusion that §5 says
   * belongs to a clinician.
   */
  pregnancy: {
    id: "pregnancy",
    label: "Pregnancy — things to double-check",
    rules: [
      flagClass(
        "flag-alcohol-pregnancy",
        "alcohol",
        "Alcohol",
        "You asked us to flag alcohol so you can double-check it.",
      ),
      flagClass(
        "flag-caffeine-pregnancy",
        "caffeine-source",
        "Caffeine",
        "You asked us to flag caffeine so you can double-check it.",
      ),
      {
        id: "flag-unpasteurised",
        kind: "flag",
        target: { kind: "ingredient", value: "unpasteurised-dairy" },
        label: "Unpasteurised dairy",
        because: "You asked us to flag unpasteurised dairy so you can check the packaging.",
        origin: "preset",
      },
      {
        id: "flag-high-mercury-fish",
        kind: "flag",
        target: { kind: "ingredient", value: "high-mercury-fish" },
        label: "Fish on the avoid list",
        because: "You asked us to flag the fish on the FDA and EPA avoid list so you can double-check.",
        origin: "preset",
      },
    ],
  },

  /** §5 ICP 3. */
  keto: {
    id: "keto",
    label: "Keto",
    rules: [
      NO_ADDED_SUGAR,
      avoidClass("no-refined-starch", "starch-refined", "Refined starches", "You asked us to avoid refined starches."),
      avoidClass("no-grain", "grain", "Grains", "You asked us to avoid grains."),
    ],
  },

  "low-fodmap": {
    id: "low-fodmap",
    label: "Low-FODMAP",
    rules: [
      avoidClass(
        "no-high-fodmap",
        "high-fodmap",
        "High-FODMAP ingredients",
        "You asked us to avoid high-FODMAP ingredients.",
      ),
    ],
  },

  "gluten-free": {
    id: "gluten-free",
    label: "Gluten-free preference",
    rules: [
      avoidClass("no-gluten-grain", "gluten-grain", "Gluten grains", "You asked us to avoid gluten grains."),
    ],
  },

  /**
   * §5 ICP 5, and the one preset whose rules carry `allergen: true`.
   *
   * That marker moves every finding into the never-certify vocabulary and out
   * of the match score entirely — see `verdict/language.ts`. §5 is explicit
   * that this is not the V1 acquisition wedge, so it exists here to be correct
   * rather than to be marketed.
   */
  "peanut-listed": {
    id: "peanut-listed",
    label: "Watching for peanuts",
    rules: [
      {
        id: "allergen-peanut",
        kind: "avoid",
        target: { kind: "class", value: "allergen-peanut" },
        label: "Peanuts",
        because: "You asked us to watch for peanuts on labels.",
        origin: "preset",
        allergen: true,
      },
      {
        id: "allergen-tree-nut",
        kind: "avoid",
        target: { kind: "class", value: "allergen-tree-nut" },
        label: "Tree nuts",
        because: "You asked us to watch for tree nuts on labels.",
        origin: "preset",
        allergen: true,
      },
    ],
  },

  /**
   * §4's USER A, verbatim: vegan, avoids artificial sweeteners, doesn't care
   * about seed oils. The `never-flag` is the whole point of the example.
   */
  "brief-user-a": {
    id: "brief-user-a",
    label: "Vegan, no artificial sweeteners",
    rules: [
      NO_ANIMAL,
      NO_ARTIFICIAL_SWEETENERS,
      {
        id: "dont-flag-seed-oils",
        kind: "never-flag",
        target: { kind: "class", value: "oil-seed" },
        label: "Seed oils",
        because: "You told us not to flag seed oils.",
        origin: "custom",
      },
    ],
  },

  /** §4's USER B: seed oils, added sugar, no emulsifiers. Same product, different verdict. */
  "brief-user-b": {
    id: "brief-user-b",
    label: "No seed oils, sugar or emulsifiers",
    rules: [NO_SEED_OILS, NO_ADDED_SUGAR, NO_EMULSIFIERS],
  },

  /**
   * Nobody's real rules. Used to show what the engine says when it has been
   * told nothing — which should be almost nothing, because §4's whole argument
   * is that a verdict without rules is not a verdict.
   */
  none: { id: "none", label: "No rules set yet", rules: [] },
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function presetByName(name: string): RuleSet | undefined {
  const preset = PRESETS[name];
  return preset ? RuleSet.parse(preset) : undefined;
}

/** All presets, validated. Used by the tests and the coverage report. */
export const ALL_PRESETS: RuleSet[] = Object.values(PRESETS).map((p) => RuleSet.parse(p));
