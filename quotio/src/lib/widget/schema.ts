// The widget document (brief §12).
//
// One schema powers all three MVP types — calculator, estimator, quiz — and
// is deliberately general enough for the types listed as "later" in §3
// (scorecards, configurators, product finders, eligibility checkers, polls)
// without a migration: those are combinations of the same four things.
//
//     inputs  →  conditional logic  →  calculation / scoring  →  result + CTA
//
// Everything that crosses a trust boundary is parsed through `WidgetSchema`:
// AI output, API request bodies, and rows read back out of the database. If it
// isn't in this file, it can't get into a widget.

import { z } from "zod";
import { ILLUSTRATION_KEYS } from "./illustrations";
import { isValidExpression } from "./expression";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/**
 * A field id is also an expression variable, so it has to be a legal
 * identifier: lowercase, starts with a letter, no spaces. `bedrooms`, not
 * `Bedrooms (approx)`.
 */
export const fieldIdSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9_]*$/, "Field ids must be lowercase letters, numbers and underscores.");

export const idSchema = z.string().min(1).max(64);

export const slugSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugs are lowercase words separated by hyphens.");

export const hexColourSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour like #5B5FEF.");

export const illustrationSchema = z.enum(ILLUSTRATION_KEYS);

/** An answer value: a number for maths, a string for branching and quizzes. */
export const answerValueSchema = z.union([z.number(), z.string()]);

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export const choiceOptionSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  /** What this option contributes to expressions. Defaults to 0. */
  value: answerValueSchema.default(0),
  illustration: illustrationSchema.optional(),
  /** Quiz scoring: points added per outcome id when this option is chosen. */
  scores: z.record(z.number()).optional(),
});

export const choiceInputSchema = z.object({
  kind: z.literal("choice"),
  options: z.array(choiceOptionSchema).min(2).max(12),
  /** Multi-select renders checkboxes and produces an array of values. */
  multiple: z.boolean().default(false),
  /** Grid width on desktop; mobile always collapses to 1–2 (§36). */
  columns: z.union([z.literal(2), z.literal(3)]).default(3),
});

export const numberInputSchema = z.object({
  kind: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().default(1),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(16).optional(),
  placeholder: z.string().max(60).optional(),
  defaultValue: z.number().optional(),
});

export const sliderInputSchema = z.object({
  kind: z.literal("slider"),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(1),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(16).optional(),
  defaultValue: z.number().optional(),
});

export const toggleInputSchema = z.object({
  kind: z.literal("toggle"),
  onLabel: z.string().max(60).default("Yes"),
  offLabel: z.string().max(60).default("No"),
  defaultValue: z.boolean().default(false),
  illustration: illustrationSchema.optional(),
});

export const textInputSchema = z.object({
  kind: z.literal("text"),
  placeholder: z.string().max(120).optional(),
  multiline: z.boolean().default(false),
  maxLength: z.number().int().positive().max(2000).default(500),
});

export const emailInputSchema = z.object({
  kind: z.literal("email"),
  placeholder: z.string().max(120).optional(),
});

export const widgetInputSchema = z.discriminatedUnion("kind", [
  choiceInputSchema,
  numberInputSchema,
  sliderInputSchema,
  toggleInputSchema,
  textInputSchema,
  emailInputSchema,
]);

export const widgetStepSchema = z.object({
  /** Doubles as the expression variable name for this step's answer. */
  id: fieldIdSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(400).optional(),
  input: widgetInputSchema,
  required: z.boolean().default(true),
  /** Hidden until a logic rule shows it (§18). */
  hidden: z.boolean().default(false),
});

/* ------------------------------------------------------------------ */
/* Logic (§13, §18)                                                    */
/* ------------------------------------------------------------------ */

export const conditionOperatorSchema = z.enum([
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
]);

export const conditionSchema = z.object({
  field: fieldIdSchema,
  operator: conditionOperatorSchema,
  value: z.union([z.number(), z.string(), z.boolean()]).optional(),
});

/**
 * A rule fires when its condition matches. `all`/`any` exist so the UI can
 * offer "and"/"or" without ever exposing an expression language to the user.
 */
