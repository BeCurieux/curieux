"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePlan, regeneratePlan, rejectPlan } from "@/app/admin/actions";
import { Button, Card, SectionLabel } from "@/components/ui";
import { Timeline } from "@/components/plan/timeline";
import { PlanSummary } from "@/components/plan/badges";
import type { Market } from "@/config/markets";
import type { Plan, PlanItem } from "@/lib/types";
import { displayDate } from "@/lib/util/time";

interface DiagnosticsShape {
  stage?: string;
  intents?: Array<{ query: string; role: string }>;
  candidatesRetrieved?: number;
  candidatesRejected?: Array<{ name: string; rule: string; detail: string }>;
  shortlist?: Array<{ name: string; score: number }>;
  bundlesAssembled?: Array<{ bundle_id: string; archetype: string; score: number }>;
  verification?: Array<{ bundle_id: string; score: number; passed: boolean; failures: string[] }>;
  critique?: Array<{ bundle_id: string; approve: boolean; problems: string[] }>;
  emptyIntents?: string[];
  providerCostCents?: number;
}

/**
 * AdminPlanInspector (§37, §42).
 *
 * Everything the pipeline did, in the order it did it. The point is not to
 * admire the plan but to see where the reasoning went wrong — which is why the
 * rejected candidates carry their rule names, not just a count.
 */
