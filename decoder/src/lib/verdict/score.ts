/**
 * The verdict engine.
 *
 * `ParsedLabel × Profile × KnowledgeBase → Verdict`, as ordinary code. No model
 * runs here and none may: CLAUDE.md's architectural law puts the model on the
 * other side of `ParsedLabel`, and this file is where that law pays for itself
 * — the same photograph and the same profile produce the same score forever,
 * every flag traces to an entry with a source, and §10 is enforced rather than
 * requested.
 */

import type {
  Allergen,
  AllergenFinding,
  Axis,
  Category,
  Concern,
  Flag,
  ParsedIngredient,
  ParsedLabel,
  Profile,
  Verdict,
} from "@/lib/schema";
import { Verdict as VerdictSchema } from "@/lib/schema";
import { KNOWLEDGE_VERSION, PROPRIETARY_BLEND_CAVEAT, match } from "@/lib/knowledge";
import { UMBRELLA_ALLERGEN_CAVEAT } from "@/lib/verdict/language";

export const ENGINE_VERSION = "engine-1";

/* -------------------------------------------------------------------------- */
/* Scoring constants                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What each severity costs.
 *
 * Deliberately *not* weighted by `strength`. It would be easy to shave the
 * deduction for a `contested` concern, and it would be wrong: the user said
 * they avoid this, and quietly discounting their avoidance because the evidence
 * is unsettled is the app substituting its judgement for theirs. The strength
 * is shown to them instead, on the flag, and they decide what to do with it.
 */
const SEVERITY_COST: Record<Concern["severity"], number> = {
  red: 22,
  amber: 7,
  yellow: 3,
};

/** A flagged allergen is not a scoring matter, but the score must not disagree
 *  with the finding sitting above it. */
const ALLERGEN_COST = 45;

/** An umbrella term costs a little: it is an unknown, not a fault. */
const UMBRELLA_COST = 4;

/**
 * §10.3 — "a biscuit is scored as a biscuit, not against broccoli."
 *
 * Sugar in confectionery is not news. Sugar in a condiment is. So a flag whose
 * entry is unremarkable for its category costs a fraction of full price, which
 * is what within-category scoring means in practice: the score answers "how
 * does this compare to the others on this shelf", not "how does this compare to
 * a vegetable".
 */
const EXPECTED_IN: Partial<Record<Category, string[]>> = {
  confectionery: ["sugar", "hfcs", "sunflower-lecithin", "maltodextrin"],
  bakery: ["sugar", "wheat", "hfcs"],
  beverage: ["sugar", "hfcs", "caffeine"],
  cereal: ["sugar", "wheat", "maltodextrin"],
  snack: ["seed-oil", "sugar", "maltodextrin"],
  supplement: ["maltodextrin", "magnesium-stearate", "sunflower-lecithin"],
  dairy: ["milk", "sugar", "lactose-ingredient"],
};
const EXPECTED_DISCOUNT = 0.4;

/** Where a category's score starts before anything is deducted. */
const BASELINE = 100;

/* -------------------------------------------------------------------------- */
/* Profile matching                                                            */
/* -------------------------------------------------------------------------- */

/** Does this profile care about this axis? */
function caresAbout(profile: Profile, axis: Axis): boolean {
  switch (axis.kind) {
    case "allergen":
      return profile.allergens.includes(axis.value);
    case "intolerance":
      return profile.intolerances.includes(axis.value);
    case "avoidance":
      return profile.avoidances.includes(axis.value);
    case "protocol":
      return profile.protocols.includes(axis.value);
    case "life-stage":
      return profile.lifeStages.includes(axis.value);
  }
}

const SEVERITY_RANK: Record<Concern["severity"], number> = { red: 3, amber: 2, yellow: 1 };

/** A stable key so the same ingredient and axis cannot flag twice. */
function flagKey(ingredient: string, axis: Axis | null): string {
  return `${ingredient.toLowerCase()}::${axis ? `${axis.kind}:${axis.value}` : "umbrella"}`;
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything an ingredient token contributes, before deduplication.
 *
 * Sub-ingredients in parentheses are walked too — "chocolate chips (cocoa mass,
 * sugar, soy lecithin)" is where an allergen usually hides, and reading only
 * the top level is how it gets missed.
 */
function textsOf(ingredient: ParsedIngredient): string[] {
  return [ingredient.text, ...ingredient.contains];
}

