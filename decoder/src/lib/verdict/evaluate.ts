/**
 * The rules engine.
 *
 * `ParsedLabel × RuleSet × KnowledgeGraph → Verdict`, as ordinary code. No
 * model runs here and none may — BRIEF.md §7 is explicit:
 *
 * > The model should not independently determine the verdict.
 *
 * and §33 makes it one of the six principles: *AI reads. The rules engine
 * decides.*
 *
 * What that buys, and why it is worth the constraint: the same photograph and
 * the same rules produce the same answer forever (§25 measures a verdict
 * dispute rate, which is meaningless if the verdict drifts); every finding
 * names the rule behind it (§16 makes every verdict inspectable); and §17's six
 * safety rules become properties of a function rather than hopes about a
 * prompt.
 */

import type {
  AllergenNotice,
  Finding,
  ParsedIngredient,
  ParsedLabel,
  Rule,
  RuleSet,
  Uncertainty,
  Verdict,
} from "@/lib/schema";
import { Verdict as VerdictSchema } from "@/lib/schema";
import { KNOWLEDGE, KNOWLEDGE_VERSION, isA, match } from "@/lib/knowledge";
import { UMBRELLA_ALLERGEN_NOTE } from "@/lib/verdict/language";

export const ENGINE_VERSION = "engine-2";

const KNOWLEDGE_BY_ID = new Map(KNOWLEDGE.map((entry) => [entry.id, entry]));

/* -------------------------------------------------------------------------- */
/* The match percentage                                                        */
/* -------------------------------------------------------------------------- */

/**
 * How well this label fits these rules.
 *
 * Every ingredient carries equal weight and contributes a share of the score:
 *
 *   blocker   0
 *   flag      0.55
 *   uncertain 0.70
 *   clear     1
 *
 *   match = round(100 × credit ÷ ingredients) − 8 per blocker
 *
 * Worked against §8's own example — twenty ingredients, one blocker, two things
 * to know, seventeen clear: `100 × (17 + 1.1) ÷ 20 = 90.5`, less 8 for the
 * blocker, is **82** — which is the number in the brief.
 *
 * Two deliberate properties:
 *
 * **A blocker does not annihilate the score.** §8 says a blocker *overrides*
 * the score in the layout, not that it zeroes it, and those are different
 * claims: "most of this fits you, but this one ingredient doesn't" is more
 * useful than 0%, and it is what makes Compare mode (§9) able to rank two
 * products that both contain a blocker.
 *
 * **Uncertainty scores better than a flag but worse than clear.** It is not a
 * conflict, and it is not nothing. §17 Rule 5 — explain uncertainty rather than
 * fill it with warning symbols.
 */
const CREDIT = { blocker: 0, flag: 0.55, uncertain: 0.7, clear: 1 } as const;
const BLOCKER_PENALTY = 8;

/* -------------------------------------------------------------------------- */
/* Rule matching                                                               */
/* -------------------------------------------------------------------------- */

type Classified = { entryId: string | null; canonical: string | null; plain: string; classes: string[] };

/** Does this rule apply to this entry? */
function ruleMatches(rule: Rule, entryId: string, classes: readonly string[]): boolean {
  if (rule.target.kind === "ingredient") return rule.target.value === entryId;
  return isA(classes as never, rule.target.value);
}

/**
 * Sub-ingredients in parentheses are walked too.
 *
 * "Chocolate chips (cocoa mass, sugar, soy lecithin)" is where the interesting
 * thing usually is, and reading only the top level is how it gets missed.
 */
function textsOf(ingredient: ParsedIngredient): string[] {
  return [headOf(ingredient), ...ingredient.contains];
}

/**
 * The parent ingredient with its parenthetical removed — but only when the
 * parser already pulled those sub-ingredients out into `contains`.
 *
 * Without this, "Chocolate Flavored Chips (Cane Sugar, Palm Kernel Oil, Cocoa
 * Powder, Soy Lecithin)" matches sugar and lecithin twice: once as itself,
 * because the whole string is tokenised, and once as its own sub-ingredients.
 * The user sees the same conflict listed under a forty-character name and again
 * under the real one.
 *
 * The `contains.length` guard matters: a label line like "Vitamin E
 * (Tocopherols)" that the parser did *not* split still needs its parenthetical
 * read, and stripping it there would lose the only name that matches.
 */