export const ruleWhenSchema = z.union([
  conditionSchema,
  z.object({ all: z.array(conditionSchema).min(1).max(8) }),
  z.object({ any: z.array(conditionSchema).min(1).max(8) }),
]);

/**
 * Actions use the brief's shorthand object form, so a rule reads as English
 * in JSON as well as in the builder:
 *
 *     { "when": { "field": "bedrooms", "operator": ">=", "value": 4 },
 *       "then": { "add": 40 } }
 *
 * `add`/`subtract`/`multiply`/`set` accept a number or a safe expression
 * string, so "add 15% for stairs" is `{ "multiply": "1.15" }` and
 * "add $12 per window" is `{ "add": "windows * 12" }`.
 */
const amountSchema = z.union([z.number(), z.string()]);

export const ruleThenSchema = z
  .object({
    add: amountSchema.optional(),
    subtract: amountSchema.optional(),
    multiply: amountSchema.optional(),
    set: amountSchema.optional(),
    /** Quiz scoring: `{ "score": { "outcome": "hydration", "points": 3 } }`. */
    score: z.object({ outcome: idSchema, points: z.number() }).optional(),
    /** Branching: show or hide a later step. */
    show: fieldIdSchema.optional(),
    hide: fieldIdSchema.optional(),
    /** Force a specific result outcome regardless of score. */
    outcome: idSchema.optional(),
    /** Extra line shown on the result card. */
    message: z.string().max(300).optional(),
  })
  .refine((then) => Object.keys(then).length > 0, "A rule needs at least one action.");

export const logicRuleSchema = z.object({
  id: idSchema,
  /** Shown in the builder's rule list; generated if absent. */
  label: z.string().max(160).optional(),
  when: ruleWhenSchema,
  then: ruleThenSchema,
});

/* ------------------------------------------------------------------ */
/* Result (§19)                                                        */
/* ------------------------------------------------------------------ */

export const valueFormatSchema = z.object({
  style: z.enum(["currency", "number", "percent", "duration"]).default("currency"),
  currency: z.string().length(3).default("USD"),
  decimals: z.number().int().min(0).max(4).default(0),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(16).optional(),
});

export const resultOutcomeSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(600).optional(),
  bullets: z.array(z.string().max(160)).max(6).default([]),
  illustration: illustrationSchema.optional(),
  /** Optional per-outcome CTA; falls back to the result's CTA. */
  cta: z.object({ label: z.string().max(60), url: z.string().max(500).optional() }).optional(),
});

export const resultConfigSchema = z.object({
  /**
   * value          a single number ("$165")
   * range          a spread around the number ("$165–$215")
   * recommendation the winning outcome card ("You need the Deep Clean")
   * score          a number plus the winning outcome ("72/100 — Growing")
   */
  kind: z.enum(["value", "range", "recommendation", "score"]).default("value"),
  heading: z.string().min(1).max(200),
  description: z.string().max(600).optional(),
  /**
   * Art for the result card. A calculated number has no outcome to hang a
   * picture on, and a bare figure on a white card is the thing §19 explicitly
   * warns against — so the result screen can carry its own.
   */
  illustration: illustrationSchema.optional(),
  /** Starting total before any logic rules run. */
  baseValue: z.number().default(0),
  /**
   * The calculation. Reads step fields plus `total` (the running total after
   * logic rules). Defaults to `total`, so rule-only widgets need no formula.
   */
  expression: z.string().max(2000).default("total"),
  format: valueFormatSchema.default({ style: "currency", currency: "USD", decimals: 0 }),
  /**
   * Range width, as a fraction above the calculated value: 0.2 turns $165
   * into "$165–$198". Quotes widen upwards, not both ways, because the
   * low end is the number the customer was promised.
   */
  rangeSpread: z.number().min(0).max(1).default(0.2),
  bullets: z.array(z.string().max(160)).max(6).default([]),
  cta: z
    .object({
      label: z.string().min(1).max(60),
      url: z.string().max(500).optional(),
    })
    .optional(),
  /** "See price breakdown" — an itemised list of what the rules contributed. */
  showBreakdown: z.boolean().default(true),
  /** Small print under the number ("This is an indicative estimate."). */
  disclaimer: z.string().max(300).optional(),
  outcomes: z.array(resultOutcomeSchema).max(12).default([]),
});

