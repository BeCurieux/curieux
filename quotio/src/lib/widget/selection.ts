// Which answer card is highlighted.
//
// Answers are stored as *values*, because that's what the maths needs. But two
// answers may share a value on purpose — in the cleaning template "Not sure"
// is deliberately priced as a 2-bedroom — so a highlight driven by value alone
// lights up both cards.
//
// The renderer therefore tracks the chosen option *id* alongside the answer.
// This module is the bridge for the one case where it can't: answers that
// arrive pre-filled rather than clicked.
//
// Pure and UI-free so it can be tested directly; this has been got wrong twice.

import type { WidgetStep } from "./schema";

export type Answers = Record<string, unknown>;

/**
 * Resolve starting values into the specific answer cards they mean.
 *
 * First match wins, which is the only sane reading of "the answer worth 2".
 * Multi-select resolves each value in turn and never reuses an option.
 */
export function resolveChosen(steps: WidgetStep[], answers?: Answers): Record<string, string[]> {
  if (!answers) return {};
  const chosen: Record<string, string[]> = {};

  for (const step of steps) {
    if (step.input.kind !== "choice") continue;

    const value = answers[step.id];
    if (value === undefined) continue;

    const wanted = Array.isArray(value) ? value : [value];
    const ids: string[] = [];

    for (const target of wanted) {
      const match = step.input.options.find(
        (option) => option.value === target && !ids.includes(option.id)
      );
      if (match) ids.push(match.id);
    }

    if (ids.length > 0) chosen[step.id] = ids;
  }

  return chosen;
}
