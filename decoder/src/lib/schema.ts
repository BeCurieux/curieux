/**
 * Every boundary in the product, as one file.
 *
 * Two of the six core principles (BRIEF.md §33) are enforced here in the type
 * system rather than asked for in prose:
 *
 * - **"AI reads. The rules engine decides."** `ParsedLabel` is the entire
 *   surface the vision pass may produce, and it has no field a verdict could
 *   go in. There is nowhere to put a score even if a prompt drifted.
 * - **"The user's rules determine the verdict."** A `Finding` cannot exist
 *   without naming the rule that produced it. An ingredient is never flagged
 *   because the app disapproves of it — only because a rule the user wrote
 *   matched.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* The ontology — §14's classification and relationships                       */
/* -------------------------------------------------------------------------- */

/**
 * What an ingredient *is*.
 *
 * §14 asks for classification and relationships:
 *
 * > sunflower oil → vegetable oil → sunflower-derived → seed oil
 *
 * The relationships are the parent links in `CLASS_TREE` (`knowledge/classes.ts`).
 * A rule targeting `oil-seed` matches sunflower oil without naming it, and a
 * rule targeting `animal-derived` matches gelatin, carmine, whey and shellac
 * without a list — which is what makes "I'm vegan" a single rule rather than
 * forty.
 *
 * This is also why the ontology is the moat rather than the entry count: a new
 * sweetener inherits every rule ever written about sweeteners the moment it is
 * classified.
 */
export const ClassId = z.enum([
  // Provenance
  "animal-derived",
  "dairy",
  "egg",
  "fish",
  "shellfish",
  "meat",
  "pork-derived",
  "insect-derived",
  "plant-derived",

  // Allergens with mandatory US declaration (FALCPA + FASTER Act sesame)
  "allergen-milk",
  "allergen-egg",
  "allergen-fish",
  "allergen-shellfish",
  "allergen-tree-nut",
  "allergen-peanut",
  "allergen-wheat",
  "allergen-soy",
  "allergen-sesame",

  // Fats and oils
  "oil",
  "oil-vegetable",
  "oil-seed",
  "oil-fruit",
  "oil-hydrogenated",
  "fat-animal",

  // Sweetness
  "sweetener",
  "sugar-added",
  "sweetener-artificial",
  "sweetener-sugar-alcohol",
  "sweetener-plant",

  // Additives by function
  "additive",
  "emulsifier",
  "preservative",
  "antioxidant-synthetic",
  "colour",
  "colour-synthetic",
  "colour-natural",
  "thickener",
  "flavour-enhancer",
  "flour-treatment",
  "anti-caking",

  // Other things rules get written about
  "caffeine-source",
  "gluten-grain",
  "grain",
  "starch-refined",
  "nitrite-source",
  "sulfite-source",
  "high-fodmap",
  "alcohol",
  "umbrella-term",
]);
export type ClassId = z.infer<typeof ClassId>;

/* -------------------------------------------------------------------------- */
/* Evidence and uncertainty — §14                                              */
/* -------------------------------------------------------------------------- */

/**
 * How well established the reason for a classification is.
 *
 * `none` is the honest and most common answer on the clean-label axis, and it
 * is not a weakness: §17 Rule 3 forbids health claims, so where there is no
 * regulatory position the entry asserts nothing about the world and the flag
 * says only *you asked us to flag this*.
 */
export const EvidenceStrength = z.enum(["regulatory", "established", "contested", "none"]);
export type EvidenceStrength = z.infer<typeof EvidenceStrength>;

export const Jurisdiction = z.enum(["US", "EU", "UK", "CA", "AU", "international"]);
export type Jurisdiction = z.infer<typeof Jurisdiction>;

export const Evidence = z.object({
  /** Who says so. */
  body: z.string().min(1),
  /** What they say, in their own frame. Linted for health claims at test time. */
  cite: z.string().min(1),
  jurisdiction: Jurisdiction,
  strength: EvidenceStrength,
  /** ISO date. §14 asks for it, and a stale citation is a live liability. */
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  url: z.string().url().nullable().default(null),
});
export type Evidence = z.infer<typeof Evidence>;