export function verdictFor(label: ParsedLabel, profile: Profile): Verdict {
  const flags = new Map<string, Flag>();
  const caveats: string[] = [];
  let sawUmbrella = false;
  let sawProprietaryBlend = false;

  /** Ingredient text → the allergens it declares. Reused by the findings pass. */
  const allergenHits = new Map<Allergen, Set<string>>();

  const flaggedIngredients = new Set<string>();

  for (const ingredient of label.ingredients) {
    for (const text of textsOf(ingredient)) {
      for (const { entry } of match(text)) {
        if (entry.umbrella) {
          sawUmbrella = true;
          if (entry.id === "proprietary-blend") sawProprietaryBlend = true;
          const key = flagKey(ingredient.text, null);
          if (!flags.has(key)) {
            flags.set(key, {
              ingredient: ingredient.text,
              entryId: entry.id,
              severity: "amber",
              axis: null,
              // §6's own example: 'umbrella term; can't verify contents from
              // the label'. The honest state, and never green or red.
              reason:
                entry.umbrellaNote ?? "An umbrella term — the label does not have to say what is in it.",
              plain: entry.plain,
              readConfidence: ingredient.readConfidence,
              strength: "regulatory",
              lookFor: null,
              sources: [],
            });
          }
          flaggedIngredients.add(ingredient.text);
          continue;
        }

        for (const concern of entry.concerns) {
          // Record allergen declarations regardless of profile, so the findings
          // pass below can report on an allergen the user did not ask about
          // without re-walking the label.
          if (concern.axis.kind === "allergen") {
            const set = allergenHits.get(concern.axis.value) ?? new Set<string>();
            set.add(ingredient.text);
            allergenHits.set(concern.axis.value, set);
          }

          if (!caresAbout(profile, concern.axis)) continue;

          const key = flagKey(ingredient.text, concern.axis);
          const existing = flags.get(key);
          if (existing && SEVERITY_RANK[existing.severity] >= SEVERITY_RANK[concern.severity]) continue;

          flags.set(key, {
            ingredient: ingredient.text,
            entryId: entry.id,
            severity: concern.severity,
            axis: concern.axis,
            reason: concern.note,
            plain: entry.plain,
            readConfidence: ingredient.readConfidence,
            strength: concern.strength,
            lookFor: concern.lookFor,
            sources: concern.sources,
          });
          flaggedIngredients.add(ingredient.text);
        }
      }
    }
  }

  // The "contains: milk, soy" line is a separate legal statement and is read
  // for allergens only — it is not an ingredient and must not be scored as one.
  for (const declared of label.containsStatement) {
    for (const { entry } of match(declared)) {
      for (const concern of entry.concerns) {
        if (concern.axis.kind !== "allergen") continue;
        const set = allergenHits.get(concern.axis.value) ?? new Set<string>();
        set.add(`"contains" statement`);
        allergenHits.set(concern.axis.value, set);
      }
    }
  }

  /**
   * One ingredient, one strongest reason.
   *
   * Titanium dioxide can be both a red on the titanium-dioxide axis and an
   * amber on the artificial-colours axis, and a profile carrying both axes was
   * getting the same ingredient printed twice — once in alarm and once to
   * explain itself. The red already says everything the amber would, so the
   * amber goes.
   *
   * Only *strictly weaker* duplicates are dropped. Two reds on one ingredient
   * are two genuinely different problems — wheat is gluten and wheat is a
   * starch — and both stay.
   */
  const strongest = new Map<string, number>();
  for (const flag of flags.values()) {
    const key = flag.ingredient.toLowerCase();
    strongest.set(key, Math.max(strongest.get(key) ?? 0, SEVERITY_RANK[flag.severity]));
  }
  for (const [key, flag] of [...flags.entries()]) {
    if (SEVERITY_RANK[flag.severity] < (strongest.get(flag.ingredient.toLowerCase()) ?? 0)) {
      flags.delete(key);
    }
  }

  const allergens = allergenFindings(label, profile, allergenHits);

  /* ---- Score ------------------------------------------------------------ */

  const unreadable = label.ingredients.filter((i) => i.legibility === "unreadable");
  const imperfect = label.ingredients.filter((i) => i.legibility !== "clear");

  /**
   * Whether the ingredient set is knowable at all.
   *
   * If the list runs off the frame, or an ingredient could not be read, then
   * there is an ingredient we know nothing about — and every number computed
   * over that set is a guess wearing a score's clothes. The verdict says so by
   * having no score, rather than by printing a high one with a caution beneath
   * it.
   */
  const unknowable = label.truncated || unreadable.length > 0 || label.ingredients.length === 0;

  const expected = new Set(EXPECTED_IN[label.category] ?? []);
  let score: number | null = null;
  if (!unknowable) {
    let running = BASELINE;
    for (const flag of flags.values()) {
      const base =
        flag.axis?.kind === "allergen"
          ? ALLERGEN_COST
          : flag.axis === null
            ? UMBRELLA_COST
            : SEVERITY_COST[flag.severity];
      const discount = flag.entryId && expected.has(flag.entryId) ? EXPECTED_DISCOUNT : 1;
      running -= base * discount;
    }
    score = Math.max(0, Math.min(100, Math.round(running)));
  }

  /* ---- Caveats ---------------------------------------------------------- */

  if (label.truncated) {
    caveats.push("Part of the ingredient list is cut off or out of frame, so this is not the whole label.");
  }
  if (imperfect.length > 0) {
    caveats.push(
      `${imperfect.length} ingredient${imperfect.length === 1 ? "" : "s"} could not be read clearly: ${imperfect
        .map((i) => i.text)
        .join(", ")}.`,
    );
  }
  if (sawProprietaryBlend) caveats.push(PROPRIETARY_BLEND_CAVEAT);
  if (sawUmbrella && profile.allergens.length > 0) caveats.push(UMBRELLA_ALLERGEN_CAVEAT);
  if (label.note) caveats.push(label.note);

  const incomplete = label.truncated || imperfect.length > 0;

  // Only clearly-read ingredients can be counted as having checked out.
  const cleared = label.ingredients.filter(
    (i) => i.legibility === "clear" && !flaggedIngredients.has(i.text),
  ).length;

  return VerdictSchema.parse({
    score,
    category: label.category,
    profileId: profile.id,
    profileLabel: profile.label,
    productName: label.productName,
    // Red first, then amber, then yellow. Within a severity, the order the
    // label printed them — which is descending by weight, and therefore the
    // order that matters.
    flags: [...flags.values()].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]),
    allergens,
    clearedCount: cleared,
    incomplete,
    caveats,
    provenance: { engineVersion: ENGINE_VERSION, knowledgeVersion: KNOWLEDGE_VERSION },
  });
}

