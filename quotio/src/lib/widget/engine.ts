// The widget runtime (brief §44, phase 2 — "the most important code in the
// application").
//
// Given a widget document and a visitor's answers, this module decides which
// questions to show, runs the logic rules, computes the number or the winning
// outcome, and explains how it got there. It is pure, synchronous and has no
// React, no DOM and no network in it — so the same evaluation drives the
// builder preview, the hosted page, the embed and the test suite, and there is
// exactly one definition of what a widget "means".

import {
  compileExpression,
  evaluate,
  evaluateExpression,
  toNumber,
  type Scope,
} from "./expression";
import { formatValue, interpolate } from "./format";
import {
  conditionsOf,
  isAnyMatch,
  type Condition,
  type LogicRule,
  type ResultOutcome,
  type RuleWhen,
  type WidgetDocument,
  type WidgetStep,
} from "./schema";

export type Answers = Record<string, unknown>;

/** One line of "See price breakdown" (§19). */
export interface BreakdownLine {
  label: string;
  amount: number;
  /** Rules that multiply or set show their effect, not a signed amount. */
  kind: "base" | "input" | "rule";
}

export interface WidgetEvaluation {
  /** Steps a visitor should actually be asked, in order, after branching. */
  steps: WidgetStep[];
  /** Variable scope: every visible field, plus `total`. */
  scope: Scope;
  /** Running total after logic rules, before the result formula. */
  total: number;
  /** The final number the result formula produced. */
  value: number;
  /** Populated for `kind: "range"`. */
  range: { low: number; high: number } | null;
  /** Formatted headline number, ready to render ("$165" or "$165–$198"). */
  display: string;
  /** Quiz/scorecard points per outcome id. */
  scores: Record<string, number>;
  /** The winning outcome, for recommendation and score results. */
  outcome: ResultOutcome | null;
  /** Extra lines contributed by rules with a `message` action. */
  messages: string[];
  breakdown: BreakdownLine[];
  /** Copy with `{{field}}` tokens already substituted. */
  heading: string;
  description: string;
  bullets: string[];
}

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

/** Compare an answer against a rule's expected value. */
export function testCondition(condition: Condition, answers: Answers): boolean {
  const actual = answers[condition.field];
  const expected = condition.value;

  switch (condition.operator) {
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);

    case "contains":
    case "not_contains": {
      const hit = containsValue(actual, expected);
      return condition.operator === "contains" ? hit : !hit;
    }

    case "=":
    case "!=": {
      const same = looseEquals(actual, expected);
      return condition.operator === "=" ? same : !same;
    }

    case ">":
      return toNumber(actual) > toNumber(expected);
    case ">=":
      return toNumber(actual) >= toNumber(expected);
    case "<":
      return toNumber(actual) < toNumber(expected);
    case "<=":
      return toNumber(actual) <= toNumber(expected);
  }
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return false;
}

