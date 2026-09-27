// Simple, friendly charts (brief §25).
//
// "Use simple friendly charts. Do not build enterprise analytics." These are
// hand-drawn SVG rather than a charting library: two shapes are all the
// dashboard needs, and a dependency-free chart is a few hundred bytes instead
// of a hundred kilobytes on a page that already ships a widget runtime.

export interface FunnelStage {
  label: string;
  value: number;
  tone: "purple" | "mint" | "yellow" | "coral";
}

const TONES = {
  purple: "#7657F6",
  mint: "#73DDB5",
  yellow: "#FFC857",
  coral: "#FF806F",
} as const;

/** The view → start → complete funnel, as proportional bars. */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = Math.max(1, ...stages.map((stage) => stage.value));

  return (
    <ul className="space-y-4">
      {stages.map((stage) => {
        const share = stage.value / top;
        return (
          <li key={stage.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-navy">{stage.label}</span>
              <span className="text-sm font-bold tabular-nums text-navy">
                {stage.value.toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-lavender">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(share * 100, stage.value > 0 ? 3 : 0)}%`, background: TONES[stage.tone] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A daily column chart. Bars, a baseline, no gridlines, no legend. */
export function Sparkbars({ points, label }: { points: Array<{ day: string; value: number }>; label: string }) {
  const peak = Math.max(0, ...points.map((point) => point.value));
  // Divisor only. `peak` is what we print, so an all-zero fortnight says 0
  // rather than borrowing the 1 that keeps the arithmetic safe.
  const top = Math.max(1, peak);

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>

      {/* Bars with no scale are decoration — you can't tell 12 from 120. The
          ceiling line is where the tallest day reaches, labelled. */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-rule" />
        <span className="absolute right-0 top-0 -translate-y-1/2 bg-white pl-1 text-[11px] font-semibold tabular-nums text-muted">
          {peak}
        </span>

        {/* Each column is h-full so the bar's percentage height has something
            definite to resolve against — without it every bar collapses to 0. */}
        <div className="flex h-28 items-end gap-1">
          {points.map((point) => (
            <div key={point.day} className="group flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-[4px] bg-purple-mid transition group-hover:bg-purple"
                style={{ height: `${Math.max((point.value / top) * 100, point.value > 0 ? 4 : 1.5)}%` }}
                title={`${point.day}: ${point.value}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
        <span>{points[0]?.day}</span>
        <span>{points.at(-1)?.day}</span>
      </div>
    </figure>
  );
}

export interface DropOffStep {
  id: string;
  label: string;
  /** How many people got past this question. */
  reached: number;
  /** That, as a share of everyone who started. */
  share: number;
  /** How many got past the question before this one but not this one. */
  lost: number;
}

/**
 * Where people stop answering (§25).
 *
 * Same shape as the funnel above rather than a label with a stub of a bar
 * pinned to the right margin: the bars are the comparison, so they get the
 * width, and at a glance you can see which question is the cliff.
 */
export function DropOff({ steps }: { steps: DropOffStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold text-navy">
              {index + 1}. {step.label}
            </span>
            {/* The separator is a real character, not a margin: a margin
                leaves "19387%" for anyone reading this out loud. */}
            <span className="flex-none text-sm tabular-nums text-muted">
              <span className="font-bold text-navy">{step.reached.toLocaleString()}</span> ·{" "}
              {step.share}%
            </span>
          </div>

          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-lavender">
            <div
              className="h-full rounded-full bg-purple transition-[width] duration-500"
              style={{ width: `${Math.max(step.share, step.reached > 0 ? 3 : 0)}%` }}
            />
          </div>

          {step.lost > 0 ? (
            <p className="mt-1 text-xs text-muted">
              {step.lost.toLocaleString()} didn&rsquo;t get past this one
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-navy">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
