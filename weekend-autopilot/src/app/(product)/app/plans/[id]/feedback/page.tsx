import { notFound, redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { SectionLabel } from "@/components/ui";
import { FeedbackFlow } from "@/components/app/feedback-flow";

export const dynamic = "force-dynamic";

/**
 * "Did you do it?" (§24).
 *
 * Reachable from the Sunday email with `?did=yes` or `?did=no` already set, so
 * the tap in the inbox is the answer and this page only collects the optional
 * detail. That matters: the north-star metric is the share of plans people
 * actually do, and every extra step between the email and the answer costs us
 * the number we most need.
 */
export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { did?: string };
}) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/app/plans/${params.id}/feedback`);

  const db = userClient();
  const plan = await repo.getPlan(db, params.id);
  if (!plan) notFound();

  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household || plan.household_id !== household.id) notFound();

  const { data: existing } = await db
    .from("plan_feedback")
    .select("did_it, rating")
    .eq("plan_id", plan.id)
    .maybeSingle();

  const prefilled =
    searchParams.did === "yes" ? "YES" : searchParams.did === "no" ? "NO" : null;

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <div>
        <SectionLabel>Last weekend</SectionLabel>
        <h1 className="mt-2 text-[26px] leading-snug text-ink">{plan.title}</h1>
      </div>

      <FeedbackFlow
        planId={plan.id}
        initialDidIt={(existing?.did_it as "YES" | "NO" | undefined) ?? prefilled}
        alreadyAnswered={Boolean(existing)}
      />
    </div>
  );
}
