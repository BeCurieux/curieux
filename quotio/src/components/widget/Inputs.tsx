"use client";

// The six input types (brief §12), rendered.
//
// Each one wraps a real HTML control — radio, checkbox, number, range,
// checkbox, text, email — with the card styling on the label. That is the
// whole accessibility strategy (§37): keyboard behaviour, screen-reader
// announcement, form semantics and focus order are the browser's job, and we
// only paint. Nothing here is a div pretending to be a control.

import { Illustration } from "@/components/illustrations/Illustration";
import { CheckIcon } from "@/components/ui/Icons";
import type { ChoiceOption, WidgetStep } from "@/lib/widget/schema";

interface StepInputProps {
  step: WidgetStep;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Auto-advance on single choice. Off in the builder preview. */
  onCommit?: () => void;
  /** Unique per render surface so preview and page radios never collide. */
  namespace: string;
  /**
   * Which answer cards the visitor actually clicked.
   *
   * Answers are stored as *values* because that's what the maths needs, but
   * two answers may legitimately share one — "Not sure" is priced as a
   * 2-bedroom. Ticking by value therefore lights up both. The chosen ids are
   * carried separately so the highlight follows the click.
   */
  chosenIds?: string[];
  onChoose?: (ids: string[]) => void;
}

export function StepInput({
  step,
  value,
  onChange,
  onCommit,
  namespace,
  chosenIds,
  onChoose,
}: StepInputProps) {
  const name = `${namespace}-${step.id}`;

  switch (step.input.kind) {
    case "choice":
      return (
        <ChoiceField
          step={step}
          input={step.input}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          name={name}
          chosenIds={chosenIds}
          onChoose={onChoose}
        />
      );

    case "number":
      return (
        <div className="mx-auto flex max-w-sm items-center gap-2">
          {step.input.prefix ? (
            <span className="qw-muted text-lg font-semibold">{step.input.prefix}</span>
          ) : null}
          <input
            type="number"
            className="qw-field text-center text-lg font-semibold"
            inputMode="decimal"
            value={typeof value === "number" ? value : ""}
            min={step.input.min}
            max={step.input.max}
            step={step.input.step}
            placeholder={step.input.placeholder ?? "0"}
            aria-labelledby={`${name}-label`}
            onChange={(event) =>
              onChange(event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
          {step.input.suffix ? (
            <span className="qw-muted text-lg font-semibold">{step.input.suffix}</span>
          ) : null}
        </div>
      );

    case "slider": {
      const { min, max, step: increment, prefix, suffix } = step.input;
      const current = typeof value === "number" ? value : (step.input.defaultValue ?? min);
      return (
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-center">
            <span className="text-3xl font-bold tracking-tight">
              {prefix ?? ""}
              {current.toLocaleString()}
              {suffix ?? ""}
            </span>
          </div>
          <input
            type="range"
            className="qw-slider"
            min={min}
            max={max}
            step={increment}
            value={current}
            aria-labelledby={`${name}-label`}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <div className="qw-faint mt-1 flex justify-between text-xs font-medium">
            <span>
              {prefix ?? ""}
              {min.toLocaleString()}
              {suffix ?? ""}
            </span>
            <span>
              {prefix ?? ""}
              {max.toLocaleString()}
              {suffix ?? ""}
            </span>
          </div>
        </div>
      );
    }

    case "toggle": {
      const on = value === true;
      return (
        <div className="mx-auto max-w-md">
          <label
            className="qw-option qw-option--row cursor-pointer justify-between"
            data-on={on}
            data-selected={on}
          >
            <span className="flex items-center gap-3">
              {step.input.illustration ? (
                <Illustration name={step.input.illustration} size={36} />
              ) : null}
              <span className="font-semibold">{on ? step.input.onLabel : step.input.offLabel}</span>
            </span>
            <input
              type="checkbox"
              checked={on}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span className="qw-switch" aria-hidden="true" />
          </label>
        </div>
      );
    }

    case "text":
      return step.input.multiline ? (
        <textarea
          className="qw-field mx-auto block max-w-lg"
          rows={4}
          maxLength={step.input.maxLength}
          placeholder={step.input.placeholder}
          value={typeof value === "string" ? value : ""}
          aria-labelledby={`${name}-label`}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type="text"
          className="qw-field mx-auto block max-w-lg"
          maxLength={step.input.maxLength}
          placeholder={step.input.placeholder}
          value={typeof value === "string" ? value : ""}
          aria-labelledby={`${name}-label`}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "email":
      return (
        <input
          type="email"
          className="qw-field mx-auto block max-w-lg"
          autoComplete="email"
          placeholder={step.input.placeholder ?? "you@example.com"}
          value={typeof value === "string" ? value : ""}
          aria-labelledby={`${name}-label`}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

/* ------------------------------------------------------------------ */
/* Choice                                                              */
/* ------------------------------------------------------------------ */

/**
 * Layout is inferred, not configured.
 *
 * Answers with pictures want a grid of squares; six-word answers want full
 * width rows you can actually read. Asking the user to choose would be one
 * more setting for no gain (§46), so the renderer looks at the content.
 */
function chooseLayout(options: ChoiceOption[], columns: 2 | 3): { className: string; row: boolean } {
  const hasArt = options.some((option) => option.illustration);
  const longest = Math.max(...options.map((option) => option.label.length));
  // A short caption like "Bedrooms" sits happily under a number in a grid;
  // only a real sentence needs a full-width row.
  const longestDescription = Math.max(
    0,
    ...options.map((option) => option.description?.length ?? 0)
  );

  if (!hasArt && (longest > 24 || longestDescription > 28)) {
    return { className: "qw-grid-1", row: true };
  }
  return { className: columns === 2 ? "qw-grid-2" : "qw-grid-3", row: false };
}

function ChoiceField({
  step,
  input,
  value,
  onChange,
  onCommit,
  name,
  chosenIds,
  onChoose,
}: {
  step: WidgetStep;
  input: Extract<WidgetStep["input"], { kind: "choice" }>;
  value: unknown;
  onChange: (value: unknown) => void;
  onCommit?: () => void;
  name: string;
  chosenIds?: string[];
  onChoose?: (ids: string[]) => void;
}) {
  const layout = chooseLayout(input.options, input.columns);

  // Prefer the ids the visitor clicked; fall back to matching on value for
  // surfaces that don't track them (a widget rendered from saved answers).
  const clicked = chosenIds ? new Set(chosenIds) : null;
  const byValue = new Set(
    input.multiple ? (Array.isArray(value) ? value : []) : value === undefined ? [] : [value]
  );
  const isChosen = (option: ChoiceOption) =>
    clicked ? clicked.has(option.id) : byValue.has(option.value);

  const toggle = (option: ChoiceOption) => {
    if (!input.multiple) {
      onChange(option.value);
      onChoose?.([option.id]);
      // A single-choice answer is a complete thought — move on (§9).
      onCommit?.();
      return;
    }

    const nextIds = new Set(clicked ?? new Set<string>());
    if (!clicked) {
      // Seed from values on first interaction with an untracked field.
      for (const candidate of input.options) if (byValue.has(candidate.value)) nextIds.add(candidate.id);
    }
    if (nextIds.has(option.id)) nextIds.delete(option.id);
    else nextIds.add(option.id);

    onChoose?.([...nextIds]);
    onChange(
      input.options.filter((candidate) => nextIds.has(candidate.id)).map((candidate) => candidate.value)
    );
  };

  return (
    <div
      className={layout.className}
      role={input.multiple ? "group" : "radiogroup"}
      aria-labelledby={`${name}-label`}
    >
      {input.options.map((option) => {
        const isSelected = isChosen(option);
        // A count reads best as a big numeral with its unit underneath —
        // "2" over "Bedrooms" — with the picture below both.
        const isCount = !layout.row && option.label.length <= 3;

        const art = option.illustration ? (
          <Illustration name={option.illustration} size={layout.row ? 32 : 50} />
        ) : null;

        const text = (
          <span className={layout.row ? "flex-1" : ""}>
            <span
              className={`block font-bold leading-tight ${isCount ? "text-xl" : "text-sm font-semibold leading-snug"}`}
            >
              {option.label}
            </span>
            {option.description ? (
              <span className="qw-muted mt-0.5 block text-xs leading-snug">{option.description}</span>
            ) : null}
          </span>
        );

        return (
          <label
            key={option.id}
            className={`qw-option${layout.row ? " qw-option--row" : ""}`}
            data-selected={isSelected}
          >
            <input
              type={input.multiple ? "checkbox" : "radio"}
              name={name}
              value={String(option.value)}
              checked={isSelected}
              onChange={() => toggle(option)}
            />

            {/* Rows read left-to-right (picture, then words); grid cards read
                top-to-bottom (words, then picture), as in the reference. */}
            {layout.row ? (
              <>
                {art}
                {text}
              </>
            ) : (
              <>
                {text}
                {art}
              </>
            )}

            <span className="qw-tick">
              <CheckIcon size={12} strokeWidth={3} />
            </span>
          </label>
        );
      })}
      {step.required ? null : (
        <span className="sr-only">This question is optional.</span>
      )}
    </div>
  );
}