/**
 * §14's uncertainty list, as a closed set.
 *
 * Structured rather than free text because §17 Rule 2 turns on it — uncertainty
 * and absence must never collapse into each other, and the renderer needs to
 * know *which kind* of not-knowing it is looking at to say the right sentence.
 */
export const UncertaintyKind = z.enum([
  "may-be-animal-or-plant",
  "umbrella-term",
  "species-not-disclosed",
  "source-not-disclosed",
  "dose-not-disclosed",
  "insufficient-label-information",
]);
export type UncertaintyKind = z.infer<typeof UncertaintyKind>;

export const Uncertainty = z.object({
  kind: UncertaintyKind,
  /** One sentence, in the user's language, about what the label does not say. */
  note: z.string().min(1),
  /**
   * Which classifications this casts doubt on. Empty means the contents are
   * unknown altogether, which is what an umbrella term is.
   *
   * Uncertainty is relative to the question being asked, and forgetting that
   * produces nonsense. Mono- and diglycerides may be animal or plant derived,
   * so a vegan rule genuinely cannot be settled from the label — but they are
   * emulsifiers either way, so a rule about emulsifiers is not in any doubt at
   * all. Without this field the engine answered "we can't tell" to a question
   * the label had already answered.
   */
  affects: z.array(ClassId).default([]),
});
export type Uncertainty = z.infer<typeof Uncertainty>;

/* -------------------------------------------------------------------------- */
/* The knowledge graph — §14                                                   */
/* -------------------------------------------------------------------------- */

export const KnowledgeEntry = z.object({
  id: z.string().min(1),
  /** What the app calls it. */
  canonical: z.string().min(1),
  /**
   * Every way this appears on a label, lowercased: alternative spellings,
   * common names, chemical names, regional variants. Matching is exact after
   * normalisation against this list — never fuzzy, because a fuzzy match is a
   * wrong answer with a confident face.
   */
  names: z.array(z.string().min(1)).min(1),
  /** E-number where one exists, e.g. "E102". Also matched. */
  eNumber: z.string().regex(/^E\d{3,4}[a-z]?$/i).nullable().default(null),
  /** What it is and what it does. One sentence, no jargon, no claim. */
  plain: z.string().min(1),
  /** Where it sits in the ontology. Rules match through this. */
  classes: z.array(ClassId).min(1),
  evidence: z.array(Evidence).default([]),
  uncertainty: z.array(Uncertainty).default([]),
});
export type KnowledgeEntry = z.infer<typeof KnowledgeEntry>;
export type KnowledgeEntryInput = z.input<typeof KnowledgeEntry>;

/* -------------------------------------------------------------------------- */
/* Rules — the whole point of the product                                      */
/* -------------------------------------------------------------------------- */

/**
 * - `avoid`      a blocker. "You asked us to avoid X."
 * - `flag`       something to know. "You asked us to flag X."
 * - `never-flag` an explicit opt-out, so "I don't care about seed oils"
 *                survives a preset that would otherwise flag them. §6's
 *                onboarding example ends with exactly this, and without it the
 *                app cannot be told to stop — which is the difference between
 *                a rules engine and a nag.
 */
export const RuleKind = z.enum(["avoid", "flag", "never-flag"]);
export type RuleKind = z.infer<typeof RuleKind>;

/** A rule points at a class, or at one specific ingredient. */
export const RuleTarget = z.union([
  z.object({ kind: z.literal("class"), value: ClassId }),
  z.object({ kind: z.literal("ingredient"), value: z.string().min(1) }),
]);
export type RuleTarget = z.infer<typeof RuleTarget>;

