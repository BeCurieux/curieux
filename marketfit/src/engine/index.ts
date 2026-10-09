/**
 * The rules engine's public surface. Pure TypeScript: nothing under
 * `src/engine/` reads a file, a clock, a network or a model.
 * `tests/engine-purity.test.ts` holds that line.
 */

export { assess, evaluate, type Assessment, type AssessOptions, type Finding, type FindingStatus } from "./assess.js";
export { FACT_KEYS, readFact, type Fact, type FactKey, type FactSource, type Ingredient, type ProductFacts } from "./facts.js";
export {
  MARKET_CODES,
  RULE_KINDS,
  Rule,
  inForce,
  ruleId,
  type Citation,
  type Confidence,
  type MarketCode,
  type RuleKind,
  type Severity,
} from "./rules.js";
export { SCORES, SCORE_LABEL, scoreFindings, type Score } from "./score.js";
export { canonicalJson, createSnapshot, type RulesSnapshot } from "./snapshot.js";
export { MARKETS, type Market } from "./markets.js";
