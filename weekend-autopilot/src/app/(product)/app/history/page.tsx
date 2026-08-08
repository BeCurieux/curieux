import Link from "next/link";
import { redirect } from "next/navigation";
import { getMarket, formatDistance } from "@/config/markets";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { displayDate } from "@/lib/util/time";
import { EmptyState, SectionLabel, ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";

const RATING_LABEL: Record<string, string> = {
  LOVED: "😍 Loved it",
  GOOD: "🙂 Good",
  FINE: "😐 Fine",
  NOT_FOR_ME: "🙅 Not for me",
};

/**
 * History (§35).
 *
 * A chronological archive rather than a dashboard. The stats at the top are
 * the raw material for "Your 52" later — weekends done, distance walked, new
 * places — which is why the history is preserved in this shape now even though
 * that feature is not built (§35).
 */
export default async function HistoryPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app/history");

  const db = userClient();
  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household) redirect("/onboarding");

  const market = getMarket(household.market_id);
  const plans = await repo.getPlanHistory(db, household.id, 60);

  const done = plans.filter((p) => p.feedback?.did_it === "YES");
  const distanceKm = done.reduce((sum, p) => sum + (p.total_activity_distance_km ?? 0), 0);

  if (plans.length === 0) {
    return (
      <EmptyState
        title="No weekends yet"
        description="Your first plan will appear here once it’s been sent. After that this becomes a record of the year — where you went, what you did, what you loved."
        action={<ButtonLink href="/app">This weekend</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Your weekends</SectionLabel>
        <h1 className="mt-2 text-[28px] leading-tight text-ink">
          {done.length} of {plans.length} done
        </h1>
        {distanceKm > 0 ? (
          <p className="mt-1.5 text-[15px] text-mist">
            {formatDistance(market, distanceKm)} explored on foot
          </p>
        ) : null}
      </div>

      <ol className="rule">
        {plans.map((plan) => (
          <li key={plan.id} className="border-b border-rule py-5">
            <Link href={`/app/plans/${plan.id}`} className="group block">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[14px] text-mist">
                  {displayDate(plan.weekend_date, market.locale, market.timezone)}
                </span>
                {plan.feedback ? (
                  <span className="shrink-0 text-[14px] text-mist">
                    {plan.feedback.did_it === "YES"
                      ? (RATING_LABEL[plan.feedback.rating ?? ""] ?? "Did it")
                      : "Didn’t do it"}
                  </span>
                ) : (
                  <span className="shrink-0 text-[14px] text-clay">No answer yet</span>
                )}
              </div>
              <h2 className="mt-1 font-display text-[20px] leading-snug text-ink group-hover:text-forest">
                {plan.title}
              </h2>
              {plan.short_description ? (
                <p className="mt-1 text-[15px] leading-relaxed text-graphite">
                  {plan.short_description}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