function headOf(ingredient: ParsedIngredient): string {
  return ingredient.contains.length > 0 ? withoutParens(ingredient.text) : ingredient.text;
}

function withoutParens(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, "").trim() || text;
}

export function evaluate(label: ParsedLabel, ruleSet: RuleSet): Verdict {
  const allergenRules = ruleSet.rules.filter((r) => r.allergen);
  const ordinaryRules = ruleSet.rules.filter((r) => !r.allergen);
  const neverFlag = ordinaryRules.filter((r) => r.kind === "never-flag");
  const active = ordinaryRules.filter((r) => r.kind !== "never-flag");

  const findings = new Map<string, Finding>();
  /**
   * The raw label lines that produced at least one finding.
   *
   * Tracked separately from the findings themselves because a finding's
   * `ingredient` is now the display string — "Cane Sugar (in Chocolate Flavored
   * Chips)" — and counting what is left over has to be done against what the
   * label actually printed.
   */
  const touchedRaw = new Set<string>();
  const notes: string[] = [];
  const allergenHits = new Map<string, Set<string>>();
  let sawUmbrella = false;

  for (const ingredient of label.ingredients) {
    // Sub-ingredients are walked, and each match remembers the text that
    // actually matched. "Cane Sugar (in Chocolate Flavored Chips)" is a far
    // more useful line than the forty-character parent repeated once per rule.
    for (const [depth, text] of textsOf(ingredient).entries()) {
      const shown = depth === 0 ? ingredient.text : `${text} (in ${withoutParens(ingredient.text)})`;

      for (const { entry } of match(text)) {
        const classified: Classified = {
          entryId: entry.id,
          canonical: entry.canonical,
          plain: entry.plain,
          classes: entry.classes,
        };

        /* -- Allergen rules take a different path entirely (§17 Rule 1) ---- */
        for (const rule of allergenRules) {
          if (!ruleMatches(rule, entry.id, entry.classes)) continue;
          const hits = allergenHits.get(rule.id) ?? new Set<string>();
          hits.add(ingredient.text);
          allergenHits.set(rule.id, hits);
        }

        /**
         * An umbrella term limits every rule at once, so it surfaces whenever
         * the user has any rules at all — not only when they thought to ask for
         * it. §8's own verdict shows exactly this line against a rule set that
         * never mentions flavourings:
         *
         * > 🟡 Natural flavours — The label doesn't tell us exactly what's
         * > included, so we can't completely check this against your rules.
         *
         * It is attributed to no single rule because it is about all of them,
         * which is why `Finding.ruleId` is nullable.
         */
        if (isA(entry.classes, "umbrella-term")) {
          sawUmbrella = true;
          if (active.length > 0 || allergenRules.length > 0) {
            const note = entry.uncertainty[0] ?? null;
            record(findings, shown, classified, null, "uncertain", note, ingredient.readConfidence);
            touchedRaw.add(ingredient.text);
          }
          continue;
        }

        /* -- Ordinary rules ------------------------------------------------ */
        for (const rule of active) {
          // §17 Rule 2, scoped to the question being asked. An uncertainty only
          // clouds a rule when it casts doubt on the classification that rule
          // is about — mono- and diglycerides may be animal or plant, so a
          // vegan rule cannot be settled from the label, but they are
          // emulsifiers either way and a rule about emulsifiers is not in any
          // doubt.
          const uncertainty = uncertaintyFor(entry.uncertainty, rule);

          /**
           * A rule reaches an entry two ways: the entry *is* what the rule is
           * about, or the label leaves open that it might be.
           *
           * The second case is the one that is easy to miss and is exactly
           * what §5's vegan segment is scanning for. Mono- and diglycerides
           * are not classed `animal-derived`, because they may not be — so a
           * classification-only match finds nothing at all and the vegan user
           * gets a clean verdict on the one ingredient they most needed to be
           * told about. The absence of a class is not the absence of a
           * question.
           */
          const classified_ = ruleMatches(rule, entry.id, entry.classes);
          if (!classified_ && !uncertainty) continue;

          // §6's "Don't flag: seed oils". An explicit opt-out beats any rule
          // that would otherwise fire on the same target, which is the
          // difference between a rules engine and a nag.
          if (neverFlag.some((off) => ruleMatches(off, entry.id, entry.classes))) continue;

          const outcome: Finding["outcome"] = uncertainty
            ? "uncertain"
            : rule.kind === "avoid"
              ? "blocker"
              : "flag";

          record(findings, shown, classified, rule, outcome, uncertainty, ingredient.readConfidence);
          touchedRaw.add(ingredient.text);
        }
      }
    }
  }

  // The "contains: milk, soy" line is a separate legal statement. It is read
  // for allergen rules only — it is not an ingredient and must not be scored
  // as one.
  for (const declared of label.containsStatement) {
    for (const { entry } of match(declared)) {
      for (const rule of allergenRules) {
        if (!ruleMatches(rule, entry.id, entry.classes)) continue;
        const hits = allergenHits.get(rule.id) ?? new Set<string>();
        hits.add('"contains" statement');
        allergenHits.set(rule.id, hits);
      }
    }
  }

  /* ---- Reading quality --------------------------------------------------- */

  const unreadable = label.ingredients.filter((i) => i.legibility === "unreadable");
  const imperfect = label.ingredients.filter((i) => i.legibility !== "clear");
  const readComplete = !label.truncated && imperfect.length === 0;

  /**
   * Whether the ingredient set is knowable at all.
   *
   * If the list runs off the frame, or an ingredient could not be read, then
   * there is an ingredient we know nothing about — and a percentage computed
   * over that set is a guess wearing a score's clothes. §17 Rule 2 again: the
   * product says so by having no score, not by printing one with a caution
   * beneath it, because the caution is not what gets screenshotted.
   */
  const unknowable = label.truncated || unreadable.length > 0 || label.ingredients.length === 0;

  /* ---- Sort, score, and assemble ----------------------------------------- */

  const all = [...findings.values()];
  const blockers = all.filter((f) => f.outcome === "blocker");
  const flags = all.filter((f) => f.outcome === "flag");
  const uncertain = all.filter((f) => f.outcome === "uncertain");

  const clearCount = label.ingredients.filter(
    (i) => i.legibility === "clear" && !touchedRaw.has(i.text),
  ).length;

  let matchScore: number | null = null;
  if (!unknowable) {
    const credit =
      clearCount * CREDIT.clear +
      flags.length * CREDIT.flag +
      uncertain.length * CREDIT.uncertain +
      blockers.length * CREDIT.blocker;
    const denominator = Math.max(label.ingredients.length, 1);
    const base = (100 * credit) / denominator;
    matchScore = Math.max(0, Math.min(100, Math.round(base - BLOCKER_PENALTY * blockers.length)));
  }

  /* ---- Notes ------------------------------------------------------------- */

  if (label.truncated) {
    notes.push("Part of the ingredient list is cut off or out of frame, so this isn't the whole label.");
  }
  if (imperfect.length > 0) {
    notes.push(
      `${imperfect.length} ingredient${imperfect.length === 1 ? "" : "s"} couldn't be read clearly: ${imperfect
        .map((i) => i.text)
        .join(", ")}.`,
    );
  }
  if (sawUmbrella && allergenRules.length > 0) notes.push(UMBRELLA_ALLERGEN_NOTE);
  if (label.note) notes.push(label.note);

  return VerdictSchema.parse({
    match: matchScore,
    category: label.category,
    ruleSetId: ruleSet.id,
    ruleSetLabel: ruleSet.label,
    productName: label.productName,
    blockers,
    flags,
    uncertain,
    clearCount,
    allergens: allergenNotices(label, allergenRules, allergenHits),
    needsVerification: !readComplete,
    readComplete,
    notes,
    provenance: {
      engineVersion: ENGINE_VERSION,
      knowledgeVersion: KNOWLEDGE_VERSION,
      ruleSetId: ruleSet.id,
    },
  });
}