/**
 * One finding per allergen on the profile, always — including the ones nothing
 * matched.
 *
 * This is the shape CLAUDE.md insists on: *the absence of a flag is never
 * evidence*. A user with a peanut allergy gets a sentence about peanuts on
 * every single scan, and when the label could not be fully read that sentence
 * says so rather than falling through to the quiet reassurance of an empty
 * list.
 */
function allergenFindings(
  label: ParsedLabel,
  profile: Profile,
  hits: Map<Allergen, Set<string>>,
): AllergenFinding[] {
  const unreadable = label.ingredients.filter((i) => i.legibility !== "clear");

  return profile.allergens.map((allergen): AllergenFinding => {
    const matches = hits.get(allergen);
    if (matches && matches.size > 0) {
      return { allergen, state: "flagged", matches: [...matches], because: null };
    }

    // Nothing matched. Before this can be reported as "not flagged", the label
    // has to have been fully readable — otherwise the honest answer is that we
    // do not know.
    //
    // Note what is deliberately *not* here: an umbrella term. US labelling
    // requires the nine major allergens to be declared even inside "natural
    // flavors", so an umbrella term on a compliant US label does not hide one.
    // The reliance on that rule is stated to the user in the caveats instead of
    // being buried here — see UMBRELLA_ALLERGEN_CAVEAT.
    if (label.truncated) {
      return {
        allergen,
        state: "cannot-verify",
        matches: [],
        because: "part of the ingredient list is out of frame",
      };
    }
    if (unreadable.length > 0) {
      return {
        allergen,
        state: "cannot-verify",
        matches: [],
        because: `${unreadable.length} ingredient${unreadable.length === 1 ? "" : "s"} could not be read`,
      };
    }
    if (label.ingredients.length === 0) {
      return { allergen, state: "cannot-verify", matches: [], because: "no ingredients were read from this photograph" };
    }
    return { allergen, state: "not-flagged", matches: [], because: null };
  });
}
