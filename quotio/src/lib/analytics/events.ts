// The event model (brief §26).
//
// Seven events, no more. Each carries the widget, an anonymous session id and
// a timestamp — and a step id when the event is about a step. There is no
// visitor profile, no cookie sync, no IP logging and no third-party pixel:
// §26 says don't collect unnecessary personal data, and the cheapest way to
// honour that is to have nowhere to put it.

import { z } from "zod";

export const EVENT_TYPES = [
  "widget_view",
  "widget_start",
  "step_complete",
  "widget_complete",
  "result_view",
  "cta_click",
  "lead_submit",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const eventTypeSchema = z.enum(EVENT_TYPES);

export const widgetEventSchema = z.object({
  widgetId: z.string().min(1).max(64),
  sessionId: z.string().min(8).max(64),
  type: eventTypeSchema,
  stepId: z.string().max(64).optional(),
  /** Small, non-identifying extras: step index, result value, CTA label. */
  metadata: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

export const eventBatchSchema = z.object({
  events: z.array(widgetEventSchema).min(1).max(20),
});

export type WidgetEvent = z.infer<typeof widgetEventSchema>;

/** Counts behind the analytics dashboard (§25). */
export interface WidgetStats {
  views: number;
  starts: number;
  completions: number;
  completionRate: number;
  ctaClicks: number;
  leads: number;
}

export function emptyStats(): WidgetStats {
  return { views: 0, starts: 0, completions: 0, completionRate: 0, ctaClicks: 0, leads: 0 };
}

/**
 * Roll raw events up into the six numbers the dashboard shows.
 *
 * Completion rate is measured against *starts*, not views: a visitor who
 * scrolled past the widget never had the chance to finish it, and counting
 * them would make every widget look broken.
 */
export function summarise(
  // `type` is a plain string because that's what comes back out of the
  // database; unknown types simply never match a counter.
  events: Array<{ type: string; sessionId: string }>,
  leadCount = 0
): WidgetStats {
  const unique = (type: EventType) =>
    new Set(events.filter((event) => event.type === type).map((event) => event.sessionId)).size;

  const views = unique("widget_view");
  const starts = unique("widget_start");
  const completions = unique("widget_complete");
  const ctaClicks = events.filter((event) => event.type === "cta_click").length;

  return {
    views,
    starts,
    completions,
    completionRate: starts === 0 ? 0 : Math.round((completions / starts) * 100),
    ctaClicks,
    leads: leadCount,
  };
}

export interface DropOffRow {
  id: string;
  label: string;
  /** Distinct visitors who got past this question. */
  reached: number;
  /** That, as a whole-number share of everyone who started. */
  share: number;
  /** Visitors who got past the question before this one, but not this one. */
  lost: number;
}

/**
 * How far people get through the questions (§25).
 *
 * `steps` must come from the *published* document. Analytics describe what
 * visitors met; feeding it a draft relabels history the moment a question is
 * renamed, and lists a draft-only question as a cliff nobody got past.
 *
 * `lost` is the fall from the question before, floored at zero. When every
 * visitor sees every question it reconciles — the column sums to
 * `starts - reached(last step)`. Branching and optional questions break that
 * on purpose: a question a rule hides for most people is reached by few, and
 * the one after it can be reached by more, which is a detour rather than a
 * drop-off and so counts as zero lost rather than as a negative.
 */
export function dropOff(
  // `stepId` is nullable because that's how it comes back out of the
  // database — events that aren't about a question carry no step.
  events: Array<{ type: string; sessionId: string; stepId?: string | null }>,
  steps: Array<{ id: string; title: string }>,
  starts: number
): DropOffRow[] {
  const reachedBy = (stepId: string) =>
    new Set(
      events
        .filter((event) => event.type === "step_complete" && event.stepId === stepId)
        .map((event) => event.sessionId)
    ).size;

  let before = starts;

  return steps.map((step) => {
    const reached = reachedBy(step.id);
    const row: DropOffRow = {
      id: step.id,
      label: step.title,
      reached,
      share: starts === 0 ? 0 : Math.round((reached / starts) * 100),
      // Never negative: a question can't gain people. Optional questions and
      // rule-hidden ones can legitimately be reached by fewer than the one
      // before, but not by more.
      lost: Math.max(0, before - reached),
    };
    before = reached;
    return row;
  });
}
