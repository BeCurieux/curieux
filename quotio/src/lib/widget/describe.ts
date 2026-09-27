import type { WidgetDocument } from "./schema";
import { resolveChosen, type Answers } from "./selection";

/**
 * A visitor's answers, in the words they saw.
 *
 * Answers are stored as *values* because that is what the expressions need, so
 * the raw record is `{ home_type: 40, frequency: 0 }`. That is the right thing
 * to store and a useless thing to send anybody: 40 is what an apartment costs,
 * not what the customer picked, and a cleaning company reading "home_type: 40"
 * has learned nothing it didn't already know.
 *
 * So this walks the document that produced them and gives back the question as
 * it was asked and the answer as it was labelled — which is the whole reason
 * the answers travel with the lead (§20).
 */
export interface DescribedAnswer {
  question: string;
  answer: string;
}

export function describeAnswers(
  document: WidgetDocument,
  answers: Answers
): DescribedAnswer[] {
  const chosen = resolveChosen(document.steps, answers);
  const described: DescribedAnswer[] = [];

  for (const step of document.steps) {
    const raw = answers[step.id];
    if (raw === undefined || raw === null || raw === "") continue;

    const answer = label(step, raw, chosen[step.id]);
    // A multi-select nobody ticked reads as an unanswered question rather than
    // an empty line with a colon after it.
    if (!answer) continue;

    described.push({ question: step.title, answer });
  }

  return described;
}

function label(
  step: WidgetDocument["steps"][number],
  raw: unknown,
  chosenIds: string[] | undefined
): string {
  const input = step.input;

  if (input.kind === "choice") {
    // Prefer the ids the renderer recorded: two options can share a value on
    // purpose, and the label is the half the customer actually saw.
    const ids = chosenIds ?? [];
    const labels = ids
      .map((id) => input.options.find((option) => option.id === id)?.label)
      .filter(Boolean) as string[];
    return labels.join(", ");
  }

  if (input.kind === "toggle") {
    return raw ? input.onLabel : input.offLabel;
  }

  if (input.kind === "number" || input.kind === "slider") {
    const prefix = "prefix" in input ? (input.prefix ?? "") : "";
    const suffix = "suffix" in input ? (input.suffix ?? "") : "";
    return `${prefix}${raw}${suffix}`.trim();
  }

  return String(raw);
}
