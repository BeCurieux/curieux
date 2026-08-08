/**
 * The plan card, in two weights.
 *
 * The primary is the entire dashboard, really: one plan, four facts, a reason,
 * and a way in. The backup is deliberately smaller and framed as an escape
 * hatch ("Too tired?") rather than as a second option to weigh up — the whole
 * proposition is removing the decision, and two equal cards would put it back.
 */

import Link from "next/link";
import type { Market } from "@/config/markets";
import type { PlanWithItems } from "@/lib/types";
import { displayTime } from "@/lib/util/time";
import { Card, SectionLabel } from "@/components/ui";
import { PlanSummary } from "./badges";

export function WeekendPlanCard({
  plan,
  market,
  label = "Your Saturday is sorted",
}: {
  plan: PlanWithItems;
  market: Market;
  label?: string;
}) {
  const stops = plan.items.filter(
    (i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK"
  );
  const finish = plan.items[plan.items.length - 1];

  return (
    <Card className="overflow-hidden">
      <Link href={`/app/plans/${plan.id}`} className="block p-6 sm:p-7">
        <SectionLabel>{label}</SectionLabel>

        <h2 className="mt-2.5 text-[26px] leading-[1.15] text-ink sm:text-[30px]">{plan.title}</h2>

        {plan.short_description ? (
          <p className="mt-2 max-w-prose text-[16px] leading-relaxed text-graphite">
            {plan.short_description}
          </p>
        ) : null}

        <ol className="mt-5 space-y-2">
          {stops.slice(0, 4).map((item) => (
            <li key={item.id} className="flex gap-4">
              <span className="tabular w-[52px] shrink-0 text-[15px] text-mist">
                {displayTime(item.start_time)}
              </span>
              <span className="text-[15px] leading-snug text-ink">{item.title}</span>
            </li>
          ))}
        </ol>

        {finish ? (
          <p className="mt-3 pl-[68px] text-[14px] text-mist">
            Home around {displayTime(finish.end_time)}
          </p>
        ) : null}

        <div className="mt-5">
          <PlanSummary
            market={market}
            weatherSummary={plan.weather_summary}
            costMin={Number(plan.estimated_total_cost_min)}
            costMax={Number(plan.estimated_total_cost_max)}
            activityLevel={plan.activity_level}
            distanceKm={plan.total_activity_distance_km}
            travelMinutes={plan.total_travel_minutes}
          />
        </div>

        {plan.fit_reason ? <FitReason reason={plan.fit_reason} className="mt-5" /> : null}

        <span className="mt-6 inline-block text-[15px] font-semibold text-forest">
          Open the plan →
        </span>
      </Link>
    </Card>
  );
}

/** The backup: an escape hatch, not a rival. */
export function BackupPlanCard({ plan }: { plan: PlanWithItems }) {
  return (
    <Link
      href={`/app/plans/${plan.id}`}
      className="block rounded-card border border-rule bg-white p-5 transition-colors hover:border-[#CFC7B8]"
    >
      <SectionLabel>Too tired?</SectionLabel>
      <p className="mt-1.5 font-display text-[19px] leading-snug text-ink">{plan.title}</p>
      <span className="mt-3 inline-block text-[14px] font-semibold text-forest">
        Show me the easy version →
      </span>
    </Link>
  );
}

/**
 * The "why this fits you" line. Set in the serif and offset by a rule, because
 * it is the sentence that has to feel like it came from a person who has been
 * paying attention rather than from a recommendation engine.
 */
export function FitReason({ reason, className }: { reason: string; className?: string }) {
  return (
    <blockquote className={`border-l-2 border-forest pl-4 ${className ?? ""}`}>
      <p className="font-display text-[16px] italic leading-relaxed text-graphite">{reason}</p>
    </blockquote>
  );
}
