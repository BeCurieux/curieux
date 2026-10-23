// Pure calculations for the founder's dashboard, shared by both backends.

const DAY = 86_400_000;

/**
 * Repeat usage, measured on what people did rather than whether they signed in.
 *
 * - 7-day repeat: active on at least two different days within seven days
 *   of their first activity.
 * - 30-day repeat: active again between day 8 and day 30 after their first
 *   activity — they came back after the launch week.
 */
export function repeatUsage(activity: { userId: string; at: string }[]): {
  repeat7d: number;
  repeat30d: number;
} {
  const byUser = new Map<string, number[]>();
  for (const row of activity) {
    const list = byUser.get(row.userId) ?? [];
    list.push(Date.parse(row.at));
    byUser.set(row.userId, list);
  }
  let repeat7d = 0;
  let repeat30d = 0;
  for (const times of byUser.values()) {
    times.sort((a, b) => a - b);
    const first = times[0]!;
    const firstDay = Math.floor(first / DAY);
    const days7 = new Set(
      times.filter((t) => t - first < 7 * DAY).map((t) => Math.floor(t / DAY) - firstDay),
    );
    if (days7.size >= 2) repeat7d += 1;
    if (times.some((t) => t - first >= 7 * DAY && t - first < 30 * DAY)) repeat30d += 1;
  }
  return { repeat7d, repeat30d };
}

export function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** The steps the marketing dashboard shows, in funnel order. */
export const FUNNEL_EVENTS = [
  "landing_viewed",
  "fit_landing_viewed",
  "fit_check_viewed",
  "calculator_viewed",
  "offer_viewed",
  "offer_clicked",
  "signup_completed",
  "fit_completed",
  "email_consent_given",
  "purchase_verified",
  "purchase_refunded",
] as const;

/**
 * Funnel counts by campaign source. Events without a source (direct visits,
 * and purchases, which arrive from Gumroad without campaign data) are
 * grouped under "(none recorded)" rather than guessed.
 */
export function funnelBySource(
  events: { name: string; props?: Record<string, unknown> | null }[],
): Record<string, Record<string, number>> {
  const wanted = new Set<string>(FUNNEL_EVENTS);
  const out: Record<string, Record<string, number>> = {};
  for (const e of events) {
    if (!wanted.has(e.name)) continue;
    const raw = e.props?.source;
    const source = typeof raw === "string" && raw ? raw : "(none recorded)";
    const row = (out[source] ??= {});
    row[e.name] = (row[e.name] ?? 0) + 1;
  }
  return out;
}
