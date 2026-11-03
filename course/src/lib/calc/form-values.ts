import type { Field, Inputs, ScalarField } from "./types";

// What the form holds while she types (strings, so a field can be blank or
// half-typed) and the inputs the calculator takes (numbers, or undefined
// for blank). Pure, so it's shared by the browser and the tests.

export type FormScalar = string | boolean;
export type FormRow = Record<string, FormScalar>;
export type FormValues = Record<string, FormScalar | FormRow[]>;

function scalarToForm(field: ScalarField, value: unknown): FormScalar {
  if (field.kind === "yesno") return value === true;
  if (value === undefined || value === null) return "";
  return String(value);
}

function scalarFromForm(field: ScalarField, value: FormScalar | undefined): unknown {
  if (field.kind === "yesno") return value === true;
  const text = typeof value === "string" ? value.trim() : "";
  if (field.kind === "text") return text === "" && field.optional ? undefined : text;
  if (text === "") return undefined;
  const n = Number(text.replace(/[,\s$]/g, ""));
  return Number.isNaN(n) ? text : n;
}

export function toFormValues(fields: Field[], inputs: Inputs): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.kind === "rows") {
      const rows = Array.isArray(inputs[field.key]) ? (inputs[field.key] as Inputs[]) : [];
      values[field.key] = rows.map((row) =>
        Object.fromEntries(field.fields.map((f) => [f.key, scalarToForm(f, row[f.key])])),
      );
    } else values[field.key] = scalarToForm(field, inputs[field.key]);
  }
  return values;
}

export function fromFormValues(fields: Field[], values: FormValues): Inputs {
  const inputs: Inputs = {};
  for (const field of fields) {
    if (field.kind === "rows") {
      const rows = (values[field.key] as FormRow[] | undefined) ?? [];
      inputs[field.key] = rows.map((row) =>
        Object.fromEntries(field.fields.map((f) => [f.key, scalarFromForm(f, row[f.key])])),
      );
    } else inputs[field.key] = scalarFromForm(field, values[field.key] as FormScalar | undefined);
  }
  return inputs;
}

export function emptyRow(field: Extract<Field, { kind: "rows" }>): FormRow {
  return Object.fromEntries(field.fields.map((f) => [f.key, f.kind === "yesno" ? false : ""]));
}
