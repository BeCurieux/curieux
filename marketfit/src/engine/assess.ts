/**
 * The engine: confirmed product facts + a market + a rules snapshot → findings.
 *
 * Pure and deterministic. No network, no clock, no model: the date is an
 * argument and the rules arrive as data. The same inputs produce the same
 * findings in a test, in a background job and in a year, which is what makes
 * a finding something a merchant can argue with.
 *
 * A finding is one rule's answer about one product:
 *
 *   pass          the rule was checked and is met
 *   fail          the rule was checked and is not met — `fixText` says what to do
 *   not_assessed  the engine could not check it: a fact it needs is unconfirmed,
 *                 an amount is in a unit it will not convert, or the rule is a
 *                 registration to-do that no label can evidence
 *
 * The engine never guesses its way out of `not_assessed`. A product it cannot
 * read is not a product that passed.
 */

import { isEmptyValue, readFact, type FactKey, type Ingredient, type ProductFacts } from "./facts.js";
import { inForce, ruleId, type Citation, type Confidence, type MarketCode, type Rule, type RuleOf, type Severity } from "./rules.js";
import { scoreFindings, type Score } from "./score.js";
import type { RulesSnapshot } from "./snapshot.js";
import { containsPhrase, nameMatches } from "./text.js";
import { convert, massUnit } from "./units.js";

export type FindingStatus = "pass" | "fail" | "not_assessed";

export type Finding = {
  ruleId: string;
  ruleKey: string;
  ruleVersion: number;
  kind: Rule["kind"];
  title: string;
  severity: Severity;
  confidence: Confidence;
  /**
   * Whether this finding can move the headline score: only `verified` rules,
   * and never an advisory (BUILD_BRIEF.md §2.3, §5). Everything else is shown
   * as advice beside the score.
   */
  scored: boolean;
  status: FindingStatus;
  /** What the engine looked at and what it found. Rendered as "evidence". */
  evidence: Record<string, unknown>;
  /** The rule's fix, on a fail; null otherwise. */
  fixText: string | null;
  citation: Citation;
};

export type Assessment = {
  productId: string;
  market: MarketCode;
  category: string | null;
  asOf: string;
  rulesVersion: string;
  score: Score;
  findings: Finding[];
};

export type AssessOptions = {
  /** YYYY-MM-DD. Which rules are in force is a function of this, not of the clock. */
  asOf: string;
};

export function assess(
  product: ProductFacts,
  market: MarketCode,
  snapshot: RulesSnapshot,
  options: AssessOptions,
): Assessment {
  const rules = snapshot.rules.filter(
    (rule) => rule.market === market && rule.category === product.category && inForce(rule, options.asOf),
  );
  const findings = rules.map((rule) => evaluate(rule, product));
  return {
    productId: product.productId,
    market,
    category: product.category,
    asOf: options.asOf,
    rulesVersion: snapshot.version,
    score: scoreFindings(findings),
    findings,
  };
}

// ------------------------------------------------------------------ per rule

type Outcome = { status: FindingStatus; evidence: Record<string, unknown> };

export function evaluate(rule: Rule, product: ProductFacts): Finding {
  const gate = applies(rule, product);
  const outcome: Outcome =
    gate.status === "applies"
      ? check(rule, product)
      : gate.status === "unknown"
        ? { status: "not_assessed", evidence: { reason: "applicability-unknown", ...gate.evidence } }
        : { status: "pass", evidence: { reason: "not-applicable", ...gate.evidence } };

  return {
    ruleId: ruleId(rule),
    ruleKey: rule.rule_key,
    ruleVersion: rule.version,
    kind: rule.kind,
    title: rule.title,
    severity: rule.severity,
    confidence: rule.confidence,
    // Registration rules are to-dos the label cannot evidence; they never score.
    scored: rule.confidence === "verified" && rule.severity !== "advisory" && rule.kind !== "registration",
    status: outcome.status,
    evidence: outcome.evidence,
    fixText: outcome.status === "fail" ? rule.fix : null,
    citation: rule.citation,
  };
}

