"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveRun, type SaveResult } from "@/app/tools/actions";
import { calculator } from "@/lib/calc";
import { formatMoney, type Currency } from "@/lib/calc/format";
import { emptyRow, fromFormValues, type FormRow, type FormValues } from "@/lib/calc/form-values";
import { parseInputs, type Field, type ScalarField } from "@/lib/calc/types";
import { Result } from "./result";

// The schema-driven form for one calculator. Results update as she types;
// a second after she stops, valid inputs are saved (the server recomputes
// them). Invalid inputs show what's wrong and aren't saved.

const SAVE_DELAY_MS = 1000;

const UNIT: Partial<Record<ScalarField["kind"], string>> = { percent: "%", days: "days" };

function ScalarInput({
  field,
  id,
  value,
  onChange,
  currency,
  label,
}: {
  field: ScalarField;
  id: string;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  currency: Currency;
  label: string;
}) {
  if (field.kind === "yesno") {
    return (
      <fieldset>
        <legend className="font-semibold">{label}</legend>
        {field.help ? <p className="text-mute text-base">{field.help}</p> : null}
        <div className="mt-2 flex gap-3">
          {[true, false].map((option) => (
            <label
              key={String(option)}
              className="border-line bg-paper flex items-center gap-2 rounded-full border px-4 py-2"
            >
              <input
                type="radio"
                name={id}
                checked={value === option}
                onChange={() => onChange(option)}
                className="size-5"
              />
              {option ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const numeric = field.kind !== "text";
  const prefix = field.kind === "money" ? (currency === "AUD" ? "A$" : "US$") : null;
  const suffix = UNIT[field.kind];
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {field.help ? (
        <p id={`${id}-help`} className="text-mute text-base">
          {field.help}
        </p>
      ) : null}
      <div className="border-line bg-paper focus-within:outline-accent mt-1 flex items-center rounded-xl border focus-within:outline-2">
        {prefix ? (
          <span className="text-mute pl-4" aria-hidden>
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode={
            numeric
              ? field.kind === "integer" || field.kind === "days"
                ? "numeric"
                : "decimal"
              : "text"
          }
          autoComplete="off"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={field.help ? `${id}-help` : undefined}
          className="w-full min-w-0 bg-transparent px-3 py-3 text-lg outline-none"
        />
        {suffix ? (
          <span className="text-mute pr-4" aria-hidden>
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  values,
  setValues,
  currency,
}: {
  field: Field;
  values: FormValues;
  setValues: (update: (values: FormValues) => FormValues) => void;
  currency: Currency;
}) {
  if (field.kind !== "rows") {
    return (
      <ScalarInput
        field={field}
        id={`f-${field.key}`}
        label={field.label}
        value={values[field.key] as string | boolean}
        onChange={(value) => setValues((v) => ({ ...v, [field.key]: value }))}
        currency={currency}
      />
    );
  }
  const rows = (values[field.key] as FormRow[]) ?? [];
  const setRows = (update: (rows: FormRow[]) => FormRow[]) =>
    setValues((v) => ({ ...v, [field.key]: update((v[field.key] as FormRow[]) ?? []) }));
  return (
    <fieldset>
      <legend className="text-lg font-semibold">{field.label}</legend>
      {field.help ? <p className="text-mute text-base">{field.help}</p> : null}
      <ol className="mt-2 space-y-3">
        {rows.map((row, index) => (
          <li key={index} className="border-line rounded-2xl border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {field.fields.map((sub) => (
                <ScalarInput
                  key={sub.key}
                  field={sub}
                  id={`f-${field.key}-${index}-${sub.key}`}
                  label={`${sub.label}, ${field.item} ${index + 1}`}
                  value={row[sub.key] ?? ""}
                  onChange={(value) =>
                    setRows((all) =>
                      all.map((r, i) => (i === index ? { ...r, [sub.key]: value } : r)),
                    )
                  }
                  currency={currency}
                />
              ))}
            </div>
            {rows.length > field.minRows ? (
              <button
                type="button"
                onClick={() => setRows((all) => all.filter((_, i) => i !== index))}
                className="text-mute mt-3 underline underline-offset-4"
              >
                Remove {field.item} {index + 1}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {rows.length < field.maxRows ? (
        <button
          type="button"
          onClick={() => setRows((all) => [...all, emptyRow(field)])}
          className="border-accent text-accent mt-3 rounded-full border px-4 py-2 font-semibold"
        >
          Add a {field.item}
        </button>
      ) : null}
    </fieldset>
  );
}

const STATUS_TEXT = (
  status: SaveResult | { status: "idle" | "saving" },
  lastSaved: string | null,
) => {
  if (status.status === "saving") return "Saving…";
  if (status.status === "error") return status.message;
  if (lastSaved)
    return `Saved ${new Date(lastSaved).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`;
  return "Your numbers save as you go.";
};

export function CalculatorForm({
  slug,
  initial,
  lastSavedAt,
  currency,
}: {
  slug: string;
  initial: FormValues;
  lastSavedAt: string | null;
  currency: Currency;
}) {
  const calc = calculator(slug)!;
  const [values, setValues] = useState<FormValues>(initial);
  const [status, setStatus] = useState<SaveResult | { status: "idle" | "saving" }>({
    status: "idle",
  });
  const [lastSaved, setLastSaved] = useState<string | null>(lastSavedAt);
  const [, startTransition] = useTransition();
  const first = useRef(true);

  const parsed = useMemo(
    () => parseInputs(calc, fromFormValues(calc.fields, values)),
    [calc, values],
  );
  const outputs = parsed.ok ? calc.compute(parsed.inputs) : null;
  const money = (n: number) => formatMoney(n, currency);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!parsed.ok) return;
    const timer = setTimeout(() => {
      setStatus({ status: "saving" });
      startTransition(async () => {
        const result = await saveRun(slug, parsed.inputs);
        setStatus(result);
        if (result.status === "saved") setLastSaved(result.savedAt);
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [parsed, slug]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        className="space-y-5"
        onSubmit={(event) => event.preventDefault()}
        aria-label={`${calc.name} inputs`}
      >
        {calc.fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            values={values}
            setValues={setValues}
            currency={currency}
          />
        ))}
      </form>
      <section aria-labelledby="result-heading" className="lg:sticky lg:top-6 lg:self-start">
        <h2 id="result-heading" className="text-2xl">
          Result
        </h2>
        <div className="mt-3">
          {outputs ? (
            <Result
              outputs={outputs}
              specs={calc.outputs}
              tables={calc.tables}
              sentence={calc.sentence?.(outputs, money) ?? null}
              currency={currency}
            />
          ) : (
            <div className="border-line bg-paper rounded-2xl border p-4" data-testid="needs">
              <p>Fill in the numbers to see the result.</p>
              {!parsed.ok && parsed.problems.length ? (
                <ul className="text-mute mt-2 list-disc pl-5">
                  {parsed.problems.slice(0, 4).map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
        <p
          className="text-mute mt-3"
          role="status"
          data-testid="save-status"
          suppressHydrationWarning
        >
          {STATUS_TEXT(status, lastSaved)}
        </p>
      </section>
    </div>
  );
}
