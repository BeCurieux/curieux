/**
 * The four facts that decide whether a plan happens (§2): what the weather is
 * doing, what it costs, how hard it is, how far away it is.
 *
 * Each is its own component because each carries a different honesty
 * obligation. Cost is always an estimate and says so. Weather is a forecast
 * and is attributed. Neither is ever stated flatly (§53).
 */

import { formatDistance, formatMoneyRange, type Market } from "@/config/markets";
import type { ActivityLevel } from "@/lib/types";
import { Badge } from "@/components/ui";

export function WeatherBadge({ summary }: { summary: string | null }) {
  if (!summary) return null;
  return <Badge tone="water">{summary}</Badge>;
}

export function BudgetBadge({
  market,
  min,
  max,
}: {
  market: Market;
  min: number;
  max: number;
}) {
  const label = min === 0 && max === 0 ? "Free" : formatMoneyRange(market, min, max);
  return (
    <Badge tone="neutral">
      {label}
      {min === 0 && max === 0 ? null : (
        // Never present an estimate as a price (§22).
        <span className="text-mist"> est.</span>
      )}
    </Badge>
  );
}

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  GENTLE: "Gentle",
  EASY: "Easy",
  MODERATE: "Moderate",
  ACTIVE: "Active",
};

export function ActivityBadge({ level, km, market }: { level: ActivityLevel; km: number; market: Market }) {
  return (
    <Badge tone="forest">
      {ACTIVITY_LABEL[level]}
      {km > 0 ? <span className="text-forest/70">· {formatDistance(market, km)}</span> : null}
    </Badge>
  );
}

export function TravelBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return <Badge tone="neutral">{minutes} min from home</Badge>;
}

/** The row of them, as it appears under a plan title. */
export function PlanSummary({
  market,
  weatherSummary,
  costMin,
  costMax,
  activityLevel,
  distanceKm,
  travelMinutes,
}: {
  market: Market;
  weatherSummary: string | null;
  costMin: number;
  costMax: number;
  activityLevel: ActivityLevel;
  distanceKm: number;
  travelMinutes: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <WeatherBadge summary={weatherSummary} />
      <BudgetBadge market={market} min={costMin} max={costMax} />
      <ActivityBadge level={activityLevel} km={distanceKm} market={market} />
      <TravelBadge minutes={travelMinutes} />
    </div>
  );
}
