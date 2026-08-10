"use client";

// The Content tab (brief §16).
//
// Whatever is selected in the left rail is what this edits: the intro screen,
// one question, or the result. Nothing here mentions "schema", "field" or
// "node" — the words are Question, Answer, Price and Result (§40).

import { Illustration } from "@/components/illustrations/Illustration";
import { CloseIcon, PlusIcon } from "@/components/ui/Icons";
import {
  ColourField,
  Field,
  IllustrationField,
  ListEditor,
  NumberField,
  Section,
  SegmentedField,
  SelectField,
  TextField,
  ToggleField,
  UpgradeNote,
} from "./controls";
import type { EditorProps } from "./types";
import { isValidExpression } from "@/lib/widget/expression";
import { fieldise, slugify } from "@/lib/widget/format";
import type {
  ChoiceOption,
  ResultOutcome,
  WidgetDocument,
  WidgetInput,
  WidgetStep,
} from "@/lib/widget/schema";

export function ContentTab(props: EditorProps) {
  if (props.selection.kind === "intro") return <IntroEditor {...props} />;
  if (props.selection.kind === "result") return <ResultEditor {...props} />;
  return <StepEditor {...props} />;
}

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */

function IntroEditor({ doc, update }: EditorProps) {
  const intro = doc.intro;

  return (
    <>
      <Section title="Welcome screen" hint="A short hello before the first question. Optional.">
        <ToggleField
          label="Show a welcome screen"
          checked={Boolean(intro)}
          onChange={(checked) =>
            update((draft) => ({
              ...draft,
              intro: checked
                ? {
                    heading: draft.name,
                    description: "",
                    buttonLabel: "Get started",
                    illustration: undefined,
                  }
                : undefined,
            }))
          }
        />
      </Section>

      {intro ? (
        <Section title="What it says">
          <TextField
            label="Heading"
            value={intro.heading}
            maxLength={200}
            onChange={(value) =>
              update((draft) => ({ ...draft, intro: { ...draft.intro!, heading: value } }))
            }
          />
          <TextField
            label="Description"
            multiline
            maxLength={600}
            value={intro.description ?? ""}
            onChange={(value) =>
              update((draft) => ({ ...draft, intro: { ...draft.intro!, description: value } }))
            }
          />
          <TextField
            label="Button"
            value={intro.buttonLabel}
            maxLength={60}
            onChange={(value) =>
              update((draft) => ({ ...draft, intro: { ...draft.intro!, buttonLabel: value } }))
            }
          />
          <IllustrationField
            label="Picture"
            value={intro.illustration}
            onChange={(value) =>
              update((draft) => ({ ...draft, intro: { ...draft.intro!, illustration: value } }))
            }
          />
        </Section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

const INPUT_KINDS: Array<{ value: WidgetInput["kind"]; label: string }> = [
  { value: "choice", label: "Pick an answer" },
  { value: "toggle", label: "Yes / no" },
  { value: "slider", label: "Slider" },
  { value: "number", label: "Type a number" },
  { value: "text", label: "Type an answer" },
  { value: "email", label: "Email address" },
];

function StepEditor({ doc, update, selection }: EditorProps) {
  if (selection.kind !== "step") return null;
  const step = doc.steps.find((entry) => entry.id === selection.id);
  if (!step) return null;

  const patch = (mutate: (step: WidgetStep) => WidgetStep) =>
    update((draft) => ({
      ...draft,
      steps: draft.steps.map((entry) => (entry.id === step.id ? mutate(entry) : entry)),
    }));

  return (
    <>
      <Section title="The question">
        <TextField
          label="Question"
          value={step.title}
          maxLength={160}
          placeholder="How many bedrooms?"
          onChange={(value) => patch((current) => ({ ...current, title: value }))}
        />
        <TextField
          label="Description"
          multiline
          maxLength={400}
          placeholder="One short line of help. Optional."
          value={step.description ?? ""}
          onChange={(value) => patch((current) => ({ ...current, description: value }))}
        />
        <ToggleField
          label="Must be answered"
          hint="Off means a visitor can skip straight past it."
          checked={step.required}
          onChange={(checked) => patch((current) => ({ ...current, required: checked }))}
        />
      </Section>

      <Section title="The answer" hint={`Formulas refer to this question as “${step.id}”.`}>
        <SelectField
          label="Answer type"
          value={step.input.kind}
          options={INPUT_KINDS}
          onChange={(kind) => patch((current) => ({ ...current, input: convertInput(current, kind) }))}
        />
        <InputEditor step={step} patch={patch} doc={doc} />
      </Section>
    </>
  );
}

/** Change answer type without losing what can be carried across. */
function convertInput(step: WidgetStep, kind: WidgetInput["kind"]): WidgetInput {
  if (step.input.kind === kind) return step.input;

  switch (kind) {
    case "choice":
      return {
        kind: "choice",
        multiple: false,
        columns: 3,
        options: [
          { id: "one", label: "One", value: 1 },
          { id: "two", label: "Two", value: 2 },
          { id: "three", label: "Three", value: 3 },
        ],
      };
    case "number":
      return { kind: "number", step: 1, min: 0 };
    case "slider":
      return { kind: "slider", min: 0, max: 10, step: 1, defaultValue: 5 };
    case "toggle":
      return { kind: "toggle", onLabel: "Yes", offLabel: "No", defaultValue: false };
    case "email":
      return { kind: "email" };
    case "text":
    default:
      return { kind: "text", multiline: false, maxLength: 500 };
  }
}

function InputEditor({
  step,
  patch,
  doc,
}: {
  step: WidgetStep;
  patch: (mutate: (step: WidgetStep) => WidgetStep) => void;
  doc: WidgetDocument;
}) {
  const input = step.input;
  const setInput = (next: Partial<WidgetInput>) =>
    patch((current) => ({ ...current, input: { ...current.input, ...next } as WidgetInput }));

  switch (input.kind) {
    case "choice":
      return (
        <>
          <ToggleField
            label="Allow more than one answer"
            hint="Checkboxes instead of a single pick. Their values add up."
            checked={input.multiple}
            onChange={(checked) => setInput({ multiple: checked })}
          />
          <SegmentedField
            label="Answers per row"
            value={String(input.columns) as "2" | "3"}
            options={[
              { value: "2", label: "Two" },
              { value: "3", label: "Three" },
            ]}
            onChange={(value) => setInput({ columns: Number(value) as 2 | 3 })}
            hint="Narrow screens ignore this and stack the answers."
          />
          <OptionsEditor step={step} patch={patch} doc={doc} />
        </>
      );

    case "number":
      return (
        <>
          <NumberField label="Smallest allowed" value={input.min} onChange={(value) => setInput({ min: value })} />
          <NumberField label="Largest allowed" value={input.max} onChange={(value) => setInput({ max: value })} />
          <NumberField label="Steps of" value={input.step} onChange={(value) => setInput({ step: value ?? 1 })} />
          <TextField
            label="Prefix"
            value={input.prefix ?? ""}
            maxLength={8}
            placeholder="$"
            onChange={(value) => setInput({ prefix: value })}
          />
          <TextField
            label="Suffix"
            value={input.suffix ?? ""}
            maxLength={16}
            placeholder="miles"
            onChange={(value) => setInput({ suffix: value })}
          />
        </>
      );

    case "slider":
      return (
        <>
          <NumberField label="From" value={input.min} onChange={(value) => setInput({ min: value ?? 0 })} />
          <NumberField label="To" value={input.max} onChange={(value) => setInput({ max: value ?? 10 })} />
          <NumberField label="Steps of" value={input.step} onChange={(value) => setInput({ step: value ?? 1 })} />
          <NumberField
            label="Starts at"
            value={input.defaultValue}
            onChange={(value) => setInput({ defaultValue: value })}
          />
          <TextField
            label="Suffix"
            value={input.suffix ?? ""}
            maxLength={16}
            placeholder="guests"
            onChange={(value) => setInput({ suffix: value })}
          />
        </>
      );

    case "toggle":
      return (
        <>
          <TextField label="When on" value={input.onLabel} maxLength={60} onChange={(value) => setInput({ onLabel: value })} />
          <TextField label="When off" value={input.offLabel} maxLength={60} onChange={(value) => setInput({ offLabel: value })} />
          <ToggleField
            label="On by default"
            checked={input.defaultValue}
            onChange={(checked) => setInput({ defaultValue: checked })}
          />
          <IllustrationField
            label="Picture"
            value={input.illustration}
            onChange={(value) => setInput({ illustration: value })}
          />
        </>
      );

    case "text":
      return (
        <>
          <TextField
            label="Placeholder"
            value={input.placeholder ?? ""}
            maxLength={120}
            onChange={(value) => setInput({ placeholder: value })}
          />
          <ToggleField
            label="Room for a paragraph"
            checked={input.multiline}
            onChange={(checked) => setInput({ multiline: checked })}
          />
        </>
      );

    case "email":
      return (
        <TextField
          label="Placeholder"
          value={input.placeholder ?? ""}
          maxLength={120}
          onChange={(value) => setInput({ placeholder: value })}
        />
      );
  }
}

function OptionsEditor({
  step,
  patch,
  doc,
}: {
  step: WidgetStep;
  patch: (mutate: (step: WidgetStep) => WidgetStep) => void;
  doc: WidgetDocument;
}) {
  if (step.input.kind !== "choice") return null;
  const options = step.input.options;
  const outcomes = doc.result.outcomes;
  const scoring = doc.result.kind === "recommendation" || doc.result.kind === "score";

  const setOptions = (next: ChoiceOption[]) =>
    patch((current) =>
      current.input.kind === "choice"
        ? { ...current, input: { ...current.input, options: next } }
        : current
    );

  const patchOption = (index: number, mutate: (option: ChoiceOption) => ChoiceOption) =>
    setOptions(options.map((option, position) => (position === index ? mutate(option) : option)));

  return (
    <Field label="Answers">
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={option.id} className="rounded-btn border border-rule bg-lavender/60 p-2.5">
            <div className="flex items-center gap-1.5">
              {option.illustration ? <Illustration name={option.illustration} size={26} /> : null}
              <input
                className="input bg-white py-2"
                value={option.label}
                placeholder="Answer"
                onChange={(event) =>
                  patchOption(index, (current) => ({ ...current, label: event.target.value }))
                }
              />
              <button
                type="button"
                className="btn-ghost px-2"
                aria-label={`Remove ${option.label}`}
                disabled={options.length <= 2}
                onClick={() => setOptions(options.filter((_, position) => position !== index))}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-muted">Worth</span>
                <input
                  className="input bg-white py-1.5 text-sm"
                  value={String(option.value)}
                  placeholder="0"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const numeric = Number(raw);
                    patchOption(index, (current) => ({
                      ...current,
                      value: raw !== "" && Number.isFinite(numeric) ? numeric : raw,
                    }));
                  }}
                />
              </label>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-muted">Picture</span>
                <IllustrationCompact
                  value={option.illustration}
                  onChange={(value) => patchOption(index, (current) => ({ ...current, illustration: value }))}
                />
              </div>
            </div>

            {scoring && outcomes.length > 0 ? (
              <div className="mt-2">
                <span className="mb-1 block text-[11px] font-semibold text-muted">
                  Points towards
                </span>
                <div className="grid gap-1.5">
                  {outcomes.map((outcome) => (
                    <label key={outcome.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate text-slate">{outcome.title}</span>
                      <input
                        type="number"
                        className="input w-16 bg-white px-2 py-1 text-xs"
                        value={option.scores?.[outcome.id] ?? 0}
                        onChange={(event) =>
                          patchOption(index, (current) => ({
                            ...current,
                            scores: { ...(current.scores ?? {}), [outcome.id]: Number(event.target.value) || 0 },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {options.length < 12 ? (
        <button
          type="button"
          className="btn-ghost mt-2 px-2"
          onClick={() =>
            setOptions([
              ...options,
              {
                id: uniqueOptionId(options, `option ${options.length + 1}`),
                label: `Option ${options.length + 1}`,
                value: options.length + 1,
              },
            ])
          }
        >
          <PlusIcon size={16} />
          Add answer
        </button>
      ) : null}
    </Field>
  );
}

function uniqueOptionId(options: ChoiceOption[], label: string): string {
  const base = slugify(label, "option");
  const taken = new Set(options.map((option) => option.id));
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    if (!taken.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

function IllustrationCompact({
  value,
  onChange,
}: {
  value?: ChoiceOption["illustration"];
  onChange: (value: ChoiceOption["illustration"]) => void;
}) {
  return (
    <div className="[&_label>span:first-child]:hidden">
      <IllustrationField label="Picture" value={value} onChange={onChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

function ResultEditor({ doc, update, capabilities, planName }: EditorProps) {
  const result = doc.result;
  const fields = doc.steps.map((step) => step.id);
  const expressionValid = isValidExpression(result.expression, [...fields, "total"]);
  const showsOutcomes = result.kind === "recommendation" || result.kind === "score";

  const patch = (mutate: (result: WidgetDocument["result"]) => WidgetDocument["result"]) =>
    update((draft) => ({ ...draft, result: mutate(draft.result) }));

  return (
    <>
      <Section title="What they get">
        <SelectField
          label="Result type"
          value={result.kind}
          options={[
            { value: "value", label: "A single number" },
            { value: "range", label: "A price range" },
            { value: "recommendation", label: "A recommendation" },
            { value: "score", label: "A score and a recommendation" },
          ]}
          onChange={(kind) =>
            patch((current) => ({
              ...current,
              kind,
              outcomes:
                (kind === "recommendation" || kind === "score") && current.outcomes.length === 0
                  ? defaultOutcomes()
                  : current.outcomes,
            }))
          }
        />
        <TextField
          label="Heading"
          value={result.heading}
          maxLength={200}
          onChange={(value) => patch((current) => ({ ...current, heading: value }))}
        />
        <TextField
          label="Description"
          multiline
          maxLength={600}
          value={result.description ?? ""}
          onChange={(value) => patch((current) => ({ ...current, description: value }))}
        />
      </Section>

      {result.kind !== "recommendation" ? (
        <Section
          title="The calculation"
          hint="Use + − × ÷ and the question names below. No code, no brackets required."
        >
          <Field label="Formula">
            <input
              className={`input font-mono text-xs ${expressionValid ? "" : "border-coral"}`}
              value={result.expression}
              onChange={(event) => patch((current) => ({ ...current, expression: event.target.value }))}
            />
            {expressionValid ? null : (
              <span className="mt-1 block text-xs font-medium text-coral">
                That formula doesn&rsquo;t work yet — check the names below.
              </span>
            )}
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {[...fields, "total"].map((field) => (
              <button
                key={field}
                type="button"
                className="rounded-full border border-rule bg-white px-2.5 py-1 font-mono text-[11px] text-slate transition hover:border-purple hover:text-purple"
                onClick={() =>
                  patch((current) => ({
                    ...current,
                    expression: `${current.expression.trim()} + ${field}`.replace(/^\s*\+\s*/, ""),
                  }))
                }
              >
                {field}
              </button>
            ))}
          </div>

          <NumberField
            label="Starting amount"
            hint="Charged before any answers. This is “total” in the formula."
            value={result.baseValue}
            onChange={(value) => patch((current) => ({ ...current, baseValue: value ?? 0 }))}
          />

          <SelectField
            label="Show it as"
            value={result.format.style}
            options={[
              { value: "currency", label: "Money" },
              { value: "number", label: "A plain number" },
              { value: "percent", label: "A percentage" },
              { value: "duration", label: "Hours" },
            ]}
            onChange={(style) => patch((current) => ({ ...current, format: { ...current.format, style } }))}
          />

          {result.format.style === "currency" ? (
            <TextField
              label="Currency"
              value={result.format.currency}
              maxLength={3}
              hint="A three-letter code: USD, GBP, EUR."
              onChange={(value) =>
                patch((current) => ({
                  ...current,
                  format: { ...current.format, currency: value.toUpperCase().slice(0, 3) },
                }))
              }
            />
          ) : null}

          {result.kind === "range" ? (
            <NumberField
              label="Range width (%)"
              hint="How far above the number the top of the range sits."
              value={Math.round(result.rangeSpread * 100)}
              step={5}
              min={0}
              max={100}
              onChange={(value) =>
                patch((current) => ({ ...current, rangeSpread: Math.min(1, (value ?? 0) / 100) }))
              }
            />
          ) : null}

          <ToggleField
            label="Offer a breakdown"
            hint="Shows what each answer added. Only appears when the numbers reconcile."
            checked={result.showBreakdown}
            onChange={(checked) => patch((current) => ({ ...current, showBreakdown: checked }))}
          />
        </Section>
      ) : null}

      {showsOutcomes ? <OutcomesEditor result={result} patch={patch} /> : null}

      <Section title="Reassurance">
        <ListEditor
          label="Tick list"
          items={result.bullets}
          addLabel="Add a line"
          placeholder="Professional & insured"
          onChange={(bullets) => patch((current) => ({ ...current, bullets }))}
        />
        <TextField
          label="Small print"
          multiline
          maxLength={300}
          value={result.disclaimer ?? ""}
          placeholder="This is an indicative estimate."
          onChange={(value) => patch((current) => ({ ...current, disclaimer: value }))}
        />
      </Section>

      <Section title="Next step">
        <TextField
          label="Button"
          value={result.cta?.label ?? ""}
          maxLength={60}
          placeholder="Book my clean"
          onChange={(value) =>
            patch((current) => ({
              ...current,
              cta: value ? { label: value, url: current.cta?.url } : undefined,
            }))
          }
        />
        <TextField
          label="Button link"
          value={result.cta?.url ?? ""}
          maxLength={500}
          placeholder="https://…"
          hint="Leave blank to just record the click."
          onChange={(value) =>
            patch((current) => ({
              ...current,
              cta: current.cta ? { ...current.cta, url: value } : undefined,
            }))
          }
        />
      </Section>

      <Section title="Their details" hint="Asked after the result by default — never before it.">
        {capabilities.leadCapture ? null : (
          <UpgradeNote>
            Collecting contact details is a Pro feature. Your plan is {planName}, so this section is
            saved but the form won&rsquo;t appear to visitors.
          </UpgradeNote>
        )}
        <SelectField
          label="When to ask"
          value={doc.settings.leadCapture.mode}
          options={[
            { value: "after", label: "After the result" },
            { value: "before", label: "Before the result" },
            { value: "none", label: "Don't ask" },
          ]}
          onChange={(mode) =>
            update((draft) => ({
              ...draft,
              settings: {
                ...draft.settings,
                leadCapture: { ...draft.settings.leadCapture, mode },
              },
            }))
          }
        />
        {doc.settings.leadCapture.mode !== "none" ? (
          <>
            <TextField
              label="Heading"
              value={doc.settings.leadCapture.heading}
              maxLength={160}
              onChange={(value) =>
                update((draft) => ({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    leadCapture: { ...draft.settings.leadCapture, heading: value },
                  },
                }))
              }
            />
            <Field label="Ask for">
              <div className="grid grid-cols-2 gap-1.5">
                {(["name", "email", "phone", "message"] as const).map((field) => {
                  const checked = doc.settings.leadCapture.fields.includes(field);
                  return (
                    <label
                      key={field}
                      className="flex cursor-pointer items-center gap-2 rounded-btn border border-rule px-3 py-2 text-sm capitalize"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-purple"
                        checked={checked}
                        onChange={(event) =>
                          update((draft) => {
                            const current = draft.settings.leadCapture.fields;
                            const next = event.target.checked
                              ? [...current, field]
                              : current.filter((entry) => entry !== field);
                            return {
                              ...draft,
                              settings: {
                                ...draft.settings,
                                leadCapture: {
                                  ...draft.settings.leadCapture,
                                  // At least one field, or there's no form.
                                  fields: next.length > 0 ? next : current,
                                },
                              },
                            };
                          })
                        }
                      />
                      {field}
                    </label>
                  );
                })}
              </div>
            </Field>
          </>
        ) : null}
      </Section>
    </>
  );
}

function defaultOutcomes(): ResultOutcome[] {
  return [
    { id: "first", title: "The first option", description: "", bullets: [] },
    { id: "second", title: "The second option", description: "", bullets: [] },
    { id: "third", title: "The third option", description: "", bullets: [] },
  ];
}

function OutcomesEditor({
  result,
  patch,
}: {
  result: WidgetDocument["result"];
  patch: (mutate: (result: WidgetDocument["result"]) => WidgetDocument["result"]) => void;
}) {
  const setOutcomes = (outcomes: ResultOutcome[]) => patch((current) => ({ ...current, outcomes }));

  return (
    <Section title="Possible results" hint="The one with the most points wins.">
      <div className="space-y-2">
        {result.outcomes.map((outcome, index) => (
          <div key={outcome.id} className="rounded-btn border border-rule bg-lavender/60 p-2.5">
            <div className="flex items-center gap-1.5">
              <input
                className="input bg-white py-2"
                value={outcome.title}
                onChange={(event) =>
                  setOutcomes(
                    result.outcomes.map((entry, position) =>
                      position === index ? { ...entry, title: event.target.value } : entry
                    )
                  )
                }
              />
              <button
                type="button"
                className="btn-ghost px-2"
                aria-label={`Remove ${outcome.title}`}
                disabled={result.outcomes.length <= 1}
                onClick={() =>
                  setOutcomes(result.outcomes.filter((_, position) => position !== index))
                }
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <textarea
              className="input mt-2 min-h-[56px] resize-y bg-white text-sm"
              placeholder="Why this one?"
              value={outcome.description ?? ""}
              onChange={(event) =>
                setOutcomes(
                  result.outcomes.map((entry, position) =>
                    position === index ? { ...entry, description: event.target.value } : entry
                  )
                )
              }
            />
            <div className="mt-2">
              <IllustrationCompact
                value={outcome.illustration}
                onChange={(value) =>
                  setOutcomes(
                    result.outcomes.map((entry, position) =>
                      position === index ? { ...entry, illustration: value } : entry
                    )
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>

      {result.outcomes.length < 12 ? (
        <button
          type="button"
          className="btn-ghost mt-2 px-2"
          onClick={() =>
            setOutcomes([
              ...result.outcomes,
              {
                id: fieldise(`outcome ${result.outcomes.length + 1}`, `outcome_${result.outcomes.length + 1}`),
                title: `Option ${result.outcomes.length + 1}`,
                description: "",
                bullets: [],
              },
            ])
          }
        >
          <PlusIcon size={16} />
          Add a result
        </button>
      ) : null}
    </Section>
  );
}

/* Re-exported so DesignTab can share the swatch list. */
export const BRAND_SWATCHES = ["#5B5FEF", "#7DD3C7", "#FFC857", "#FF8FA3", "#1B1F3B", "#2E9C8B"];
export { ColourField };
