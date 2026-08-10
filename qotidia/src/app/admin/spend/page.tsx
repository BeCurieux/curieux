// What the model is costing.
//
// One number matters more than the rest and it is not the total: it is the
// cost of one family's year. A$19 a month only works if a family's model
// time is a small fraction of it, and that is a ratio rather than a bill —
// a total tells you what happened, a per-family figure tells you whether the
// business works.
//
// Refusals are on the page too. A ceiling that stops something is a fact
// about a family who did not get what they were waiting for, and it must be
// visible here rather than only in a log — otherwise the first anybody hears
// of it is a support email asking why a book never generated.

import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser } from "@/lib/supabase/server";
import {
  EVERYBODY_DAILY, FAMILY_MONTHLY, NEVER_LOGGED, asMoney, priceOf,
} from "@/lib/ai/cost";
import { countOf } from "@/lib/words";

export const dynamic = "force-dynamic";

const PERIODS = [1, 7, 30] as const;

export default async function SpendPage(
  props: {
    searchParams: Promise<{ days?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await currentUser();
  if (!user) redirect("/login");

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const days = PERIODS.includes(Number(searchParams.days) as any)
    ? Number(searchParams.days)
    : 7;
  // Read once, here, rather than at each use. This is a server component:
  // it renders once per request, so the clock is a fact about the request
  // rather than an impurity — but the rule cannot tell, so it is named and
  // suppressed in exactly one place instead of scattered.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const since = new Date(now - days * 86_400_000).toISOString();

  const { data } = await admin
    .from("ai_calls")
    .select("family_id, kind, model, input_tokens, output_tokens, cost, refused")
    .gte("created_at", since)
    .limit(100_000);

  const rows = (data ?? []) as any[];
  const total = rows.reduce((n, r) => n + Number(r.cost ?? 0), 0);
  const refusals = rows.filter((r) => r.refused).length;

  // Per family, so the ratio that decides the business is on the page rather
  // than in somebody's head.
  const perFamily = new Map<string, number>();
  for (const r of rows) {
    if (!r.family_id) continue;
    perFamily.set(r.family_id, (perFamily.get(r.family_id) ?? 0) + Number(r.cost ?? 0));
  }
  const families = [...perFamily.values()].sort((a, b) => b - a);
  const worst = families[0] ?? 0;
  const middling = families.length ? families[Math.floor(families.length / 2)] : 0;

  const byKind = new Map<string, { cost: number; calls: number; tokens: number }>();
  for (const r of rows) {
    const at = byKind.get(r.kind) ?? { cost: 0, calls: 0, tokens: 0 };
    at.cost += Number(r.cost ?? 0);
    at.calls += 1;
    at.tokens += Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0);
    byKind.set(r.kind, at);
  }

  const models = [...new Set(rows.map((r) => r.model).filter((m) => m && m !== "none"))];

  return (
    <div className="mx-auto !max-w-2xl py-10">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">Last {countOf(days, "day")}</p>
      <h1 className="mt-3 text-title">What the model costs</h1>

      <p className="mt-4 text-sm">
        {PERIODS.map((d, i) => (
          <span key={d}>
            {i > 0 && " · "}
            <Link href={`/admin/spend?days=${d}`} className={d === days ? "text-ink" : "text-ochre"}>
              {d === 1 ? "today" : `${d} days`}
            </Link>
          </span>
        ))}
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3 text-center">
        {[
          ["Total", asMoney(total)],
          ["Worst family", asMoney(worst)],
          ["Typical family", asMoney(middling)],
        ].map(([label, value]) => (
          <div key={String(label)} className="card">
            <div className="font-display text-2xl">{value}</div>
            <div className="text-xs uppercase tracking-wider text-stone">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 max-w-[52ch] text-xs leading-relaxed text-stone">
        The middle column is the one that decides whether the price works.
        Ceilings: {asMoney(FAMILY_MONTHLY)} per family per month,{" "}
        {asMoney(EVERYBODY_DAILY)} across everybody per day.
      </p>

      {/* A ceiling that stopped something is a family who did not get what
          they were waiting for. It belongs at the top, not in a log. */}
      {refusals > 0 && (
        <div className="mt-8 rounded-2xl border border-clay bg-card p-5">
          <p className="font-display text-lg">
            {countOf(refusals, "call")} refused by a ceiling
          </p>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed">
            Somebody is waiting for something that did not happen. Either the
            ceiling is too low or something is looping.
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg">Where it goes</h2>
        <ul className="mt-4 space-y-1.5 text-sm">
          {[...byKind.entries()]
            .sort((a, b) => b[1].cost - a[1].cost)
            .map(([kind, at]) => (
              <li key={kind} className="flex flex-wrap justify-between gap-x-4 border-b border-rule py-2">
                <span>{kind}</span>
                <span className="text-stone">
                  {asMoney(at.cost)}
                  <span className="ml-3 text-xs">
                    {countOf(at.calls, "job")} · {at.tokens.toLocaleString()} tokens
                  </span>
                </span>
              </li>
            ))}
          {byKind.size === 0 && <li className="text-stone">Nothing in this period.</li>}
        </ul>
      </section>

      {/* Which prices these figures were computed with. An unknown model is
          priced high on purpose — see lib/ai/cost.ts — and seeing an
          unexpectedly large number here is how you find out the model name
          changed and nobody updated the table. */}
      <section className="mt-10">
        <h2 className="text-lg">Prices used</h2>
        <ul className="mt-4 space-y-1.5 text-sm">
          {models.map((m) => {
            const p = priceOf(m);
            return (
              <li key={m} className="flex flex-wrap justify-between gap-x-4 border-b border-rule py-2">
                <span className="font-mono text-xs">{m}</span>
                <span className="text-xs text-stone">
                  in {asMoney(p.inPerM)} · out {asMoney(p.outPerM)} per million
                </span>
              </li>
            );
          })}
          {models.length === 0 && <li className="text-stone">No calls yet.</li>}
        </ul>
        <p className="mt-3 max-w-[52ch] text-xs leading-relaxed text-stone">
          Check these against the provider&rsquo;s current pricing. They are a
          default, overridable from the environment, and a model this table
          has never heard of is deliberately priced high rather than free.
        </p>
      </section>

      <section className="mt-10 border-t border-rule pt-8">
        <h2 className="text-lg">What isn&rsquo;t in this</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-1 text-sm text-stone sm:grid-cols-2">
          {NEVER_LOGGED.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="text-clay">&mdash;</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[52ch] text-xs leading-relaxed text-stone">
          Token counts and a model name. This table knows which family a job
          was for, because cost is a fact about an account in the way stored
          bytes already are &mdash; and it knows nothing whatever about what
          was said.
        </p>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/admin" className="text-ochre">Back to admin</Link>
      </p>
    </div>
  );
}