/* ------------------------------------------------------------------ */
/* Theme + settings (§17, §20)                                         */
/* ------------------------------------------------------------------ */

export const themePresetSchema = z.enum(["playful", "minimal", "bold", "soft", "editorial", "dark"]);
export const themeFontSchema = z.enum(["dm-sans", "inter", "poppins", "fraunces", "system"]);
export const themeRadiusSchema = z.enum(["s", "m", "l", "xl"]);
export const buttonStyleSchema = z.enum(["filled", "soft", "outline"]);

export const widgetThemeSchema = z.object({
  preset: themePresetSchema.default("playful"),
  brandColour: hexColourSchema.default("#5B5FEF"),
  font: themeFontSchema.default("dm-sans"),
  radius: themeRadiusSchema.default("l"),
  buttonStyle: buttonStyleSchema.default("filled"),
  logoUrl: z.string().max(500).optional(),
});

export const leadFieldSchema = z.enum(["name", "email", "phone", "message"]);

export const widgetSettingsSchema = z.object({
  /** The step rail / progress bar (§9). */
  showProgress: z.boolean().default(true),
  leadCapture: z
    .object({
      /** Default is "after" — never hold the result hostage (§20). */
      mode: z.enum(["before", "after", "none"]).default("after"),
      fields: z.array(leadFieldSchema).min(1).max(4).default(["name", "email"]),
      heading: z.string().max(160).default("Where should we send this?"),
      description: z.string().max(300).optional(),
      required: z.boolean().default(false),
    })
    .default({}),
  /** The "Made with" badge. Forced on for free plans (§22, §35). */
  showBadge: z.boolean().default(true),
  /** Small print under the lead form. */
  privacyNote: z.string().max(200).default("Your info is safe with us. No spam, ever."),
});

/* ------------------------------------------------------------------ */
/* The widget                                                          */
/* ------------------------------------------------------------------ */

export const widgetTypeSchema = z.enum(["calculator", "estimator", "quiz"]);
export const widgetStatusSchema = z.enum(["draft", "published"]);

export const widgetIntroSchema = z.object({
  heading: z.string().min(1).max(200),
  description: z.string().max(600).optional(),
  buttonLabel: z.string().max(60).default("Get started"),
  illustration: illustrationSchema.optional(),
});

/** The document as authored. Ids/slug/status live on the row, not in here. */
export const widgetSchemaSchema = z.object({
  name: z.string().min(1).max(120),
  type: widgetTypeSchema,
  intro: widgetIntroSchema.optional(),
  steps: z.array(widgetStepSchema).min(1).max(24),
  logic: z.array(logicRuleSchema).max(60).default([]),
  result: resultConfigSchema,
  theme: widgetThemeSchema.default({}),
  settings: widgetSettingsSchema.default({}),
});

/** The full record, as stored and as handed to the renderer. */
export const widgetSchema = widgetSchemaSchema.extend({
  id: idSchema,
  slug: slugSchema,
  status: widgetStatusSchema.default("draft"),
});

export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type WidgetInput = z.infer<typeof widgetInputSchema>;
export type WidgetStep = z.infer<typeof widgetStepSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;
export type RuleWhen = z.infer<typeof ruleWhenSchema>;
export type RuleThen = z.infer<typeof ruleThenSchema>;
export type LogicRule = z.infer<typeof logicRuleSchema>;
export type ResultOutcome = z.infer<typeof resultOutcomeSchema>;
export type ResultConfig = z.infer<typeof resultConfigSchema>;
export type ValueFormat = z.infer<typeof valueFormatSchema>;
export type WidgetTheme = z.infer<typeof widgetThemeSchema>;
export type WidgetSettings = z.infer<typeof widgetSettingsSchema>;
export type WidgetIntro = z.infer<typeof widgetIntroSchema>;
export type WidgetType = z.infer<typeof widgetTypeSchema>;
export type WidgetStatus = z.infer<typeof widgetStatusSchema>;
export type LeadField = z.infer<typeof leadFieldSchema>;
export type WidgetDocument = z.infer<typeof widgetSchemaSchema>;
export type Widget = z.infer<typeof widgetSchema>;

