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
  purple: "#5B5FEF",
  mint: "#7DD3C7",
  yellow: "#FFC857",
  coral: "#FF8FA3",
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
  const top = Math.max(1, ...points.map((point) => point.value));

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
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
      <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
        <span>{points[0]?.day}</span>
        <span>{points.at(-1)?.day}</span>
      </div>
    </figure>
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