function check(rule: Rule, product: ProductFacts): Outcome {
  switch (rule.kind) {
    case "required_field":
      return requiredField(rule, product);
    case "prohibited_substance":
      return prohibitedSubstance(rule, product);
    case "limit":
      return limit(rule, product);
    case "warning_text":
      return warningText(rule, product);
    case "language":
      return language(rule, product);
    case "registration":
      return { status: "not_assessed", evidence: { reason: "registration-to-do", action: rule.params.action, url: rule.params.url } };
    case "claim":
      return claim(rule, product);
  }
}

type Gate = { status: "applies" | "not-applicable" | "unknown"; evidence: Record<string, unknown> };

function applies(rule: Rule, product: ProductFacts): Gate {
  const condition = rule.applies_if;
  if (!condition) return { status: "applies", evidence: {} };

  if (condition.fact_present) {
    const read = readFact(product, condition.fact_present);
    if (read.state === "unconfirmed") return { status: "unknown", evidence: { unconfirmed: [condition.fact_present] } };
    const present = read.state === "known" && !isEmptyValue(read.value);
    return { status: present ? "applies" : "not-applicable", evidence: { condition: { fact_present: condition.fact_present } } };
  }

  const names = condition.ingredient_any ?? [];
  const ingredients = readFact(product, "ingredients");
  if (ingredients.state !== "known") return { status: "unknown", evidence: { [ingredients.state]: ["ingredients"] } };
  const matched = ingredients.value.filter((i) => nameMatches(i.name, names)).map((i) => i.name);
  return matched.length > 0
    ? { status: "applies", evidence: { condition: { ingredient_any: names }, matched } }
    : { status: "not-applicable", evidence: { condition: { ingredient_any: names } } };
}

function requiredField(rule: RuleOf<"required_field">, product: ProductFacts): Outcome {
  const missing: FactKey[] = [];
  const unconfirmed: FactKey[] = [];
  const present: Partial<Record<FactKey, unknown>> = {};
  for (const key of rule.params.facts) {
    const read = readFact(product, key);
    if (read.state === "unconfirmed") unconfirmed.push(key);
    else if (read.state === "absent" || isEmptyValue(read.value)) missing.push(key);
    else present[key] = read.value;
  }
  // A missing field is a fail even when another one is unconfirmed: the
  // merchant has to fix it either way, and saying so now is not a guess.
  if (missing.length > 0) return { status: "fail", evidence: { missing, unconfirmed, present } };
  if (unconfirmed.length > 0) return { status: "not_assessed", evidence: { reason: "unconfirmed-facts", unconfirmed, present } };
  return { status: "pass", evidence: { present } };
}

function ingredientsOrOutcome(product: ProductFacts): Ingredient[] | Outcome {
  const read = readFact(product, "ingredients");
  if (read.state === "known") return read.value;
  return { status: "not_assessed", evidence: { reason: read.state === "unconfirmed" ? "unconfirmed-facts" : "no-ingredients", fact: "ingredients" } };
}

function prohibitedSubstance(rule: RuleOf<"prohibited_substance">, product: ProductFacts): Outcome {
  const ingredients = ingredientsOrOutcome(product);
  if (!Array.isArray(ingredients)) return ingredients;
  const matches: { ingredient: string; substance: string; matched: string }[] = [];
  for (const ingredient of ingredients) {
    for (const substance of rule.params.substances) {
      const matched = nameMatches(ingredient.name, [substance.name, ...substance.aliases]);
      if (matched) matches.push({ ingredient: ingredient.name, substance: substance.name, matched });
    }
  }
  return matches.length > 0
    ? { status: "fail", evidence: { matches } }
    : { status: "pass", evidence: { checked: ingredients.length } };
}

