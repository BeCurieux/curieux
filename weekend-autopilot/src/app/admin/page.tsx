import Link from "next/link";
import { serviceClient } from "@/lib/supabase/server";
import { Card, SectionLabel } from "@/components/ui";
import { flags } from "@/config/flags";

export const dynamic = "force-dynamic";

/**
 * Founder dashboard (§42, §44, §45).
 *
 * The numbers here are the ones that decide whether the autonomous system is
 * ready: generation success rate, verification pass rate, and — the one that
 * actually matters — the share of delivered plans customers did. Provider cost
 * per plan is next to them, because a product that works but costs more per
 * weekend than it charges is not a product.
 */
export default async function AdminDashboard() {
  const db = serviceClient();

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [
    activeCustomers,
    generationRuns,
    delivered,
    didItYes,
    didItNo,
    pendingReview,
    deadJobs,
    openFlags,
    costRows,
  ] = await Promise.all([
    db.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["PILOT_ACTIVE", "ACTIVE"]),
    db.from("plan_generation_runs").select("succeeded").gte("started_at", since),
    db.from("plan_events").select("id", { count: "exact", head: true }).eq("event_type", "PLAN_DELIVERED").gte("created_at", since),
    db.from("plan_events").select("id", { count: "exact", head: true }).eq("event_type", "DID_IT_YES").gte("created_at", since),
    db.from("plan_events").select("id", { count: "exact", head: true }).eq("event_type", "DID_IT_NO").gte("created_at", since),
    db.from("plans").select("id", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "dead"),
    db.from("admin_flags").select("id", { count: "exact", head: true }).eq("resolved", false),
    db.from("provider_usage").select("estimated_cost_cents, generation_run_id").gte("created_at", since),
  ]);

  const runs = generationRuns.data ?? [];
  const finished = runs.filter((r) => r.succeeded !== null);
  const successRate = finished.length
    ? Math.round((finished.filter((r) => r.succeeded).length / finished.length) * 100)
    : null;

  const deliveredCount = delivered.count ?? 0;
  const yes = didItYes.count ?? 0;
  const no = didItNo.count ?? 0;
  const answered = yes + no;

  // The north-star (§45): the share of delivered plans people actually did.
  const didItRate = deliveredCount > 0 ? Math.round((yes / deliveredCount) * 100) : null;
  const responseRate = deliveredCount > 0 ? Math.round((answered / deliveredCount) * 100) : null;

  const costs = costRows.data ?? [];
  const runIds = new Set(costs.map((c) => c.generation_run_id).filter(Boolean));
  const totalCents = costs.reduce((sum, c) => sum + Number(c.estimated_cost_cents ?? 0), 0);
  const costPerPlan = runIds.size > 0 ? totalCents / runIds.size : null;

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Last 30 days</SectionLabel>
        <h1 className="mt-2 text-[30px] leading-tight text-ink">How the autopilot is doing</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Did it"
          value={didItRate === null ? "—" : `${didItRate}%`}
          hint="of delivered plans — the number that matters"
          emphasis
        />
        <Metric label="Answered" value={responseRate === null ? "—" : `${responseRate}%`} hint="responded on Sunday" />
        <Metric
          label="Generation success"
          value={successRate === null ? "—" : `${successRate}%`}
          hint={`${finished.length} runs`}
        />
        <Metric
          label="Provider cost / plan"
          value={costPerPlan === null ? "—" : `${(costPerPlan / 100).toFixed(2)}`}
          hint="USD, places + routing"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Active customers" value={String(activeCustomers.count ?? 0)} />
        <Metric label="Plans delivered" value={String(deliveredCount)} />
        <Metric label="Loved / good" value={`${yes} yes · ${no} no`} />
      </div>

      {(pendingReview.count ?? 0) > 0 ? (
        <Card className="border-clayWash bg-clayWash/40 p-6">
          <p className="text-[15px] font-semibold text-clay">
            {pendingReview.count} plan{pendingReview.count === 1 ? "" : "s"} waiting for review
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-graphite">
            {flags().requirePlanReview
              ? "REQUIRE_PLAN_REVIEW is on. Nothing is delivered until you approve it."
              : "Review is off, but these were held while it was on."}
          </p>
          <Link
            href="/admin/queue"
            className="mt-3 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
          >
            Review the queue →
          </Link>
        </Card>
      ) : null}

      {(deadJobs.count ?? 0) > 0 || (openFlags.count ?? 0) > 0 ? (
        <Card className="p-6">
          <SectionLabel>Needs attention</SectionLabel>
          <ul className="mt-3 space-y-1.5 text-[15px] text-graphite">
            {(deadJobs.count ?? 0) > 0 ? <li>{deadJobs.count} jobs exhausted their retries</li> : null}
            {(openFlags.count ?? 0) > 0 ? <li>{openFlags.count} unresolved generation failures</li> : null}
          </ul>
        </Card>
      ) : null}

      <Card className="p-6">
        <SectionLabel>Turning review off</SectionLabel>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-graphite">
          Review is a training wheel, not architecture. The bar for setting{" "}
          <code className="rounded bg-paper px-1.5 py-0.5 text-[13px]">REQUIRE_PLAN_REVIEW=false</code>{" "}
          is a generation success rate above roughly 95% and a review pass rate where you are
          approving nearly everything unchanged. Until then, what you reject is the most
          valuable data in the product — it is where the autonomous system is still wrong.
        </p>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <Card className={`p-5 ${emphasis ? "border-forest/30 bg-sage/40" : ""}`}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className="tabular mt-1.5 font-display text-[30px] leading-none text-ink">{value}</p>
      {hint ? <p className="mt-1.5 text-[13px] text-mist">{hint}</p> : null}
    </Card>
  );
}
