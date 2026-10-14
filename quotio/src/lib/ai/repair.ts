// Making model output safe to load (brief §30).
//
// "Never allow malformed AI output to crash the builder." A model asked for a
// widget will occasionally return a field id with a space in it, an option
// without a value, a rule pointing at a question it renamed halfway through,
// or a formula referencing a variable that no longer exists. None of those are
// worth a failed generation, and none of them are safe to load as-is.
//
// So there are three lines of defence, in order:
//   1. repair()  — mechanical fixes that can't change intent.
//   2. Zod       — the shape is either right or it isn't.
//   3. prune()   — structural cross-references, dropped rather than guessed.
//
// Anything still broken after that is a failure the caller handles by
// regenerating once and then falling back to a template.

import {
  widgetSchemaSchema,
  validateStructure,
  conditionsOf,
  type WidgetDocument,
} from "@/lib/widget/schema";
import { isValidExpression } from "@/lib/widget/expression";
import { fieldise, slugify } from "@/lib/widget/format";
import { isIllustrationKey } from "@/lib/widget/illustrations";

type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Mechanical normalisation, applied before Zod sees the object.
 *
 * Every fix here is one where the intent is unambiguous — turning
 * "Bedrooms (approx)" into the field id `bedrooms`, giving an option the id
 * its label implies. Nothing here invents content.
 */
export function repair(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const doc: Loose = { ...raw };

  if (typeof doc.name !== "string" || doc.name.trim() === "") doc.name = "Untitled widget";
  if (!["calculator", "estimator", "quiz"].includes(String(doc.type))) doc.type = "calculator";

  // Models sometimes wrap everything one level deeper than asked.
  if (!Array.isArray(doc.steps) && isObject(doc.widget)) return repair(doc.widget);

  const usedFieldIds = new Set<string>();
  const steps = Array.isArray(doc.steps) ? doc.steps : [];
  const renames = new Map<string, string>();

  doc.steps = steps.filter(isObject).map((step, index) => {
    const next: Loose = { ...step };
    const original = typeof next.id === "string" ? next.id : "";
    const wanted = fieldise(original || String(next.title ?? `question ${index + 1}`), `field_${index + 1}`);

    let id = wanted;
    let suffix = 2;
    while (usedFieldIds.has(id)) id = `${wanted}_${suffix++}`;
    usedFieldIds.add(id);
    if (original && original !== id) renames.set(original, id);
    next.id = id;

    if (typeof next.title !== "string" || next.title.trim() === "") {
      next.title = titleise(id);
    }

    next.input = repairInput(next.input, id);
    return next;
  });

  // A rule written against the model's original id should survive our rename.
  if (Array.isArray(doc.logic)) {
    doc.logic = doc.logic.filter(isObject).map((rule, index) => {
      const next: Loose = { ...rule };
      if (typeof next.id !== "string" || !next.id) next.id = `rule_${index + 1}`;
      next.when = repairWhen(next.when, renames);
      next.then = repairThen(next.then, renames);
      return next;
    });
  }

  doc.result = repairResult(doc.result, renames);
  if (isObject(doc.theme)) doc.theme = repairTheme(doc.theme);

  return doc;
}

