/**
 * Every boundary in the product, as one file.
 *
 * The architectural law lives here in the type system: `ParsedLabel` is the
 * entire surface the model is allowed to produce, and it has no field that
 * could carry a verdict. There is nowhere for a model to put a score even if a
 * prompt drifted, which is the point — the rule is structural, not textual.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Profile — what the user told us about themselves                            */
/* -------------------------------------------------------------------------- */

/**
 * The nine allergens with mandatory US labelling (FALCPA, plus sesame from the
 * FASTER Act, effective January 2023). The list is deliberately the legal one:
 * these are the substances a US label is *required* to declare, which is the
 * only reason we can say anything at all about their absence — and even then
 * only as "not flagged on this label" (see `verdict/language.ts`).
 */
export const Allergen = z.enum([
  "milk",
  "egg",
  "fish",
  "shellfish",
  "tree-nut",
  "peanut",
  "wheat",
  "soy",
  "sesame",
]);
export type Allergen = z.infer<typeof Allergen>;

/**
 * Intolerances are not allergens and are not mandatorily declared. They get
 * their own axis so the language can differ: an allergen answer is always
 * "flagged / not flagged", an intolerance answer can be ordinary.
 */
export const Intolerance = z.enum(["gluten", "lactose", "fructose", "histamine", "sulfite"]);
export type Intolerance = z.infer<typeof Intolerance>;

/** The things a clean-label profile chooses to avoid. §4 ICP 2. */
export const Avoidance = z.enum([
  "seed-oils",
  "artificial-sweeteners",
  "artificial-colours",
  "artificial-preservatives",
  "added-sugar",
  "carrageenan",
  "titanium-dioxide",
  "msg",
  "nitrites",
]);
export type Avoidance = z.infer<typeof Avoidance>;

/** §4 ICP 4. */
export const Protocol = z.enum(["keto", "carnivore", "low-fodmap", "vegan", "vegetarian", "halal"]);
export type Protocol = z.infer<typeof Protocol>;

/** §4 ICP 3. A window, not a diagnosis — and never rendered as advice. */
export const LifeStage = z.enum(["pregnancy", "breastfeeding", "young-children"]);
export type LifeStage = z.infer<typeof LifeStage>;

/**
 * Every axis a knowledge-base entry can speak to. Flattened into one union
 * because the engine matches entries to profiles by axis identity, and a
 * nested shape would mean five nearly-identical match paths.
 */
export const Axis = z.union([
  z.object({ kind: z.literal("allergen"), value: Allergen }),
  z.object({ kind: z.literal("intolerance"), value: Intolerance }),
  z.object({ kind: z.literal("avoidance"), value: Avoidance }),
  z.object({ kind: z.literal("protocol"), value: Protocol }),
  z.object({ kind: z.literal("life-stage"), value: LifeStage }),
]);
export type Axis = z.infer<typeof Axis>;

export const Profile = z.object({
  /** Stable id, so a verdict can be reproduced from a scan record. */
  id: z.string().min(1),
  /** What the user would call this profile. Shown on the share card. */
  label: z.string().min(1),
  allergens: z.array(Allergen).default([]),
  intolerances: z.array(Intolerance).default([]),
  avoidances: z.array(Avoidance).default([]),
  protocols: z.array(Protocol).default([]),
  lifeStages: z.array(LifeStage).default([]),
});
export type Profile = z.infer<typeof Profile>;

/* -------------------------------------------------------------------------- */
/* ParsedLabel — the whole of what the model may say                           */
/* -------------------------------------------------------------------------- */

/**
 * How well the camera did on this token.
 *
 * `unreadable` is a first-class outcome rather than an absence. A label the
 * model could not fully read must be able to say so, because the alternative —
 * dropping the token and returning a shorter clean list — is the exact failure
 * mode that turns a missed allergen into a green verdict.
 */
export const Legibility = z.enum(["clear", "partial", "unreadable"]);
export type Legibility = z.infer<typeof Legibility>;

export const ParsedIngredient = z.object({
  /** The text as printed on the label, not normalised and not interpreted. */
  text: z.string().min(1),
  legibility: Legibility,
  /** The model's confidence that it read the characters correctly, 0–1. */
  readConfidence: z.number().min(0).max(1),
  /**
   * Sub-ingredients printed in parentheses, e.g. "chocolate chips (cocoa
   * mass, sugar, soy lecithin)". Kept nested because an allergen hiding one
   * level down is the common case, and flattening loses which product it
   * belongs to.
   */
  contains: z.array(z.string().min(1)).default([]),
});
export type ParsedIngredient = z.infer<typeof ParsedIngredient>;

