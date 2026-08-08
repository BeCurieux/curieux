import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMarket } from "@/config/markets";
import { flags } from "@/config/flags";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { displayDate, displayTime } from "@/lib/util/time";
import { ButtonLink, Card, SectionLabel } from "@/components/ui";
import { PlanSummary } from "@/components/plan/badges";
import { FitReason } from "@/components/plan/plan-card";
import { Timeline } from "@/components/plan/timeline";
import { SwapButtons } from "@/components/app/swap-buttons";
import { MarkOpened } from "@/components/app/mark-opened";
import { PlanMap } from "@/components/plan/plan-map";

export const dynamic = "force-dynamic";

/**
 * Plan detail (§33 /app/plans/[id]).
 *
 * The full itinerary, a simple route overview, the swap buttons and — at the
 * bottom, quietly — where each fact came from. Most customers will never open
 * the provenance section, but it is there, and the fact that it can be there
 * is what makes the rest of the page trustworthy (§53).
 */
export default async function PlanPage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/app/plans/${params.id}`);

  const db = userClient();
  const plan = await repo.getPlan(db, params.id);
  if (!plan) notFound();

  const household = await repo.getHouseholdForUser(db, user.id);
  // RLS would refuse the read anyway; this makes the intent explicit.
  if (!household || plan.household_id !== household.id) notFound();

  const market = getMarket(plan.market_id);
  const finish = plan.items[plan.items.length - 1];
  const stops = plan.items.filter((i) => i.lat !== null && i.lng !== null);

  const uncertain = plan.items.filter((i) => i.verification_status === "UNCERTAIN");

  return (
    <div className="space-y-8">
      <MarkOpened planId={plan.id} status={plan.status} />

      <div>
        <Link href="/app" className="text-[15px] text-mist underline-offset-4 hover:underline">
          ← This weekend
        </Link>
      </div>

      <header>
        <SectionLabel>
          {plan.plan_type === "BACKUP" ? "The easy version" : "Your Saturday is sorted"}
        </SectionLabel>
        <h1 className="mt-2.5 text-[30px] leading-[1.12] text-ink sm:text-[38px]">{plan.title}</h1>
        {plan.short_description ? (
          <p className="mt-3 max-w-prose text-[17px] leading-relaxed text-graphite">
            {plan.short_description}
          </p>
        ) : null}
        <p className="mt-3 text-[15px] text-mist">
          {displayDate(plan.weekend_date, market.locale, market.timezone)}
        </p>
      </header>

      <PlanSummary
        market={market}
        weatherSummary={plan.weather_summary}
        costMin={Number(plan.estimated_total_cost_min)}
        costMax={Number(plan.estimated_total_cost_max)}
        activityLevel={plan.activity_level}
        distanceKm={plan.total_activity_distance_km}
        travelMinutes={plan.total_travel_minutes}
      />

      {plan.fit_reason ? <FitReason reason={plan.fit_reason} /> : null}

      <Card className="p-6">
        <Timeline items={plan.items} market={market} />
        {finish ? (
          <p className="mt-4 text-[15px] text-mist">Home around {displayTime(finish.end_time)}</p>
        ) : null}
      </Card>

      {stops.length > 0 ? <PlanMap items={plan.items} /> : null}

      {uncertain.length > 0 ? (
        <div className="rounded-card border border-clayWash bg-clayWash/40 px-5 py-4">
          <p className="text-[14px] font-semibold text-clay">Worth a quick check</p>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-graphite">
            {uncertain.map((item) => (
              <li key={item.id}>
                {item.title} — {item.verification_notes ?? "we couldn’t confirm the hours"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {flags().planSwaps && plan.status !== "COMPLETED" ? (
        <div>
          <SectionLabel>Not quite right?</SectionLabel>
          <p className="mt-1.5 text-[15px] text-graphite">
            We’ll build a different one. No need to explain.
          </p>
          <div className="mt-3">
            <SwapButtons planId={plan.id} />
          </div>
        </div>
      ) : null}

      {["DELIVERED", "OPENED"].includes(plan.status) ? (
        <div className="rule pt-6">
          <SectionLabel>Afterwards</SectionLabel>
          <p className="mt-1.5 text-[15px] text-graphite">
            We’ll ask on Sunday whether you did it — or tell us now.
          </p>
          <div className="mt-3">
            <ButtonLink href={`/app/plans/${plan.id}/feedback`} variant="secondary" size="sm">
              Did you do it?
            </ButtonLink>
          </div>
        </div>
      ) : null}

      <details className="rule pt-6">
        <summary className="cursor-pointer list-none text-[14px] text-mist underline-offset-4 hover:underline">
          Where this information came from
        </summary>
        <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-mist">
          <p>
            Venue details, opening hours and travel times come from live data providers and were
            re-checked before this plan was sent. Costs are estimates unless a published price
            was available. Weather is a forecast.
          </p>
          <ul className="space-y-1.5">
            {plan.items
              .filter((i) => i.provider)
              .map((item) => (
                <li key={item.id}>
                  <span className="text-graphite">{item.title}</span> — {item.provider}
                  {item.verification_timestamp
                    ? `, checked ${new Date(item.verification_timestamp).toLocaleDateString(market.locale)}`
                    : ""}
                </li>
              ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
