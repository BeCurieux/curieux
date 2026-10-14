"use client";

// The Logic tab (brief §18).
//
//     IF   Bedrooms   is at least   4
//     THEN Add $40
//
// Three dropdowns and a box. No code, no expression bar, no node graph. The
// operator list is worded as English ("is at least", not ">="), and the action
// list is worded as money and questions, because the person using it is a
// cleaner or a photographer, not a developer.

import { CloseIcon, PlusIcon } from "@/components/ui/Icons";
import { Section } from "./controls";
import type { EditorProps } from "./types";
import { describeOperator } from "@/lib/widget/engine";
import type { Condition, ConditionOperator, LogicRule, WidgetDocument } from "@/lib/widget/schema";

const OPERATORS: ConditionOperator[] = [
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
];

type ActionKind = "add" | "subtract" | "multiply" | "show" | "hide" | "message" | "score" | "outcome";

export function LogicTab({ doc, update, capabilities, planName }: EditorProps) {
  const rules = doc.logic;
  const scoring = doc.result.kind === "recommendation" || doc.result.kind === "score";
  // Business gets branching and multipliers; everyone gets add/subtract (§35).
  const advanced = capabilities.advancedLogic;

  const setRules = (next: LogicRule[]) => update((draft) => ({ ...draft, logic: next }));

  const patchRule = (index: number, mutate: (rule: LogicRule) => LogicRule) =>
    setRules(rules.map((rule, position) => (position === index ? mutate(rule) : rule)));

  if (doc.steps.length === 0) {
    return (
      <Section title="Rules">
        <p className="text-sm text-slate">Add a question first, then you can react to the answers.</p>
      </Section>
    );
  }

  return (
    <>
      <Section
        title="Rules"
        hint="Rules run top to bottom. Each one checks an answer and does something."
      >
        {rules.length === 0 ? (
          <p className="rounded-btn border border-dashed border-rule px-3 py-6 text-center text-sm text-muted">
            No rules yet. Most widgets don&rsquo;t need any — the formula does the work.
          </p>
        ) : null}

        <div className="space-y-3">
          {rules.map((rule, index) => {
            const condition = firstCondition(rule);
            const action = actionOf(rule);

            return (
              <div key={rule.id} className="rounded-card border border-rule bg-lavender/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple">If</span>
                  <button
                    type="button"
                    className="btn-ghost px-1.5 py-1"
                    aria-label="Delete rule"
                    onClick={() => setRules(rules.filter((_, position) => position !== index))}
                  >
                    <CloseIcon size={15} />
                  </button>
                </div>

                <div className="mt-1.5 grid gap-1.5">
                  <select
                    className="input bg-white py-2 text-sm"
                    value={condition.field}
                    onChange={(event) =>
                      patchRule(index, (current) => withCondition(current, { field: event.target.value }))
                    }
                  >
                    {doc.steps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.title || step.id}
                      </option>
                    ))}
                  </select>

                  <select
                    className="input bg-white py-2 text-sm"
                    value={condition.operator}
                    onChange={(event) =>
                      patchRule(index, (current) =>
                        withCondition(current, { operator: event.target.value as ConditionOperator })
                      )
                    }
                  >
                    {OPERATORS.map((operator) => (
                      <option key={operator} value={operator}>
                        {describeOperator(operator)}
                      </option>
                    ))}
                  </select>

                  {condition.operator === "is_empty" || condition.operator === "is_not_empty" ? null : (
                    <input
                      className="input bg-white py-2 text-sm"
                      value={String(condition.value ?? "")}
                      placeholder="4"
                      onChange={(event) => {
                        const raw = event.target.value;
                        const numeric = Number(raw);
                        patchRule(index, (current) =>
                          withCondition(current, {
                            value: raw !== "" && Number.isFinite(numeric) ? numeric : raw,
                          })
                        );
                      }}
                    />
                  )}
                </div>

                <span className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-purple">
                  Then
                </span>

                <div className="mt-1.5 grid gap-1.5">
                  <select
                    className="input bg-white py-2 text-sm"
                    value={action.kind}
                    onChange={(event) =>
                      patchRule(index, (current) =>
                        withAction(current, event.target.value as ActionKind, doc, scoring)
                      )
                    }
                  >
                    <option value="add">Add to the total</option>
                    <option value="subtract">Take off the total</option>
                    {advanced ? <option value="multiply">Multiply the total</option> : null}
                    {advanced ? <option value="show">Show a question</option> : null}
                    {advanced ? <option value="hide">Hide a question</option> : null}
                    {scoring ? <option value="score">Give points to a result</option> : null}
                    {scoring ? <option value="outcome">Force a result</option> : null}
                    <option value="message">Add a line to the result</option>
                  </select>

                  <ActionValue
                    rule={rule}
                    action={action}
                    doc={doc}
                    onChange={(next) => patchRule(index, () => next)}
                  />
                </div>

                <p className="mt-2 text-xs text-muted">{plainEnglish(rule, doc)}</p>
              </div>
            );
          })}
        </div>

        {rules.length < 60 ? (
          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            onClick={() => setRules([...rules, newRule(doc, rules.length)])}
          >
            <PlusIcon size={16} />
            Add rule
          </button>
        ) : null}

        {advanced ? null : (
          <p className="mt-3 rounded-btn border border-yellow/50 bg-yellow-soft px-3 py-2 text-xs leading-relaxed">
            Branching and multipliers are Business features. You&rsquo;re on {planName}, so rules can add
            and subtract, give points and add a line to the result.
          </p>
        )}
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function firstCondition(rule: LogicRule): Condition {
  if ("all" in rule.when) return rule.when.all[0];
  if ("any" in rule.when) return rule.when.any[0];
  return rule.when;
}