/**
 * §10.3: a biscuit is scored as a biscuit. The category comes from the vision
 * pass because it is a fact about the photograph, and it selects the baseline
 * the scorer starts from.
 */
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
   * legal statement from the ingredient list and reading it as an ingredient
   * would put the word "contains" in the list.
   */
  containsStatement: z.array(z.string().min(1)).default([]),
  /**
   * True when part of the ingredient list is cut off, blurred or out of frame
   * — as distinct from an individual token being smudged. Drives the "cannot
   * verify from this label" state on every allergen axis.
   */
  truncated: z.boolean().default(false),
  /** Free-text note from the vision pass about what it could not do. */
  note: z.string().nullable().default(null),
});
export type ParsedLabel = z.infer<typeof ParsedLabel>;

/* -------------------------------------------------------------------------- */
/* Knowledge base — the asset                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How well established the *reason for the concern* is. This is not OCR
 * confidence and the two are never merged into one number — see CLAUDE.md,
 * collision 4.
 *
 * - `regulatory`  a rule or mandatory declaration says so. Not an opinion.
 * - `established` broad agreement among the bodies that publish on it.
 * - `contested`   real disagreement, or evidence that does not settle it.
 * - `preference`  no claim of harm at all; the user simply said they avoid it.
 */
export const Strength = z.enum(["regulatory", "established", "contested", "preference"]);
export type Strength = z.infer<typeof Strength>;

export const Source = z.object({
  /** Who says so. */
  body: z.string().min(1),
  /** What they say, in their own frame. */
  cite: z.string().min(1),
  url: z.string().url().nullable().default(null),
});
export type Source = z.infer<typeof Source>;

/**
 * One reason one entry matters to one axis.
 *
 * `note` is the sentence the user reads, and it is linted: no disease names, no
 * calorie framing, no moralising (see `tests/safety.test.ts`). It explains why
 * *their profile* cares, never what will happen to their body.
 */
export const Concern = z.object({
  axis: Axis,
  severity: z.enum(["red", "amber", "yellow"]),
  strength: Strength,
  note: z.string().min(1),
  /**
   * §10.3 — a red flag never renders alone. What to look for instead, at the
   * ingredient level, because there is no product database in V1 (collision 2).
   */
  lookFor: z.string().min(1).nullable().default(null),
  sources: z.array(Source),
});
export type Concern = z.infer<typeof Concern>;

export const KnowledgeEntry = z
  .object({
    id: z.string().min(1),
    /**
     * Every way this appears on a label, lowercased. The first is the display
     * name. Matching is exact-after-normalisation against this list; there is
     * no fuzzy matching, because a fuzzy allergen match is a wrong answer with
     * a confident face.
     */
    names: z.array(z.string().min(1)).min(1),
    /** E-number where one exists, e.g. "E102". Also matched. */
    eNumber: z.string().regex(/^E\d{3,4}[a-z]?$/i).nullable().default(null),
    /** One sentence, plain English, no jargon and no claim. */
    plain: z.string().min(1),
    /**
     * True for "natural flavors", "spices", "proprietary blend" — terms that
     * legally stand in for contents the label does not disclose. Always amber,
     * never green and never red: the honest answer is that the label does not
     * say.
     */
    umbrella: z.boolean().default(false),
    /**
     * What this particular umbrella term hides, when the generic sentence would
     * be wrong. A proprietary blend *does* name its contents — it withholds the
     * doses — and saying "the label does not have to say what is in it" over a
     * list of named ingredients is the product being visibly wrong about
     * something the reader can check with their own eyes.
     */
    umbrellaNote: z.string().min(1).nullable().default(null),
    concerns: z.array(Concern).default([]),
  })
  .superRefine((entry, ctx) => {
    // CLAUDE.md safety rule 5, enforced in the type rather than in review: a
    // red flag with no citation is exactly the confidently-wrong claim §6 calls
    // the kill scenario. `preference` is exempt because it makes no claim about
    // the world — the user said they avoid it, and that needs no source.
    for (const [i, concern] of entry.concerns.entries()) {
      if (concern.severity === "red" && concern.strength !== "preference" && concern.sources.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["concerns", i, "sources"],
          message: `${entry.id}: a red flag must cite a source`,
        });
      }
      if (concern.severity === "red" && concern.lookFor === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["concerns", i, "lookFor"],
          message: `${entry.id}: a red flag must say what to look for instead (§10.3)`,
        });
      }
    }
  });