export const Rule = z
  .object({
    id: z.string().min(1),
    kind: RuleKind,
    target: RuleTarget,
    /** What the user sees in their rule list. "Artificial sweeteners". */
    label: z.string().min(1),
    /**
     * The exact sentence shown on a finding. Written in the second person and
     * always attributing the decision to the user — §17 Rule 4 means the app
     * never has an opinion of its own to express.
     */
    because: z.string().min(1),
    origin: z.enum(["preset", "custom"]),
    /**
     * Set when this rule is about a declared allergen. It switches the entire
     * output for that ingredient into the never-certify vocabulary in
     * `verdict/language.ts` — "listed on this label", never "safe".
     *
     * §5 moves allergy households from the first launch segment to the fifth
     * precisely because this is the highest-consequence path, so the marker is
     * explicit rather than inferred from a label string.
     */
    allergen: z.boolean().default(false),
  })
  .superRefine((rule, ctx) => {
    // §17 Rule 4: compatibility is relative to the user's own profile. A rule
    // whose sentence does not attribute the decision to the user is the app
    // smuggling an opinion in, so the shape of the sentence is checked here
    // rather than left to whoever writes the next preset.
    if (rule.kind !== "never-flag" && !/\byou\b|\byour\b/i.test(rule.because)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["because"],
        message: `${rule.id}: a rule's explanation must say that the user asked for it`,
      });
    }
  });
export type Rule = z.infer<typeof Rule>;
export type RuleInput = z.input<typeof Rule>;

export const RuleSet = z.object({
  id: z.string().min(1),
  /** What the user calls this set of rules. Shown on the share card. */
  label: z.string().min(1),
  rules: z.array(Rule).default([]),
});
export type RuleSet = z.infer<typeof RuleSet>;
export type RuleSetInput = z.input<typeof RuleSet>;

/* -------------------------------------------------------------------------- */
/* ParsedLabel — the whole of what the model may say                           */
/* -------------------------------------------------------------------------- */

export const Legibility = z.enum(["clear", "partial", "unreadable"]);
export type Legibility = z.infer<typeof Legibility>;

export const ParsedIngredient = z.object({
  /** The text as printed on the label, not normalised and not interpreted. */
  text: z.string().min(1),
  legibility: Legibility,
  /** The model's confidence that it read the characters correctly, 0–1. */
  readConfidence: z.number().min(0).max(1),
  /**
   * Sub-ingredients printed in parentheses, e.g. "chocolate chips (cocoa mass,
   * sugar, soy lecithin)". Kept nested because that is where an animal-derived
   * ingredient or an allergen usually hides, and flattening loses which product
   * it belongs to.
   */
  contains: z.array(z.string().min(1)).default([]),
});
export type ParsedIngredient = z.infer<typeof ParsedIngredient>;

export const Category = z.enum([
  "snack",
  "confectionery",
  "beverage",
  "dairy",
  "bakery",
  "condiment",
  "ready-meal",
  "cereal",
  "supplement",
  "menu-item",
  "unknown",
]);
export type Category = z.infer<typeof Category>;

export const ParsedLabel = z.object({
  category: Category,
  /** Product name if the photograph shows one. Never invented. */
  productName: z.string().nullable().default(null),
  ingredients: z.array(ParsedIngredient),
  /**
   * The "contains: milk, soy" line, transcribed separately. It is a different
   * legal statement from the ingredient list, and reading it as an ingredient
   * would put the word "contains" in the list.
   */
  containsStatement: z.array(z.string().min(1)).default([]),
  /**
   * True when part of the ingredient list is cut off, blurred or out of frame
   * — as distinct from an individual token being smudged.
   */
  truncated: z.boolean().default(false),
  /** Free-text note from the vision pass about what it could not do. */
  note: z.string().nullable().default(null),
});
export type ParsedLabel = z.infer<typeof ParsedLabel>;

/* -------------------------------------------------------------------------- */
/* The verdict                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * - `blocker`   an `avoid` rule matched.
 * - `flag`      a `flag` rule matched.
 * - `uncertain` a rule *might* apply and the label does not say enough to
 *               settle it. §17 Rule 2 — this can never be reported as `clear`.
 * - `clear`     read, understood, and no rule matched.
 */
export const Outcome = z.enum(["blocker", "flag", "uncertain", "clear"]);
export type Outcome = z.infer<typeof Outcome>;

/**
 * §8's verdict lines and §16's inspect panel, as one record.
 *
 * `ruleId` is non-nullable for anything but `clear` and `uncertain`: a blocker
 * or a flag that cannot name the rule behind it is the app having an opinion,
 * which §17 Rule 4 rules out.
 */