function withCondition(rule: LogicRule, patch: Partial<Condition>): LogicRule {
  const next = { ...firstCondition(rule), ...patch };
  // The label is regenerated from the rule unless someone typed their own.
  return { ...rule, when: next, label: undefined };
}

function actionOf(rule: LogicRule): { kind: ActionKind; value: string } {
  const { then } = rule;
  if (then.add !== undefined) return { kind: "add", value: String(then.add) };
  if (then.subtract !== undefined) return { kind: "subtract", value: String(then.subtract) };
  if (then.multiply !== undefined) return { kind: "multiply", value: String(then.multiply) };
  if (then.show) return { kind: "show", value: then.show };
  if (then.hide) return { kind: "hide", value: then.hide };
  if (then.score) return { kind: "score", value: then.score.outcome };
  if (then.outcome) return { kind: "outcome", value: then.outcome };
  if (then.message) return { kind: "message", value: then.message };
  return { kind: "add", value: "0" };
}

function withAction(rule: LogicRule, kind: ActionKind, doc: WidgetDocument, scoring: boolean): LogicRule {
  const firstStep = doc.steps[0]?.id ?? "";
  const firstOutcome = doc.result.outcomes[0]?.id ?? "";

  const then =
    kind === "add"
      ? { add: 0 }
      : kind === "subtract"
        ? { subtract: 0 }
        : kind === "multiply"
          ? { multiply: 1 }
          : kind === "show"
            ? { show: firstStep }
            : kind === "hide"
              ? { hide: firstStep }
              : kind === "score" && scoring
                ? { score: { outcome: firstOutcome, points: 1 } }
                : kind === "outcome" && scoring
                  ? { outcome: firstOutcome }
                  : { message: "" };

  return { ...rule, then };
}