/**
 * One finding per ingredient per rule, keeping the strongest outcome.
 *
 * An ingredient can legitimately hit two rules — wheat is a gluten grain and a
 * grain — and both are real. What must not happen is the same ingredient
 * appearing twice for the same rule because it matched through two entries.
 */
const RANK = { blocker: 3, uncertain: 2, flag: 1, clear: 0 } as const;

/**
 * Does any of this entry's uncertainty bear on what this rule is asking?
 *
 * An empty `affects` means the contents are unknown altogether — an umbrella
 * term — and clouds everything. Otherwise the doubt has to touch the rule's
 * target somewhere along the class tree, in either direction: if we do not know
 * whether something is animal-derived at all, we equally do not know whether it
 * is dairy.
 */
function uncertaintyFor(uncertainties: readonly Uncertainty[], rule: Rule): Uncertainty | null {
  for (const u of uncertainties) {
    if (u.affects.length === 0) return u;
    if (rule.target.kind !== "class") continue;
    const target = rule.target.value;
    if (u.affects.some((a) => isA([a], target) || isA([target], a))) return u;
  }
  return null;
}

function record(
  findings: Map<string, Finding>,
  shown: string,
  classified: Classified,
  rule: Rule | null,
  outcome: Finding["outcome"],
  uncertainty: Finding["uncertainty"],
  readConfidence = 1,
): void {
  const key = `${shown.toLowerCase()}::${rule?.id ?? "no-rule"}`;
  const existing = findings.get(key);
  if (existing && RANK[existing.outcome] >= RANK[outcome]) return;

  findings.set(key, {
    ingredient: shown,
    entryId: classified.entryId,
    canonical: classified.canonical,
    outcome,
    ruleId: rule?.id ?? null,
    ruleLabel: rule?.label ?? null,
    // §16's "Why you're seeing this". When the label is what we cannot settle
    // rather than the ingredient, the uncertainty note joins the rule's
    // sentence — "you asked us to avoid X" on its own is misleading when we do
    // not know whether X is there.
    because: rule
      ? uncertainty
        ? `${rule.because} ${uncertainty.note}`
        : rule.because
      : (uncertainty?.note ??
        "The label doesn't tell us exactly what's included, so we can't completely check this against your rules."),
    plain: classified.plain,
    confidence: uncertainty ? "limited" : "high",
    readConfidence,
    uncertainty,
    evidence: evidenceFor(classified.entryId),
  });
}