/** Loose so `"3"` from a text input matches the number `3` in a rule. */
function looseEquals(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (typeof expected === "boolean") return Boolean(actual) === expected;
  if (actual === undefined || actual === null || expected === undefined) return false;
  if (Array.isArray(actual)) return actual.some((item) => looseEquals(item, expected));
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

/** "contains" works on multi-selects and on free text alike. */
function containsValue(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return false;
  if (Array.isArray(actual)) return actual.some((item) => looseEquals(item, expected));
  if (typeof actual === "string") {
    return actual.toLowerCase().includes(String(expected).toLowerCase());
  }
  return looseEquals(actual, expected);
}

export function ruleMatches(rule: LogicRule, answers: Answers): boolean {
  return matchesWhen(rule.when, answers);
}

function matchesWhen(when: RuleWhen, answers: Answers): boolean {
  const conditions = conditionsOf(when);
  return isAnyMatch(when)
    ? conditions.some((condition) => testCondition(condition, answers))
    : conditions.every((condition) => testCondition(condition, answers));
}

/* ------------------------------------------------------------------ */
/* Visibility                                                          */
/* ------------------------------------------------------------------ */

/**
 * Which steps to ask, after `show`/`hide` rules have had their say.
 *
 * Visibility is resolved against every answer given so far, in one pass, in
 * rule order — later rules win. Keeping it single-pass means a widget can't
 * oscillate between two rules that hide each other, which would be a hang
 * rather than a wrong answer.
 */
export function visibleSteps(doc: WidgetDocument, answers: Answers): WidgetStep[] {
  const shown = new Map<string, boolean>();
  for (const step of doc.steps) shown.set(step.id, !step.hidden);

  for (const rule of doc.logic) {
    if (!ruleMatches(rule, answers)) continue;
    if (rule.then.show) shown.set(rule.then.show, true);
    if (rule.then.hide) shown.set(rule.then.hide, false);
  }

  return doc.steps.filter((step) => shown.get(step.id) === true);
}

/** A step's default answer, used before the visitor has touched it. */
export function defaultAnswer(step: WidgetStep): unknown {
  switch (step.input.kind) {
    case "choice":
      return step.input.multiple ? [] : undefined;
    case "number":
      return step.input.defaultValue;
    case "slider":
      return step.input.defaultValue ?? step.input.min;
    case "toggle":
      return step.input.defaultValue;
    case "text":
    case "email":
      return "";
  }
}

/** Every step's default, as a starting answer set. */
export function defaultAnswers(doc: WidgetDocument): Answers {
  const answers: Answers = {};
  for (const step of doc.steps) {
    const value = defaultAnswer(step);
    if (value !== undefined) answers[step.id] = value;
  }
  return answers;
}

/** Has this step been answered well enough to move on? */
export function isAnswered(step: WidgetStep, answers: Answers): boolean {
  const value = answers[step.id];
  if (!step.required) return true;
  if (step.input.kind === "toggle") return true; // a toggle always has a state
  if (step.input.kind === "email") {
    return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }
  return !isEmpty(value);
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Run a widget.
 *
 * The order matters and is fixed:
 *   1. work out which steps are visible;
 *   2. build a scope from the visible steps only — an answer to a question
 *      the visitor never saw must not change the price;
 *   3. apply logic rules to the running total, in author order;
 *   4. evaluate the result formula with `total` in scope;
 *   5. pick an outcome and format everything for display.
 */
export function evaluateWidget(doc: WidgetDocument, answers: Answers): WidgetEvaluation {
  const steps = visibleSteps(doc, answers);

  const scope: Scope = {};
  for (const step of steps) {
    const raw = answers[step.id];
    scope[step.id] = raw === undefined ? defaultAnswer(step) : raw;
  }

  const breakdown: BreakdownLine[] = [];
  const messages: string[] = [];
  const scores: Record<string, number> = {};
  let forcedOutcome: string | null = null;

  for (const outcome of doc.result.outcomes) scores[outcome.id] = 0;

  // Points carried by the chosen answers themselves (§18, quiz scoring).
  for (const step of steps) {
    if (step.input.kind !== "choice") continue;
    const answer = scope[step.id];
    const chosen = Array.isArray(answer) ? answer : [answer];
    for (const option of step.input.options) {
      if (!option.scores) continue;
      if (!chosen.some((value) => looseEquals(value, option.value))) continue;
      for (const [outcomeId, points] of Object.entries(option.scores)) {
        scores[outcomeId] = (scores[outcomeId] ?? 0) + points;
      }
    }
  }

  let total = doc.result.baseValue;
  if (total !== 0) breakdown.push({ label: "Starting price", amount: total, kind: "base" });

  for (const rule of doc.logic) {
    if (!matchesWhen(rule.when, scope)) continue;
    const { then } = rule;
    const label = rule.label ?? describeRule(rule, doc);

    if (then.set !== undefined) {
      total = amountOf(then.set, scope, total);
      breakdown.push({ label, amount: total, kind: "rule" });
    }
    if (then.add !== undefined) {
      const amount = amountOf(then.add, scope, total);
      total += amount;
      breakdown.push({ label, amount, kind: "rule" });
    }
    if (then.subtract !== undefined) {
      const amount = amountOf(then.subtract, scope, total);
      total -= amount;
      breakdown.push({ label, amount: -amount, kind: "rule" });
    }
    if (then.multiply !== undefined) {
      const factor = amountOf(then.multiply, scope, total);
      const before = total;
      total *= factor;
      breakdown.push({ label, amount: total - before, kind: "rule" });
    }
    if (then.score) {
      scores[then.score.outcome] = (scores[then.score.outcome] ?? 0) + then.score.points;
    }
    if (then.outcome) forcedOutcome = then.outcome;
    if (then.message) messages.push(interpolate(then.message, scope));
  }

  scope.total = total;

  const value = evaluateExpression(doc.result.expression, scope, total);
  scope.value = value;

  // If the formula (rather than the rules) is doing the work, explain the
  // formula instead — see itemiseInputs for why this is safe to show.
  if (doc.result.expression.trim() !== "total") {
    breakdown.push(...itemiseInputs(doc, steps, scope, value, breakdown));
  }

  const range =
    doc.result.kind === "range"
      ? { low: value, high: value * (1 + doc.result.rangeSpread) }
      : null;

  const outcome = pickOutcome(doc.result.outcomes, scores, forcedOutcome);

  const display = range
    ? `${formatValue(range.low, doc.result.format)}–${formatValue(range.high, doc.result.format)}`
    : formatValue(value, doc.result.format);

  return {
    steps,
    scope,
    total,
    value,
    range,
    display,
    scores,
    outcome,
    messages,
    breakdown,
    heading: interpolate(doc.result.heading, scope),
    description: interpolate(doc.result.description ?? "", scope),
    bullets: doc.result.bullets.map((bullet) => interpolate(bullet, scope)),
  };
}

function amountOf(amount: number | string, scope: Scope, total: number): number {
  if (typeof amount === "number") return amount;
  return evaluateExpression(amount, { ...scope, total }, 0);
}

/**
 * Pick the winning outcome: an explicit rule beats the highest score, and the
 * first outcome is the fallback so a result screen is never blank.
 * Ties go to whichever outcome the author listed first, which makes the
 * behaviour stable rather than dependent on object key order.
 */
export function pickOutcome(
  outcomes: ResultOutcome[],
  scores: Record<string, number>,
  forced: string | null
): ResultOutcome | null {
  if (outcomes.length === 0) return null;
  if (forced) {
    const match = outcomes.find((outcome) => outcome.id === forced);
    if (match) return match;
  }

  let best = outcomes[0];
  let bestScore = scores[best.id] ?? 0;
  for (const outcome of outcomes.slice(1)) {
    const score = scores[outcome.id] ?? 0;
    if (score > bestScore) {
      best = outcome;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Break a formula-driven total into per-question lines by measuring what each
 * answer is worth: evaluate the formula, then evaluate it again with that one
 * field zeroed, and take the difference. For the linear pricing formulas this
 * product generates ("bedrooms * 35 + bathrooms * 25") that is exactly the
 * itemisation a customer expects to see.
 *
 * It is only *exactly* right for linear formulas, so the lines are discarded
 * unless they add up to the total. A breakdown that doesn't reconcile is worse
 * than no breakdown at all (§41 — no fake functionality).
 */
function itemiseInputs(
  doc: WidgetDocument,
  steps: WidgetStep[],
  scope: Scope,
  value: number,
  existing: BreakdownLine[]
): BreakdownLine[] {
  let compiled;
  try {
    compiled = compileExpression(doc.result.expression);
  } catch {
    return [];
  }

  const used = new Set(compiled.variables);
  const scoredSteps = steps.filter((step) => used.has(step.id));
  if (scoredSteps.length === 0) return [];

  // What the formula is worth with every question answered as zero. For a
  // linear formula this is the part the questions don't explain — which is
  // the rules' running total, already itemised above.
  const floor: Scope = { ...scope };
  for (const step of scoredSteps) floor[step.id] = 0;
  const baseline = evaluate(compiled.ast, floor);

  const lines: BreakdownLine[] = [];
  let contributions = 0;
  for (const step of scoredSteps) {
    const without = evaluate(compiled.ast, { ...scope, [step.id]: 0 });
    const contribution = value - without;
    contributions += contribution;
    if (Math.abs(contribution) < 0.005) continue;
    lines.push({ label: step.title, amount: contribution, kind: "input" });
  }

  const ruleTotal = existing.reduce((sum, line) => sum + line.amount, 0);
  const explainsBaseline = Math.abs(baseline - ruleTotal) < 0.01;
  const addsUp = Math.abs(ruleTotal + contributions - value) < 0.01;

  return explainsBaseline && addsUp ? lines : [];
}

/**
 * Turn a rule into the sentence the builder shows and the breakdown labels:
 * "Bedrooms is 4 or more". Authors can override it with `label`.
 */
export function describeRule(rule: LogicRule, doc: WidgetDocument): string {
  const titles = new Map(doc.steps.map((step) => [step.id, step.title]));
  const parts = conditionsOf(rule.when).map((condition) => {
    const name = titles.get(condition.field) ?? condition.field;
    return `${name} ${describeOperator(condition.operator)} ${condition.value ?? ""}`.trim();
  });
  return parts.join(isAnyMatch(rule.when) ? " or " : " and ");
}

export function describeOperator(operator: Condition["operator"]): string {
  switch (operator) {
    case "=":
      return "is";
    case "!=":
      return "is not";
    case ">":
      return "is more than";
    case ">=":
      return "is at least";
    case "<":
      return "is less than";
    case "<=":
      return "is at most";
    case "contains":
      return "includes";
    case "not_contains":
      return "does not include";
    case "is_empty":
      return "is blank";
    case "is_not_empty":
      return "is answered";
  }
}