function titleise(id: string): string {
  const words = id.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function repairInput(raw: unknown, stepId: string): unknown {
  if (!isObject(raw)) return { kind: "text" };
  const input: Loose = { ...raw };

  // "multiple_choice", "select", "radio" all mean the same thing to a model.
  const kind = String(input.kind ?? input.type ?? "").toLowerCase();
  if (["choice", "select", "radio", "multiple_choice", "multiselect", "checkbox"].includes(kind)) {
    input.kind = "choice";
    if (["multiselect", "checkbox"].includes(kind)) input.multiple = true;
  } else if (["number", "numeric", "integer"].includes(kind)) {
    input.kind = "number";
  } else if (["slider", "range"].includes(kind)) {
    input.kind = "slider";
  } else if (["toggle", "boolean", "yes_no", "switch"].includes(kind)) {
    input.kind = "toggle";
  } else if (["email"].includes(kind)) {
    input.kind = "email";
  } else {
    input.kind = "text";
  }
  delete input.type;

  if (input.kind === "choice") {
    const options = Array.isArray(input.options) ? input.options : [];
    const seen = new Set<string>();
    input.options = options.filter(isObject).map((option, index) => {
      const next: Loose = { ...option };
      const label = typeof next.label === "string" && next.label ? next.label : `Option ${index + 1}`;
      next.label = label;

      let id = typeof next.id === "string" && next.id ? slugify(next.id, `o${index + 1}`) : slugify(label, `o${index + 1}`);
      while (seen.has(id)) id = `${id}_${index}`;
      seen.add(id);
      next.id = id;

      if (typeof next.value !== "number" && typeof next.value !== "string") next.value = index;
      if (next.illustration !== undefined && !isIllustrationKey(next.illustration)) {
        delete next.illustration;
      }
      if (isObject(next.scores)) {
        next.scores = Object.fromEntries(
          Object.entries(next.scores).filter(([, points]) => typeof points === "number")
        );
      } else {
        delete next.scores;
      }
      return next;
    });

    // A "choice" with fewer than two answers isn't a choice.
    if ((input.options as unknown[]).length < 2) {
      return { kind: "text", placeholder: `Your ${stepId.replace(/_/g, " ")}` };
    }
  }

  if (input.kind === "slider") {
    const min = typeof input.min === "number" ? input.min : 0;
    const max = typeof input.max === "number" ? input.max : min + 10;
    input.min = min;
    input.max = max > min ? max : min + 10;
  }

  if (input.illustration !== undefined && !isIllustrationKey(input.illustration)) {
    delete input.illustration;
  }

  return input;
}

function repairWhen(raw: unknown, renames: Map<string, string>): unknown {
  if (!isObject(raw)) return { field: "", operator: "is_not_empty" };
  if (Array.isArray(raw.all)) return { all: raw.all.filter(isObject).map((c) => renameField(c, renames)) };
  if (Array.isArray(raw.any)) return { any: raw.any.filter(isObject).map((c) => renameField(c, renames)) };
  return renameField(raw, renames);
}

function renameField(condition: Loose, renames: Map<string, string>): Loose {
  const next = { ...condition };
  const field = typeof next.field === "string" ? next.field : "";
  next.field = renames.get(field) ?? fieldise(field, field);

  // Models write "equals", "greater_than", "gte" for the same three symbols.
  const operator = String(next.operator ?? "=").toLowerCase();
  const map: Record<string, string> = {
    equals: "=",
    eq: "=",
    "==": "=",
    is: "=",
    not_equals: "!=",
    neq: "!=",
    greater_than: ">",
    gt: ">",
    greater_than_or_equal: ">=",
    gte: ">=",
    at_least: ">=",
    less_than: "<",
    lt: "<",
    less_than_or_equal: "<=",
    lte: "<=",
    includes: "contains",
    has: "contains",
    empty: "is_empty",
    not_empty: "is_not_empty",
  };
  next.operator = map[operator] ?? operator;
  return next;
}

function repairThen(raw: unknown, renames: Map<string, string>): unknown {
  if (!isObject(raw)) return { add: 0 };
  const next: Loose = { ...raw };

  // `{"then": {"action": "add", "value": 40}}` is a shape models like.
  if (typeof next.action === "string" && next.value !== undefined) {
    next[next.action] = next.value;
    delete next.action;
    delete next.value;
  }

  for (const key of ["show", "hide"] as const) {
    const target = next[key];
    if (typeof target === "string") next[key] = renames.get(target) ?? fieldise(target, target);
  }

  if (isObject(next.score)) {
    const score: Loose = { ...next.score };
    if (typeof score.outcome !== "string" && typeof score.category === "string") {
      score.outcome = score.category;
      delete score.category;
    }
    next.score = score;
  }

  return Object.keys(next).length === 0 ? { add: 0 } : next;
}

function repairResult(raw: unknown, renames: Map<string, string>): unknown {
  const result: Loose = isObject(raw) ? { ...raw } : {};

  if (typeof result.heading !== "string" || !result.heading.trim()) {
    result.heading = "Your result";
  }
  if (!["value", "range", "recommendation", "score"].includes(String(result.kind))) {
    result.kind = "value";
  }

  // The formula may be called any of three things and reference old ids.
  let expression = result.expression ?? result.formula ?? result.calculation;
  if (typeof expression === "number") expression = String(expression);
  if (typeof expression !== "string" || !expression.trim()) expression = "total";
  for (const [from, to] of renames) {
    expression = (expression as string).replace(identifierPattern(from), to);
  }
  result.expression = expression;
  delete result.formula;
  delete result.calculation;

  if (Array.isArray(result.outcomes)) {
    const seen = new Set<string>();
    result.outcomes = result.outcomes.filter(isObject).map((outcome, index) => {
      const next: Loose = { ...outcome };
      const title = typeof next.title === "string" && next.title ? next.title : `Result ${index + 1}`;
      next.title = title;
      let id = typeof next.id === "string" && next.id ? slugify(next.id, `r${index + 1}`) : slugify(title, `r${index + 1}`);
      while (seen.has(id)) id = `${id}_${index}`;
      seen.add(id);
      next.id = id;
      if (next.illustration !== undefined && !isIllustrationKey(next.illustration)) {
        delete next.illustration;
      }
      if (!Array.isArray(next.bullets)) delete next.bullets;
      return next;
    });
  }

  if (!Array.isArray(result.bullets)) delete result.bullets;
  if (isObject(result.cta) && typeof result.cta.label !== "string") delete result.cta;

  return result;
}

function repairTheme(raw: Loose): Loose {
  const theme = { ...raw };
  const colour = theme.brandColour ?? theme.brandColor ?? theme.colour ?? theme.color;
  if (typeof colour === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(colour)) {
    theme.brandColour = colour;
  } else {
    delete theme.brandColour;
  }
  delete theme.brandColor;
  delete theme.colour;
  delete theme.color;
  return theme;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a whole identifier, including ones a model wrote with punctuation in
 * them — `Number of Bedrooms!`. `\b` is no good here: it assumes both edges
 * are word characters, which is exactly what these names violate.
 */
function identifierPattern(name: string): RegExp {
  const before = /^[A-Za-z0-9_]/.test(name) ? "(?<![A-Za-z0-9_])" : "";
  const after = /[A-Za-z0-9_]$/.test(name) ? "(?![A-Za-z0-9_])" : "";
  return new RegExp(`${before}${escapeRegExp(name)}${after}`, "g");
}

/* ------------------------------------------------------------------ */
/* Structural pruning                                                  */
/* ------------------------------------------------------------------ */

/**
 * Remove cross-references that don't resolve, rather than trying to guess
 * what was meant.
 *
 * A dropped rule is a widget that's slightly less clever than intended. A
 * kept-but-broken rule is a wrong price on a customer's screen, so the
 * trade is not close.
 */
export function prune(doc: WidgetDocument): WidgetDocument {
  const fields = new Set(doc.steps.map((step) => step.id));
  const outcomes = new Set(doc.result.outcomes.map((outcome) => outcome.id));

  const logic = doc.logic.filter((rule) => {
    if (conditionsOf(rule.when).some((condition) => !fields.has(condition.field))) return false;
    for (const key of ["add", "subtract", "multiply", "set"] as const) {
      const amount = rule.then[key];
      if (typeof amount === "string" && !isValidExpression(amount, fields)) return false;
    }
    if (rule.then.show && !fields.has(rule.then.show)) return false;
    if (rule.then.hide && !fields.has(rule.then.hide)) return false;
    if (rule.then.outcome && !outcomes.has(rule.then.outcome)) return false;
    if (rule.then.score && !outcomes.has(rule.then.score.outcome)) return false;
    return true;
  });

  const result = { ...doc.result };
  if (!isValidExpression(result.expression, new Set([...fields, "total"]))) {
    result.expression = "total";
  }
  // A recommendation with nothing to recommend is a blank screen; show the
  // number instead, which at least means something.
  if ((result.kind === "recommendation" || result.kind === "score") && outcomes.size === 0) {
    result.kind = "value";
  }

  // Points awarded to outcomes that don't exist would silently never show.
  const steps = doc.steps.map((step) => {
    if (step.input.kind !== "choice") return step;
    return {
      ...step,
      input: {
        ...step.input,
        options: step.input.options.map((option) => {
          if (!option.scores) return option;
          const scores = Object.fromEntries(
            Object.entries(option.scores).filter(([id]) => outcomes.has(id))
          );
          return Object.keys(scores).length > 0 ? { ...option, scores } : { ...option, scores: undefined };
        }),
      },
    };
  });

  return { ...doc, steps, logic, result };
}

/**
 * The whole pipeline: repair → parse → prune → verify.
 * Returns null if the object cannot be made into a valid widget.
 */
export function parseGeneratedWidget(raw: unknown): WidgetDocument | null {
  const attempt = (input: unknown): WidgetDocument | null => {
    const parsed = widgetSchemaSchema.safeParse(input);
    if (!parsed.success) return null;
    const pruned = prune(parsed.data);
    return validateStructure(pruned).length === 0 ? pruned : null;
  };

  return attempt(raw) ?? attempt(repair(raw));
}