export type KnowledgeEntry = z.infer<typeof KnowledgeEntry>;

/**
 * The entry as it is *written*, before zod fills its defaults in.
 *
 * `entries.ts` is authored by hand and is the file that grows towards §11's
 * three hundred, so it is typed on the way in: an author who omits
 * `umbrellaNote` on an ordinary ingredient should not have to write `null`, but
 * an author who misspells `concerns` should still hear about it immediately
 * rather than at module load.
 */
export type KnowledgeEntryInput = z.input<typeof KnowledgeEntry>;

/* -------------------------------------------------------------------------- */
/* Verdict — what the engine produces                                          */
/* -------------------------------------------------------------------------- */

/**
 * §6, field for field: ingredient → why it's flagged for YOUR profile →
 * confidence → plain English → source.
 */
export const Flag = z.object({
  /** As printed on the label. */
  ingredient: z.string().min(1),
  entryId: z.string().min(1).nullable(),
  severity: z.enum(["red", "amber", "yellow"]),
  axis: Axis.nullable(),
  /** Why *this* profile cares. Rendered verbatim. */
  reason: z.string().min(1),
  plain: z.string().min(1),
  /** How sure we are we read it (OCR). Never merged with `strength`. */
  readConfidence: z.number().min(0).max(1),
  /** How well established the concern is. Never merged with `readConfidence`. */
  strength: Strength.nullable(),
  lookFor: z.string().nullable(),
  sources: z.array(Source),
});
export type Flag = z.infer<typeof Flag>;

/**
 * The per-allergen answer, kept separate from `flags` and from the score.
 *
 * This exists because of the one rule that must not be expressible as an
 * absence: a user with a peanut allergy needs an explicit statement about
 * peanuts on every scan, including the scans where nothing was found — and
 * that statement is "not flagged on this label", never "safe". A missing entry
 * in a flags array cannot carry that sentence, so the sentence gets its own
 * field.
 */
export const AllergenFinding = z.object({
  allergen: Allergen,
  /**
   * - `flagged`      found, on the ingredient list or the contains statement
   * - `not-flagged`  looked, and this label does not declare it
   * - `cannot-verify` the label is truncated, illegible, or hides it behind an
   *                   umbrella term. Never collapses into `not-flagged`.
   */
  state: z.enum(["flagged", "not-flagged", "cannot-verify"]),
  /** Which ingredient triggered it, when flagged. */
  matches: z.array(z.string()).default([]),
  /** Why we cannot verify, when we cannot. */
  because: z.string().nullable().default(null),
});
export type AllergenFinding = z.infer<typeof AllergenFinding>;

export const Verdict = z.object({
  /**
   * Null when there is no honest score to give.
   *
   * A label that is cut off, or that has an ingredient nobody could read, has
   * an unknown ingredient set — and a number computed over an unknown set is a
   * confident answer to a question we cannot answer. The first version of this
   * engine returned 100/100 on exactly that input, with a warning underneath,
   * which is how the failure actually happens: the warning is not what gets
   * screenshotted.
   *
   * A merely *smudged* ingredient does not null the score. There the identity
   * is known and the reading is imperfect, which the flag's `readConfidence`
   * already carries.
   */
  score: z.number().int().min(0).max(100).nullable(),
  /** §10.3 — the score is against this category, and says so. */
  category: Category,
  profileId: z.string().min(1),
  profileLabel: z.string().min(1),
  productName: z.string().nullable(),
  flags: z.array(Flag),
  allergens: z.array(AllergenFinding),
  /**
   * Ingredients that were read clearly and raised no flag for this profile.
   *
   * Deliberately excludes anything illegible: an ingredient nobody could read
   * has not "checked out", and counting it as cleared is the same over-claim as
   * scoring an unreadable label.
   */
  clearedCount: z.number().int().min(0),
  /**
   * True when anything at all could not be read or resolved — including a
   * merely smudged ingredient that did not null the score. The renderer must
   * show it; a partial read presented as a complete verdict is the failure
   * mode §6 calls the kill scenario.
   */
  incomplete: z.boolean(),
  /** Plain sentences explaining what was not verifiable. */
  caveats: z.array(z.string()),
  /** Version of the engine and knowledge base that produced this. */
  provenance: z.object({
    engineVersion: z.string().min(1),
    knowledgeVersion: z.string().min(1),
  }),
});
export type Verdict = z.infer<typeof Verdict>;
