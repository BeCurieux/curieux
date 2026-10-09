import type { Fact, FactKey, ProductFacts } from "@/engine/facts.js";
import type { Rule } from "@/engine/rules.js";
import { createSnapshot, type RulesSnapshot } from "@/engine/snapshot.js";

export const AS_OF = "2026-10-08";

/** A product whose facts all come from the merchant, i.e. are usable. */
export function product(facts: { [K in FactKey]?: Fact<K>["value"] }, category: string | null = "supplements"): ProductFacts {
  const out: ProductFacts["facts"] = {};
  for (const [key, value] of Object.entries(facts)) {
    (out as Record<string, Fact>)[key] = { value: value as Fact["value"], source: "merchant_input" };
  }
  return { productId: "p1", category, facts: out };
}

export function withFact<K extends FactKey>(p: ProductFacts, key: K, fact: Fact<K>): ProductFacts {
  return { ...p, facts: { ...p.facts, [key]: fact } };
}

type RuleInput = Omit<Rule, "market" | "category" | "rule_key" | "title" | "fix" | "severity" | "confidence" | "version" | "citation"> &
  Partial<Pick<Rule, "market" | "category" | "rule_key" | "title" | "fix" | "severity" | "confidence" | "version" | "citation">>;

let counter = 0;

/** A verified rule with a plausible citation; override what the test is about. */
export function rule(input: RuleInput): Rule {
  counter += 1;
  return {
    market: "EU",
    category: "supplements",
    rule_key: `test-rule-${counter}`,
    title: "Test rule",
    fix: "Do the thing.",
    severity: "needs_attention",
    confidence: "verified",
    version: 1,
    citation: {
      regulation: "Test Regulation",
      article: "Art. 1",
      url: "https://example.org/reg",
      effective_from: "2020-01-01",
    },
    ...input,
  } as Rule;
}

export function snapshotOf(...rules: Rule[]): RulesSnapshot {
  return createSnapshot(rules);
}
