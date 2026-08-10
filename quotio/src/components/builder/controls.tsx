"use client";

// Inspector controls.
//
// Small and boring on purpose. The inspector is where a non-technical person
// spends their time, so every control here is a labelled native input with a
// generous hit area — no custom dropdowns, no inline-editable divs, nothing
// that behaves differently from the rest of their computer (§14, §37).

import { ILLUSTRATION_KEYS, type IllustrationKey } from "@/lib/widget/illustrations";
import { Illustration } from "@/components/illustrations/Illustration";
import { CloseIcon } from "@/components/ui/Icons";
import { useId, useState } from "react";

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule px-4 py-5 last:border-b-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs leading-relaxed text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea
          className="input min-h-[74px] resize-y"
          value={value}
          rows={3}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="input"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  hint?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        className="input"
        value={value ?? ""}
        step={step}
        min={min}
        max={max}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : Number(event.target.value))
        }
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        className="input appearance-none bg-white pr-8"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-3 rounded-btn border border-rule p-3 ${
        disabled ? "opacity-60" : "cursor-pointer hover:border-muted"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-navy">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 flex-none accent-purple"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

/** Segmented control — for two-to-four mutually exclusive options. */
export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
}) {
  const name = useId();
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-1 rounded-btn border border-rule bg-lavender p-1" role="radiogroup">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex-1 cursor-pointer rounded-[10px] px-2 py-2 text-center text-xs font-semibold transition ${
              value === option.value ? "bg-white text-navy shadow-soft" : "text-slate hover:text-navy"
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </Field>
  );
}

export function ColourField({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches: string[];
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-10 w-12 cursor-pointer rounded-btn border border-rule bg-white p-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} colour picker`}
        />
        <input
          className="input font-mono text-xs uppercase"
          value={value}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
            if (/^#[0-9a-fA-F]{0,6}$/.test(next)) onChange(next);
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Use ${swatch}`}
            onClick={() => onChange(swatch)}
            className={`h-7 w-7 rounded-full border-2 transition ${
              value.toLowerCase() === swatch.toLowerCase() ? "border-navy" : "border-white"
            }`}
            style={{ background: swatch, boxShadow: "0 0 0 1px #E7EAF6" }}
          />
        ))}
      </div>
    </Field>
  );
}

/** Illustration picker: a popover grid, because a 36-item select is unusable. */
export function IllustrationField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: IllustrationKey;
  onChange: (value: IllustrationKey | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 rounded-btn border border-rule bg-white px-3 py-2 text-left text-sm transition hover:border-muted"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {value ? (
            <>
              <Illustration name={value} size={26} />
              <span className="capitalize">{value}</span>
            </>
          ) : (
            <span className="text-muted">None</span>
          )}
        </button>
        {value ? (
          <button
            type="button"
            className="btn-ghost px-2"
            onClick={() => onChange(undefined)}
            aria-label="Remove illustration"
          >
            <CloseIcon size={16} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 grid max-h-56 grid-cols-6 gap-1 overflow-y-auto rounded-btn border border-rule bg-white p-2">
          {ILLUSTRATION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={key}
              className={`grid place-items-center rounded-[10px] p-1.5 transition hover:bg-lavender ${
                value === key ? "bg-purple-soft" : ""
              }`}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
            >
              <Illustration name={key} size={26} />
            </button>
          ))}
        </div>
      ) : null}
    </Field>
  );
}

/** A row of removable list items with an add button — bullets, outcomes, etc. */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
  max = 6,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel: string;
  max?: number;
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              className="input"
              value={item}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="btn-ghost px-2"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(items.filter((_, position) => position !== index))}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
      {items.length < max ? (
        <button type="button" className="btn-ghost mt-2 px-2" onClick={() => onChange([...items, ""])}>
          + {addLabel}
        </button>
      ) : null}
    </Field>
  );
}

export function UpgradeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-btn border border-yellow/50 bg-yellow-soft px-3 py-2 text-xs leading-relaxed text-navy">
      {children}
    </p>
  );
}