export const Finding = z.object({
  /** As printed on the label. */
  ingredient: z.string().min(1),
  entryId: z.string().min(1).nullable(),
  canonical: z.string().nullable(),
  outcome: Outcome,
  ruleId: z.string().nullable(),
  ruleLabel: z.string().nullable(),
  /** "You asked us to avoid seed oils." Rendered verbatim. */
  because: z.string().min(1),
  /** What the ingredient is. §16's "What it is". */
  plain: z.string().min(1),
  /**
   * §8 shows "High confidence" or "Limited information". This is about whether
   * the *label told us enough*, and it is deliberately separate from
   * `readConfidence`, which is about whether the *camera read it*. A crisply
   * printed umbrella term and a smudged additive are different problems and a
   * single merged number would describe neither.
   */
  confidence: z.enum(["high", "limited"]),
  readConfidence: z.number().min(0).max(1),
  uncertainty: Uncertainty.nullable(),
  evidence: z.array(Evidence),
});
export type Finding = z.infer<typeof Finding>;

/**
 * The allergen block, kept out of `findings` and out of the match score.
 *
 * §5 and §17 Rule 1: the product may say *peanut listed on label* and must
 * never say *safe for peanut allergy*. That needs its own vocabulary and its
 * own place in the layout, because §8 is explicit that a declared allergen
 * takes over the screen from the score.
 *
 * `state` has no value meaning "absent". `not-listed-in-what-we-read` is as
 * close as the product is ever allowed to get, and it says so in its own name.
 */
export const AllergenNotice = z.object({
  ruleId: z.string().min(1),
  label: z.string().min(1),
  state: z.enum(["listed", "not-listed-in-what-we-read", "cannot-check"]),
  matches: z.array(z.string()).default([]),
  because: z.string().nullable().default(null),
});
export type AllergenNotice = z.infer<typeof AllergenNotice>;

export const Verdict = z.object({
  /**
   * Compatibility with this rule set, 0–100 — never a health rating (§17
   * Rule 4). Null when the ingredient set is unknowable, because a percentage
   * computed over a list that is missing an unknown number of entries is a
   * confident answer to a question nobody can answer.
   */
  match: z.number().int().min(0).max(100).nullable(),
  category: Category,
  ruleSetId: z.string().min(1),
  ruleSetLabel: z.string().min(1),
  productName: z.string().nullable(),
  blockers: z.array(Finding),
  flags: z.array(Finding),
  uncertain: z.array(Finding),
  /** Ingredients read clearly against which no rule matched. */
  clearCount: z.number().int().min(0),
  allergens: z.array(AllergenNotice),
  /**
   * §8 Step 2 — "Never silently guess." True when the reader should be asked to
   * retake or confirm before the verdict is trusted.
   */
  needsVerification: z.boolean(),
  /** True when anything at all could not be read. */
  readComplete: z.boolean(),
  /** Plain sentences about what the label or the photograph did not give us. */
  notes: z.array(z.string()),
  provenance: z.object({
    engineVersion: z.string().min(1),
    knowledgeVersion: z.string().min(1),
    ruleSetId: z.string().min(1),
  }),
});
export type Verdict = z.infer<typeof Verdict>;

/* -------------------------------------------------------------------------- */
/* Feedback — §16 and §25's verdict dispute rate                               */
/* -------------------------------------------------------------------------- */

/** §16's categories, verbatim. §25 makes the rate a first-class metric. */
export const DisputeKind = z.enum([
  "ingredient-missed",
  "ingredient-misread",
  "incorrect-classification",
  "incorrect-rule-match",
  "explanation-inaccurate",
  "other",
]);
export type DisputeKind = z.infer<typeof DisputeKind>;

export const Dispute = z.object({
  kind: DisputeKind,
  /** The finding disputed, when the user pointed at one. */
  ingredient: z.string().nullable().default(null),
  entryId: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  /**
   * Enough to re-derive the verdict without storing the scan. §17 Rule 6:
   * minimise collection — a dispute needs the versions and the label text, not
   * an account and not a photograph.
   */
  provenance: z.object({
    engineVersion: z.string().min(1),
    knowledgeVersion: z.string().min(1),
    ruleSetId: z.string().min(1),
  }),
});
export type Dispute = z.infer<typeof Dispute>;