function ActionValue({
  rule,
  action,
  doc,
  onChange,
}: {
  rule: LogicRule;
  action: { kind: ActionKind; value: string };
  doc: WidgetDocument;
  onChange: (rule: LogicRule) => void;
}) {
  switch (action.kind) {
    case "show":
    case "hide":
      return (
        <select
          className="input bg-white py-2 text-sm"
          value={action.value}
          onChange={(event) => onChange({ ...rule, then: { [action.kind]: event.target.value } })}
        >
          {doc.steps.map((step) => (
            <option key={step.id} value={step.id}>
              {step.title || step.id}
            </option>
          ))}
        </select>
      );

    case "outcome":
      return (
        <select
          className="input bg-white py-2 text-sm"
          value={action.value}
          onChange={(event) => onChange({ ...rule, then: { outcome: event.target.value } })}
        >
          {doc.result.outcomes.map((outcome) => (
            <option key={outcome.id} value={outcome.id}>
              {outcome.title}
            </option>
          ))}
        </select>
      );

    case "score":
      return (
        <div className="grid grid-cols-[1fr_5rem] gap-1.5">
          <select
            className="input bg-white py-2 text-sm"
            value={rule.then.score?.outcome ?? ""}
            onChange={(event) =>
              onChange({
                ...rule,
                then: { score: { outcome: event.target.value, points: rule.then.score?.points ?? 1 } },
              })
            }
          >
            {doc.result.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input bg-white py-2 text-sm"
            value={rule.then.score?.points ?? 1}
            onChange={(event) =>
              onChange({
                ...rule,
                then: {
                  score: {
                    outcome: rule.then.score?.outcome ?? doc.result.outcomes[0]?.id ?? "",
                    points: Number(event.target.value) || 0,
                  },
                },
              })
            }
          />
        </div>
      );

    case "message":
      return (
        <input
          className="input bg-white py-2 text-sm"
          value={rule.then.message ?? ""}
          placeholder="Large homes are quoted for two cleaners."
          onChange={(event) => onChange({ ...rule, then: { message: event.target.value } })}
        />
      );

    default:
      return (
        <input
          className="input bg-white py-2 text-sm"
          value={action.value}
          placeholder={action.kind === "multiply" ? "1.15" : "40"}
          onChange={(event) => {
            const numeric = Number(event.target.value);
            const value = Number.isFinite(numeric) && event.target.value !== "" ? numeric : 0;
            onChange({ ...rule, then: { [action.kind]: value } });
          }}
        />
      );
  }
}

function newRule(doc: WidgetDocument, index: number): LogicRule {
  return {
    id: `rule_${index + 1}_${Math.random().toString(36).slice(2, 7)}`,
    when: { field: doc.steps[0].id, operator: ">=", value: 1 },
    then: { add: 0 },
  };
}

/** The sentence under each rule, so it can be read back without decoding. */
function plainEnglish(rule: LogicRule, doc: WidgetDocument): string {
  const condition = firstCondition(rule);
  const step = doc.steps.find((entry) => entry.id === condition.field);
  const subject = step?.title || condition.field;
  const action = actionOf(rule);

  const outcomeTitle = (id: string) =>
    doc.result.outcomes.find((outcome) => outcome.id === id)?.title ?? id;
  const stepTitle = (id: string) => doc.steps.find((entry) => entry.id === id)?.title ?? id;

  const verb =
    action.kind === "add"
      ? `add ${action.value}`
      : action.kind === "subtract"
        ? `take off ${action.value}`
        : action.kind === "multiply"
          ? `multiply the total by ${action.value}`
          : action.kind === "show"
            ? `show “${stepTitle(action.value)}”`
            : action.kind === "hide"
              ? `hide “${stepTitle(action.value)}”`
              : action.kind === "score"
                ? `give ${rule.then.score?.points ?? 0} points to “${outcomeTitle(action.value)}”`
                : action.kind === "outcome"
                  ? `always show “${outcomeTitle(action.value)}”`
                  : "add a line to the result";

  const value =
    condition.operator === "is_empty" || condition.operator === "is_not_empty"
      ? ""
      : ` ${condition.value ?? ""}`;

  return `When ${subject} ${describeOperator(condition.operator)}${value}, ${verb}.`;
}