/* ------------------------------------------------------------------ */
/* Structural validation                                               */
/* ------------------------------------------------------------------ */

export interface StructuralIssue {
  path: string;
  message: string;
}

/**
 * Checks Zod can't express: cross-references between the parts of a widget.
 * Duplicate field ids, rules pointing at fields that don't exist, formulas
 * referencing removed steps, outcomes that nothing can select.
 *
 * Returned as a list rather than thrown, because the builder shows these as
 * gentle inline warnings while you're mid-edit — a half-finished widget is a
 * normal state, not an error (§14).
 */
export function validateStructure(doc: WidgetDocument): StructuralIssue[] {
  const issues: StructuralIssue[] = [];

  const seen = new Set<string>();
  for (const [index, step] of doc.steps.entries()) {
    if (seen.has(step.id)) {
      issues.push({ path: `steps[${index}].id`, message: `Two questions share the id "${step.id}".` });
    }
    seen.add(step.id);

    if (step.input.kind === "slider" && step.input.min >= step.input.max) {
      issues.push({ path: `steps[${index}].input`, message: "Slider maximum must be above its minimum." });
    }
    if (step.input.kind === "choice") {
      const optionIds = new Set<string>();
      for (const option of step.input.options) {
        if (optionIds.has(option.id)) {
          issues.push({
            path: `steps[${index}].input.options`,
            message: `Two answers share the id "${option.id}".`,
          });
        }
        optionIds.add(option.id);
      }
    }
  }

  // `total` is always in scope for the result formula.
  const resultFields = new Set([...seen, "total"]);
  const outcomeIds = new Set(doc.result.outcomes.map((outcome) => outcome.id));

  for (const [index, rule] of doc.logic.entries()) {
    for (const condition of conditionsOf(rule.when)) {
      if (!seen.has(condition.field)) {
        issues.push({
          path: `logic[${index}].when`,
          message: `Rule refers to "${condition.field}", which isn't a question.`,
        });
      }
    }

    for (const key of ["add", "subtract", "multiply", "set"] as const) {
      const amount = rule.then[key];
      if (typeof amount === "string" && !isValidExpression(amount, seen)) {
        issues.push({ path: `logic[${index}].then.${key}`, message: `"${amount}" isn't a valid formula.` });
      }
    }
    for (const key of ["show", "hide"] as const) {
      const target = rule.then[key];
      if (target && !seen.has(target)) {
        issues.push({ path: `logic[${index}].then.${key}`, message: `No question called "${target}".` });
      }
    }
    if (rule.then.outcome && !outcomeIds.has(rule.then.outcome)) {
      issues.push({ path: `logic[${index}].then.outcome`, message: `No result called "${rule.then.outcome}".` });
    }
    if (rule.then.score && !outcomeIds.has(rule.then.score.outcome)) {
      issues.push({
        path: `logic[${index}].then.score`,
        message: `No result called "${rule.then.score.outcome}".`,
      });
    }
  }

  if (!isValidExpression(doc.result.expression, resultFields)) {
    issues.push({ path: "result.expression", message: `"${doc.result.expression}" isn't a valid formula.` });
  }

  if ((doc.result.kind === "recommendation" || doc.result.kind === "score") && outcomeIds.size === 0) {
    issues.push({ path: "result.outcomes", message: "This result type needs at least one outcome." });
  }

  return issues;
}

/** Flattens the `all`/`any`/bare shapes of `when` into a plain list. */
export function conditionsOf(when: RuleWhen): Condition[] {
  if ("all" in when) return when.all;
  if ("any" in when) return when.any;
  return [when];
}

/** True when every condition must hold (default) rather than any one. */
export function isAnyMatch(when: RuleWhen): boolean {
  return "any" in when;
}