/** Evidence lives on the entry; a finding carries a copy so §16 can show it. */
function evidenceFor(entryId: string | null): Finding["evidence"] {
  if (!entryId) return [];
  return KNOWLEDGE_BY_ID.get(entryId)?.evidence ?? [];
}

/**
 * One notice per allergen rule, always — including the rules nothing matched.
 *
 * This is the shape §17 Rule 1 insists on: absence from OCR is not proof of
 * safety, so a user watching for peanuts gets a sentence about peanuts on every
 * scan, and when the label could not be fully read that sentence says so rather
 * than falling through to the quiet reassurance of an empty list.
 *
 * Note what is deliberately *not* treated as unverifiable: an umbrella term. US
 * labelling requires the nine major allergens to be declared even inside
 * "natural flavors", so an umbrella term on a compliant US label does not hide
 * one. That reliance is stated to the user in the notes rather than buried
 * here.
 */
function allergenNotices(
  label: ParsedLabel,
  rules: Rule[],
  hits: Map<string, Set<string>>,
): AllergenNotice[] {
  const imperfect = label.ingredients.filter((i) => i.legibility !== "clear");

  return rules.map((rule): AllergenNotice => {
    const found = hits.get(rule.id);
    if (found && found.size > 0) {
      return { ruleId: rule.id, label: rule.label, state: "listed", matches: [...found], because: null };
    }
    if (label.truncated) {
      return {
        ruleId: rule.id,
        label: rule.label,
        state: "cannot-check",
        matches: [],
        because: "part of the ingredient list is out of frame",
      };
    }
    if (imperfect.length > 0) {
      return {
        ruleId: rule.id,
        label: rule.label,
        state: "cannot-check",
        matches: [],
        because: `${imperfect.length} ingredient${imperfect.length === 1 ? "" : "s"} couldn't be read`,
      };
    }
    if (label.ingredients.length === 0) {
      return {
        ruleId: rule.id,
        label: rule.label,
        state: "cannot-check",
        matches: [],
        because: "no ingredients were read from this photograph",
      };
    }
    return { ruleId: rule.id, label: rule.label, state: "not-listed-in-what-we-read", matches: [], because: null };
  });
}
