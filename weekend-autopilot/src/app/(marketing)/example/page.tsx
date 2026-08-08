import type { Metadata } from "next";
import { defaultMarket } from "@/config/markets";
import { ButtonLink, Card, SectionLabel } from "@/components/ui";
import { PlanSummary } from "@/components/plan/badges";
import { FitReason } from "@/components/plan/plan-card";
import { Timeline } from "@/components/plan/timeline";
import { EXAMPLE_BACKUP, EXAMPLE_PLAN } from "@/lib/example-plan";
import { displayTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "An example weekend" };

export default function ExamplePage() {
  const market = defaultMarket();
  const plan = EXAMPLE_PLAN;
  const finish = plan.items[plan.items.length - 1];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <SectionLabel>An example weekend</SectionLabel>
      <h1 className="mt-3 text-[36px] leading-[1.1] text-ink sm:text-[46px]">
        This is what Thursday looks like.
      </h1>
      <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-graphite">
        Written out in full, as it would appear in the app. An illustration rather than a live
        recommendation — a real plan names real venues, checked that morning.
      </p>

      <Card className="mt-10 p-6 sm:p-8">
        <SectionLabel>Your Saturday is sorted</SectionLabel>
        <h2 className="mt-2.5 text-[28px] leading-tight text-ink">{plan.title}</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-graphite">{plan.short_description}</p>

        <div className="mt-6">
          <Timeline items={plan.items} market={market} />
        </div>

        {finish ? (
          <p className="mt-4 text-[15px] text-mist">Home around {displayTime(finish.end_time)}</p>
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

        <FitReason reason={plan.fit_reason} className="mt-6" />
      </Card>

      <div className="mt-8">
        <SectionLabel>And the backup</SectionLabel>
        <Card className="mt-3 p-6">
          <h3 className="font-display text-[22px] leading-snug text-ink">{EXAMPLE_BACKUP.title}</h3>
          <p className="mt-2 text-[16px] leading-relaxed text-graphite">
            {EXAMPLE_BACKUP.short_description}
          </p>
          <div className="mt-4">
            <PlanSummary
              market={market}
              weatherSummary={EXAMPLE_BACKUP.weather_summary}
              costMin={Number(EXAMPLE_BACKUP.estimated_total_cost_min)}
              costMax={Number(EXAMPLE_BACKUP.estimated_total_cost_max)}
              activityLevel={EXAMPLE_BACKUP.activity_level}
              distanceKm={EXAMPLE_BACKUP.total_activity_distance_km}
              travelMinutes={EXAMPLE_BACKUP.total_travel_minutes}
            />
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-mist">
            The backup is always easier in at least one way — shorter, closer, cheaper or more
            weather-proof. It exists for the Saturday you read the main plan and feel tired.
          </p>
        </Card>
      </div>

      <div className="mt-12">
        <ButtonLink href="/pricing" size="lg">
          Plan my next 4 weekends
        </ButtonLink>
      </div>
    </div>
  );
}
