import { z } from "zod";

// The shape every calculator follows (SPEC.md → Calculator specs): a form
// schema, a pure compute function, and how to show the result. The schema
// is plain JSON, stored in calculators.schema_json and drawing the form;
// the formulas live only here, in code.
//
// Money is entered in her currency and stored as entered (calc_runs has the
// currency). Percentages are entered as whole numbers: 2.9 means 2.9%.

export type Colour = "green" | "amber" | "red";
export type CalcTier = "free" | "module0" | "course";

interface BaseField {
  key: string;
  label: string;
  help?: string;
}

export interface NumberField extends BaseField {
  kind: "money" | "percent" | "number" | "integer" | "days";
  default?: number;
  min?: number;
  max?: number;
  /** Optional fields may be left blank; compute gets undefined. */
  optional?: boolean;
}

export interface YesNoField extends BaseField {
  kind: "yesno";
}

export interface TextField extends BaseField {
  kind: "text";
  optional?: boolean;
  maxLength?: number;
}

export type ScalarField = NumberField | YesNoField | TextField;

export interface RowsField extends BaseField {
  kind: "rows";
  /** What one row is called on the "add" button: "comparable", "zone". */
  item: string;
  minRows: number;
  maxRows: number;
  fields: ScalarField[];
}

export type Field = ScalarField | RowsField;

export interface OutputSpec {
  key: string;
  label: string;
  kind: "money" | "percent" | "number" | "integer" | "days" | "colour" | "yesno" | "text";
  help?: string;
}

/** A table of rows in the result, e.g. one per shipping zone or month. */
export interface OutputTable {
  key: string;
  label: string;
  columns: OutputSpec[];
}

export type Inputs = Record<string, unknown>;
export type Outputs = Record<string, unknown>;

export interface Calculator<I extends Inputs = Inputs, O extends Outputs = Outputs> {
  slug: string;
  name: string;
  /** One line under the name in the library. */
  description: string;
  minTier: CalcTier;
  /** The course module it belongs to, if known; null keeps it module-less. */
  moduleNumber: number | null;
  fields: Field[];
  outputs: OutputSpec[];
  tables?: OutputTable[];
  /** Checks across fields that the field rules can't express. */
  validate?: (inputs: I) => string[];
  compute: (inputs: I) => O;
  /** One plain sentence about the result, in her currency. */
  sentence?: (outputs: O, money: (amount: number) => string) => string | null;
  /** The colour saved with the run, when the calculator gives one. */
  verdict?: (outputs: O) => Colour | null;
  /** Fill a field from another calculator's latest run, when she has no run of this one yet. */
  prefill?: Record<string, { from: string; output: string }>;
}

// ---------------------------------------------------------------------------
// Thresholds shared by Price Ladder, Product Verdict and the scorecard
// (SPEC.md: margin under 40 red, 40–55 amber, over 55 green).

export function marginColour(marginPct: number): Colour {
  if (marginPct < 40) return "red";
  if (marginPct <= 55) return "amber";
  return "green";
}

/** Margin as a percentage of price. */
export const marginPct = (price: number, cost: number) =>
  price > 0 ? ((price - cost) / price) * 100 : -Infinity;

// ---------------------------------------------------------------------------
// Inputs: parsed and checked against the field schema, on the server for
// every save and in the browser as she types.

function scalarSchema(field: ScalarField): z.ZodType {
  if (field.kind === "yesno") return z.boolean();
  if (field.kind === "text") {
    const text = z
      .string()
      .trim()
      .max(field.maxLength ?? 200);
    return field.optional ? text.optional() : text.min(1, `${field.label} is needed`);
  }
  let number = z.number({ error: `${field.label} needs a number` }).finite();
  if (field.kind === "integer" || field.kind === "days")
    number = number.int(`${field.label} needs a whole number`);
  const min = field.min ?? 0;
  number = number.min(min, `${field.label} can't be below ${min}`);
  if (field.max !== undefined)
    number = number.max(field.max, `${field.label} can't be above ${field.max}`);
  return field.optional ? number.optional() : number;
}

export function inputSchema(fields: Field[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (field.kind === "rows") {
      const row = z.object(Object.fromEntries(field.fields.map((f) => [f.key, scalarSchema(f)])));
      shape[field.key] = z
        .array(row)
        .min(
          field.minRows,
          `Add at least ${field.minRows} ${field.item}${field.minRows === 1 ? "" : "s"}`,
        )
        .max(field.maxRows, `Up to ${field.maxRows} ${field.item}s`);
    } else shape[field.key] = scalarSchema(field);
  }
  return z.object(shape);
}

export type ParseResult<I> = { ok: true; inputs: I } | { ok: false; problems: string[] };

export function parseInputs<I extends Inputs>(
  calc: { fields: Field[]; validate?: (inputs: I) => string[] },
  raw: unknown,
): ParseResult<I> {
  const parsed = inputSchema(calc.fields).safeParse(raw);
  if (!parsed.success)
    return { ok: false, problems: [...new Set(parsed.error.issues.map((issue) => issue.message))] };
  const inputs = parsed.data as I;
  const problems = calc.validate?.(inputs) ?? [];
  return problems.length ? { ok: false, problems } : { ok: true, inputs };
}

/** The form's starting values: each field's default, or blank. */
export function defaultInputs(fields: Field[]): Inputs {
  const values: Inputs = {};
  for (const field of fields) {
    if (field.kind === "rows")
      values[field.key] = Array.from({ length: Math.max(field.minRows, 1) }, () =>
        defaultInputs(field.fields),
      );
    else if (field.kind === "yesno") values[field.key] = false;
    else if (field.kind === "text") values[field.key] = "";
    else values[field.key] = field.default;
  }
  return values;
}

/** What goes into calculators.schema_json: the form and how to show results, no formulas. */
export function schemaJson(calc: Pick<Calculator, "fields" | "outputs" | "tables">) {
  return { fields: calc.fields, outputs: calc.outputs, tables: calc.tables ?? [] };
}
