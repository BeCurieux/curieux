/**
 * The rule record: data, never code.
 *
 * A rule is authored in YAML (`rules/{market}/{category}/{rule_key}.yaml`),
 * validated here, and stored in the `rules` table. The engine reads nothing
 * else. Every rule carries a citation with a source URL and an effective date,
 * because the product's whole promise is that each finding can be traced to an
 * instrument a merchant's lawyer can open (BUILD_BRIEF.md §2.1–2.2).
 *
 * `params` is typed per `kind`, so a rule cannot ask the engine a question the
 * engine does not know how to answer — the loader refuses it instead.
 */

import { z } from "zod";
import { FactKeySchema } from "./facts.js";

export const MARKET_CODES = ["EU", "UK", "US"] as const;
export type MarketCode = (typeof MARKET_CODES)[number];
export const MarketCodeSchema = z.enum(MARKET_CODES);

export const SEVERITIES = ["blocked", "needs_attention", "advisory"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["verified", "drafted", "needs_review"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a date as YYYY-MM-DD");

export const Citation = z
  .object({
    /** The instrument, e.g. "Regulation (EU) No 1169/2011". */
    regulation: z.string().min(1),
    /** Article, section or regulation number within it, e.g. "Art. 9(1)(e)". */
    article: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    effective_from: isoDate,
    effective_to: isoDate.optional(),
  })
  .strict()
  .refine((c) => !c.effective_to || c.effective_to > c.effective_from, {
    message: "effective_to must be after effective_from",
  });
export type Citation = z.infer<typeof Citation>;

/** Lowercase ISO 639-1. */
const language = z.string().regex(/^[a-z]{2}$/, "an ISO 639-1 code such as en, de, fr");

/**
 * When a rule only applies to some products — the US iron warning only binds
 * a product with iron in it. Absent means always.
 */
export const AppliesIf = z
  .object({
    /** Applies when any ingredient matches any of these names. */
    ingredient_any: z.array(z.string().min(1)).min(1).optional(),
    /** Applies when this fact is present and non-empty. */
    fact_present: FactKeySchema.optional(),
  })
  .strict()
  .refine((a) => Boolean(a.ingredient_any) !== Boolean(a.fact_present), {
    message: "applies_if takes exactly one of ingredient_any or fact_present",
  });
export type AppliesIf = z.infer<typeof AppliesIf>;

const Substance = z.object({ name: z.string().min(1), aliases: z.array(z.string().min(1)).default([]) }).strict();

export const UNITS = ["g", "mg", "µg"] as const;
export type MassUnit = (typeof UNITS)[number];

export const RuleParams = {
  required_field: z.object({ facts: z.array(FactKeySchema).min(1) }).strict(),
  prohibited_substance: z.object({ substances: z.array(Substance).min(1) }).strict(),
  limit: z
    .object({
      nutrient: z.string().min(1),
      aliases: z.array(z.string().min(1)).default([]),
      /** Maximum per day at the recommended dose. */
      max: z.number().positive(),
      unit: z.enum(UNITS),
    })
    .strict(),
  warning_text: z
    .object({
      /** The mandatory statement, verbatim, per language. */
      texts: z.record(language, z.string().min(1)).refine((t) => Object.keys(t).length > 0, "at least one language"),
    })
    .strict(),
  language: z.object({ languages: z.array(language).min(1), mode: z.enum(["all", "any"]) }).strict(),
  registration: z.object({ action: z.string().min(1), url: z.url({ protocol: /^https$/ }) }).strict(),
  claim: z.object({ phrases: z.array(z.string().min(1)).min(1) }).strict(),
} as const;

export type RuleKind = keyof typeof RuleParams;
export const RULE_KINDS = Object.keys(RuleParams) as RuleKind[];

const common = {
  market: MarketCodeSchema,
  category: z.string().regex(/^[a-z][a-z0-9_]*$/),
  rule_key: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case"),
  /** What the merchant reads as the finding's headline. */
  title: z.string().min(1),
  /** What to do about a fail. Shown verbatim beside the citation. */
  fix: z.string().min(1),
  severity: z.enum(SEVERITIES),
  confidence: z.enum(CONFIDENCES),
  version: z.number().int().positive(),
  citation: Citation,
  applies_if: AppliesIf.optional(),
};

function variant<K extends RuleKind>(kind: K) {
  return z.object({ ...common, kind: z.literal(kind), params: RuleParams[kind] }).strict();
}

export const Rule = z.discriminatedUnion("kind", [
  variant("required_field"),
  variant("prohibited_substance"),
  variant("limit"),
  variant("warning_text"),
  variant("language"),
  variant("registration"),
  variant("claim"),
]);
export type Rule = z.infer<typeof Rule>;
export type RuleOf<K extends RuleKind> = Extract<Rule, { kind: K }>;

/** The permanent id. A rule whose meaning changes gets a new key, not a new id. */
export function ruleId(rule: Pick<Rule, "market" | "category" | "rule_key">): string {
  return `${rule.market.toLowerCase()}.${rule.category}.${rule.rule_key}`;
}

/**
 * Does this rule bind on `asOf`? `effective_to` is exclusive: a rule that
 * stops applying on 1 January does not apply on 1 January.
 */
export function inForce(rule: Rule, asOf: string): boolean {
  const { effective_from, effective_to } = rule.citation;
  return effective_from <= asOf && (!effective_to || asOf < effective_to);
}
