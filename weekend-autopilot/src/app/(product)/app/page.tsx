import { redirect } from "next/navigation";
import Link from "next/link";
import { getMarket } from "@/config/markets";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { upcomingWeekendDate, displayDate } from "@/lib/util/time";
import { deterministicInsight } from "@/lib/taste/summary";
import { ButtonLink, Card, EmptyState, SectionLabel } from "@/components/ui";
import { BackupPlanCard, WeekendPlanCard } from "@/components/plan/plan-card";
import { GenerationError } from "@/components/plan/states";
import { CheckinCard } from "@/components/app/checkin-card";
import { TasteInsight } from "@/components/app/taste-insight";
import { category } from "@/config/taxonomy";

export const dynamic = "force-dynamic";

/**
 * The dashboard (§34).
 *
 * Deliberately close to empty. One plan, a smaller backup, an optional
 * ten-second check-in and one line of what we have learned. Everything else a
 * product like this could show — streaks, badges, a feed — would work against
 * the promise, which is that you do not have to engage with this thing.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app");

  const db = userClient();
  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household) redirect("/onboarding");

  const preferences = await repo.getPreferences(db, household.id);
  if (!preferences || household.home_lat === null) redirect("/onboarding");

  const market = getMarket(household.market_id);
  const weekendDate = upcomingWeekendDate(market);

  const [plans, checkin, stats, taste, subscription] = await Promise.all([
    repo.getPlansForWeekend(db, household.id, weekendDate),
    repo.getCheckin(db, household.id, weekendDate),
    repo.getCategoryStats(db, household.id),
    repo.getTasteSignals(db, household.id),
    repo.getSubscription(db, household.id),
  ]);

  const primary = plans.find((p) => p.plan_type === "PRIMARY") ?? null;
  const backup = plans.find((p) => p.plan_type === "BACKUP") ?? null;

  // Plans that are still being built, or held for review, are not shown as
  // plans — a customer should never see a PENDING_REVIEW plan (§42).
  const visiblePrimary =
    primary && ["READY", "DELIVERED", "OPENED", "COMPLETED"].includes(primary.status)
      ? primary
      : null;
  const stillWorking =
    primary !== null &&
    ["QUEUED", "DISCOVERING", "BUILDING", "VERIFYING", "PENDING_REVIEW"].includes(primary.status);

  const insight = deterministicInsight(stats);

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>This weekend</SectionLabel>
        <p className="mt-1 text-[15px] text-mist">
          {displayDate(weekendDate, market.locale, market.timezone)}
        </p>
      </div>

      {visiblePrimary ? (
        <>
          <WeekendPlanCard plan={visiblePrimary} market={market} />
          {backup && backup.status !== "REJECTED" ? <BackupPlanCard plan={backup} /> : null}
        </>
      ) : stillWorking ? (
        <Card className="p-7">
          <SectionLabel>Almost there</SectionLabel>
          <h2 className="mt-2 text-[22px] leading-snug text-ink">
            We’re putting this weekend together.
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-graphite">
            It lands in your inbox on Thursday morning. We check opening hours and travel times
            before we send anything, which is why it isn’t instant.
          </p>
        </Card>
      ) : subscription && ["PILOT_ACTIVE", "ACTIVE", "TRIAL"].includes(subscription.status) ? (
        <GenerationError />
      ) : (
        <EmptyState
          title="No weekends scheduled"
          description="Your pilot has finished. Start it up again and we’ll pick up where your preferences left off — we haven’t forgotten what you like."
          action={<ButtonLink href="/app/billing">See the options</ButtonLink>}
        />
      )}

      <CheckinCard
        weekendDate={weekendDate}
        existing={
          checkin
            ? { energy: checkin.energy, budget: checkin.budget, time: checkin.time, note: checkin.note }
            : null
        }
        hasPlan={visiblePrimary !== null}
      />

      {insight ? <TasteInsight insight={insight} /> : null}

      {stats.some((s) => s.completed_count > 0) ? (
        <div>
          <SectionLabel>What we’ve learned</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats
              .filter((s) => s.completed_count > 0)
              .sort((a, b) => b.completed_count - a.completed_count)
              .slice(0, 6)
              .map((s) => (
                <span
                  key={s.category_id}
                  className="rounded-full border border-rule bg-white px-3 py-1.5 text-[14px] text-graphite"
                >
                  {category(s.category_id)?.label ?? s.category_id}
                  <span className="ml-1.5 text-mist">×{s.completed_count}</span>
                </span>
              ))}
          </div>
          <Link
            href="/app/history"
            className="mt-4 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
          >
            Your weekends so far →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
