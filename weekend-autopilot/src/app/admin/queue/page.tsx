import { serviceClient } from "@/lib/supabase/server";
import { getMarket } from "@/config/markets";
import { EmptyState, SectionLabel } from "@/components/ui";
import { AdminPlanInspector } from "@/components/admin/plan-inspector";
import type { Plan, PlanItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The plan queue (§42).
 *
 * Everything the founder needs to judge a plan without opening the database:
 * the household’s profile, the weather, the candidates that were considered,
 * what was rejected and why, the scores, the verification result and the
 * model’s reasoning. Approve, regenerate or reject.
 *
 * The rejections list is the most valuable part. During the first cohort it is
 * where you find out that the engine keeps proposing something a human would
 * never send — and that is a filter or a weight, not a one-off correction.
 */
export default async function AdminQueuePage() {
  const db = serviceClient();

  const { data: plans } = await db
    .from("plans")
    .select("*, plan_items(*)")
    .in("status", ["PENDING_REVIEW", "READY"])
    .order("created_at", { ascending: true })
    .limit(25);

  const rows = (plans ?? []) as Array<Plan & { plan_items: PlanItem[] }>;
  const pending = rows.filter((p) => p.status === "PENDING_REVIEW");

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing waiting"
        description="No plans are pending review. New plans appear here after Wednesday’s generation run."
      />
    );
  }

  // Load the generation diagnostics for each plan in one query rather than
  // per-card: this page is opened once a week and read carefully.
  const runIds = rows.map((p) => p.generation_run_id).filter((id): id is string => Boolean(id));
  const { data: runs } = await db
    .from("plan_generation_runs")
    .select("*")
    .in("id", runIds.length > 0 ? runIds : ["00000000-0000-0000-0000-000000000000"]);

  const runsById = new Map((runs ?? []).map((r) => [r.id as string, r]));

  const householdIds = [...new Set(rows.map((p) => p.household_id))];
  const { data: preferences } = await db
    .from("preference_profiles")
    .select("*")
    .in("household_id", householdIds);
  const preferencesByHousehold = new Map(
    (preferences ?? []).map((p) => [p.household_id as string, p])
  );

  const { data: members } = await db
    .from("household_members")
    .select("household_id, member_type, age, mobility_notes")
    .in("household_id", householdIds);

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Plan queue</SectionLabel>
        <h1 className="mt-2 text-[30px] leading-tight text-ink">
          {pending.length} waiting, {rows.length - pending.length} approved
        </h1>
        <p className="mt-2 max-w-prose text-[16px] leading-relaxed text-graphite">
          You are not planning these — you are checking where the autonomous system is still
          wrong. Approve freely; note the pattern when you don’t.
        </p>
      </div>

      <div className="space-y-6">
        {rows.map((plan) => (
          <AdminPlanInspector
            key={plan.id}
            plan={plan}
            items={[...plan.plan_items].sort((a, b) => a.sequence - b.sequence)}
            market={getMarket(plan.market_id)}
            run={runsById.get(plan.generation_run_id ?? "") ?? null}
            preferences={preferencesByHousehold.get(plan.household_id) ?? null}
            members={(members ?? []).filter((m) => m.household_id === plan.household_id)}
          />
        ))}
      </div>
    </div>
  );
}