function limit(rule: RuleOf<"limit">, product: ProductFacts): Outcome {
  const ingredients = ingredientsOrOutcome(product);
  if (!Array.isArray(ingredients)) return ingredients;
  const { nutrient, aliases, max, unit } = rule.params;
  const relevant = ingredients.filter((i) => nameMatches(i.name, [nutrient, ...aliases]));
  if (relevant.length === 0) return { status: "pass", evidence: { reason: "nutrient-absent", nutrient } };

  const servings = readFact(product, "daily_servings");
  if (servings.state !== "known") {
    return { status: "not_assessed", evidence: { reason: servings.state === "unconfirmed" ? "unconfirmed-facts" : "no-daily-servings", fact: "daily_servings" } };
  }

  let perServing = 0;
  for (const ingredient of relevant) {
    const from = massUnit(ingredient.unit);
    if (ingredient.amount === undefined || !from) {
      return {
        status: "not_assessed",
        evidence: { reason: "amount-not-in-mass", ingredient: ingredient.name, amount: ingredient.amount ?? null, unit: ingredient.unit ?? null },
      };
    }
    perServing += convert(ingredient.amount, from, unit);
  }
  const daily = round(perServing * servings.value);
  const evidence = { nutrient, perServing: round(perServing), dailyServings: servings.value, daily, max, unit };
  return { status: daily > max ? "fail" : "pass", evidence };
}

function warningText(rule: RuleOf<"warning_text">, product: ProductFacts): Outcome {
  const languages = readFact(product, "languages");
  if (languages.state !== "known") return unknownBecause(languages.state, "languages");

  const defined = Object.keys(rule.params.texts);
  const required = defined.filter((code) => languages.value.includes(code));
  if (required.length === 0) {
    return { status: "fail", evidence: { reason: "no-label-language-for-statement", labelLanguages: languages.value, statementLanguages: defined } };
  }

  // Statements are looked for in the warnings and the label text together.
  // Absent text is a fail — the statement is not on the label we can see —
  // but text we may not read yet (unconfirmed) could hold it, so a statement
  // not found while some text is unconfirmed is not assessed, not failed.
  const warnings = readFact(product, "warnings");
  const label = readFact(product, "label_text");
  const corpus = [...(warnings.state === "known" ? warnings.value : []), ...(label.state === "known" ? [label.value] : [])].join("\n");
  const unconfirmed = [warnings, label].some((r) => r.state === "unconfirmed");

  const missing = required.filter((code) => !containsPhrase(corpus, rule.params.texts[code] as string));
  const evidence = { required: Object.fromEntries(required.map((c) => [c, rule.params.texts[c]])), missing };
  if (missing.length === 0) return { status: "pass", evidence };
  if (unconfirmed) return { status: "not_assessed", evidence: { reason: "unconfirmed-facts", ...evidence } };
  return { status: "fail", evidence };
}

function language(rule: RuleOf<"language">, product: ProductFacts): Outcome {
  const read = readFact(product, "languages");
  if (read.state !== "known") return unknownBecause(read.state, "languages");
  const present = rule.params.languages.filter((code) => read.value.includes(code));
  const ok = rule.params.mode === "all" ? present.length === rule.params.languages.length : present.length > 0;
  return {
    status: ok ? "pass" : "fail",
    evidence: { mode: rule.params.mode, required: rule.params.languages, labelLanguages: read.value },
  };
}

function claim(rule: RuleOf<"claim">, product: ProductFacts): Outcome {
  const claims = readFact(product, "claims");
  const label = readFact(product, "label_text");
  // Either source is enough to look in; both unconfirmed is not enough to pass.
  const sources: { where: string; text: string }[] = [];
  if (claims.state === "known") claims.value.forEach((c) => sources.push({ where: "claims", text: c }));
  if (label.state === "known") sources.push({ where: "label_text", text: label.value });
  const unconfirmed = [claims, label].some((r) => r.state === "unconfirmed");

  const matches = sources.flatMap((s) =>
    rule.params.phrases.filter((p) => containsPhrase(s.text, p)).map((phrase) => ({ phrase, where: s.where, text: s.text })),
  );
  if (matches.length > 0) return { status: "fail", evidence: { matches } };
  if (unconfirmed) return { status: "not_assessed", evidence: { reason: "unconfirmed-facts", facts: ["claims", "label_text"] } };
  if (sources.length === 0) return { status: "not_assessed", evidence: { reason: "no-text", facts: ["claims", "label_text"] } };
  return { status: "pass", evidence: { checked: sources.length } };
}

// ------------------------------------------------------------------ helpers

function unknownBecause(state: "absent" | "unconfirmed", key: FactKey): Outcome {
  return { status: "not_assessed", evidence: { reason: state === "unconfirmed" ? "unconfirmed-facts" : "missing-input", fact: key } };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