export function AdminPlanInspector({
  plan,
  items,
  market,
  run,
  preferences,
  members,
}: {
  plan: Plan;
  items: PlanItem[];
  market: Market;
  run: { diagnostics?: unknown; provider_cost_cents?: number; error?: string | null } | null;
  preferences: Record<string, unknown> | null;
  members: Array<{ member_type: string; age: number | null; mobility_notes: string | null }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const diagnostics = (run?.diagnostics ?? {}) as DiagnosticsShape;

  function act(action: "approve" | "regenerate" | "reject") {
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approvePlan(plan.id)
          : action === "regenerate"
            ? await regeneratePlan(plan.id, note)
            : await rejectPlan(plan.id, note);
      setMessage(result.ok ? (result.message ?? "Done") : (result.error ?? "Failed"));
      if (result.ok) router.refresh();
    });
  }

  const children = members.filter((m) => m.member_type === "CHILD");

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>
            {plan.plan_type} · {plan.status}
          </SectionLabel>
          <h2 className="mt-1.5 text-[24px] leading-tight text-ink">{plan.title}</h2>
          <p className="mt-1 text-[14px] text-mist">
            {displayDate(plan.weekend_date, market.locale, market.timezone)} · household{" "}
            {plan.household_id.slice(0, 8)}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-[13px] text-mist">
            score {plan.base_score} · verified {Math.round(plan.verification_score * 100)}% ·
            confidence {Math.round(plan.confidence_score * 100)}%
          </p>
          {run?.provider_cost_cents !== undefined ? (
            <p className="tabular text-[13px] text-mist">
              cost {(Number(run.provider_cost_cents) / 100).toFixed(3)} USD
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
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

      {plan.fit_reason ? (
        <p className="mt-4 border-l-2 border-forest pl-4 font-display text-[16px] italic leading-relaxed text-graphite">
          {plan.fit_reason}
        </p>
      ) : null}

      <div className="mt-5 rounded-card border border-rule bg-paper px-5">
        <Timeline items={items} market={market} />
      </div>

      {/* ------------------------------------------------------ household */}
      <details className="mt-5">
        <summary className="cursor-pointer text-[14px] font-semibold text-graphite">
          Household profile
        </summary>
        <div className="mt-3 space-y-1.5 text-[14px] text-graphite">
          <p>
            {members.filter((m) => m.member_type === "ADULT").length} adults
            {children.length > 0
              ? `, children aged ${children.map((c) => c.age ?? "?").join(", ")}`
              : ""}
          </p>
          {children.some((c) => c.mobility_notes) ? (
            <p>Mobility: {children.map((c) => c.mobility_notes).filter(Boolean).join("; ")}</p>
          ) : null}
          {preferences ? (
            <pre className="overflow-x-auto rounded-lg bg-paper p-3 text-[12px] leading-relaxed text-mist">
              {JSON.stringify(preferences, null, 1)}
            </pre>
          ) : null}
        </div>
      </details>

      {/* ---------------------------------------------------- diagnostics */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[14px] font-semibold text-graphite">
          Pipeline · {diagnostics.candidatesRetrieved ?? 0} candidates,{" "}
          {diagnostics.candidatesRejected?.length ?? 0} rejected
        </summary>

        <div className="mt-4 space-y-5 text-[14px]">
          {diagnostics.intents && diagnostics.intents.length > 0 ? (
            <Block title="Search intents">
              <ul className="space-y-1">
                {diagnostics.intents.map((intent, i) => (
                  <li key={i} className="text-graphite">
                    <span className="text-mist">{intent.role}</span> — {intent.query}
                  </li>
                ))}
              </ul>
              {diagnostics.emptyIntents && diagnostics.emptyIntents.length > 0 ? (
                <p className="mt-2 text-clay">
                  Returned nothing: {diagnostics.emptyIntents.join(", ")}
                </p>
              ) : null}
            </Block>
          ) : null}

          {diagnostics.shortlist && diagnostics.shortlist.length > 0 ? (
            <Block title="Shortlist">
              <ul className="space-y-1">
                {diagnostics.shortlist.map((c, i) => (
                  <li key={i} className="flex justify-between gap-4 text-graphite">
                    <span>{c.name}</span>
                    <span className="tabular text-mist">{c.score.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {diagnostics.candidatesRejected && diagnostics.candidatesRejected.length > 0 ? (
            <Block title="Rejected, and why">
              <ul className="space-y-1">
                {diagnostics.candidatesRejected.slice(0, 30).map((c, i) => (
                  <li key={i} className="text-graphite">
                    <span className="text-ink">{c.name}</span>{" "}
                    <span className="text-clay">{c.rule}</span>{" "}
                    <span className="text-mist">— {c.detail}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {diagnostics.bundlesAssembled && diagnostics.bundlesAssembled.length > 0 ? (
            <Block title="Assembled plans">
              <ul className="space-y-1">
                {diagnostics.bundlesAssembled.map((b) => (
                  <li key={b.bundle_id} className="flex justify-between gap-4 text-graphite">
                    <span>
                      {b.bundle_id} · {b.archetype}
                    </span>
                    <span className="tabular text-mist">{b.score.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {diagnostics.verification && diagnostics.verification.length > 0 ? (
            <Block title="Verification">
              <ul className="space-y-1">
                {diagnostics.verification.map((v, i) => (
                  <li key={i} className="text-graphite">
                    {v.bundle_id} · {Math.round(v.score * 100)}%{" "}
                    <span className={v.passed ? "text-forest" : "text-clay"}>
                      {v.passed ? "passed" : "failed"}
                    </span>
                    {v.failures.length > 0 ? (
                      <span className="text-mist"> — {v.failures.join("; ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {diagnostics.critique && diagnostics.critique.length > 0 ? (
            <Block title="Critic">
              <ul className="space-y-1">
                {diagnostics.critique.map((c, i) => (
                  <li key={i} className="text-graphite">
                    {c.approve ? "approved" : "blocked"}
                    {c.problems.length > 0 ? ` — ${c.problems.join("; ")}` : ""}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {run?.error ? <p className="text-clay">Run error: {run.error}</p> : null}
        </div>
      </details>

      {/* --------------------------------------------------------- actions */}
      {plan.status === "PENDING_REVIEW" ? (
        <div className="mt-6 space-y-3 border-t border-rule pt-5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What’s wrong with it? (recorded for regenerate/reject)"
            className="h-11 w-full rounded-xl border border-rule bg-white px-4 text-[14px] text-ink placeholder:text-mist"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => act("approve")}>
              Approve &amp; deliver
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("regenerate")}>
              Regenerate
            </Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => act("reject")}>
              Reject
            </Button>
          </div>
          {message ? (
            <p aria-live="polite" className="text-[14px] text-forest">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mist">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
