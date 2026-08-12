import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DropOff, Funnel, Sparkbars, StatTile } from "@/components/dashboard/Charts";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { currentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { dropOff, summarise } from "@/lib/analytics/events";
import { can, nextPlanUp, PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const DAYS = 14;

/** Analytics for one widget (brief §25). */
export default async function AnalyticsPage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect("/dashboard");

  const store = getStore();
  const widget = await store.getWidget(params.id);
  if (!widget || widget.ownerId !== user.id) notFound();

  const plan = PLANS[user.plan];

  if (!can(plan.id, "analytics")) {
    const upgrade = nextPlanUp(plan.id);
    return (
      <div className="mx-auto max-w-lg text-center">
        <BackLink id={widget.id} />
        <h1 className="mt-6 text-title">Analytics come with {upgrade?.name ?? "Pro"}</h1>
        <p className="mt-3 text-slate">
          We&rsquo;re still counting views, starts and completions for {widget.name} — you&rsquo;ll see
          the whole history the moment you upgrade. Nothing is lost in the meantime.
        </p>
        <Link href="/pricing" className="btn btn-lg mt-6">
          See plans
        </Link>
      </div>
    );
  }

  const events = await store.listEvents(widget.id);
  const leads = await store.listLeads(widget.id, 25);
  const stats = summarise(events, await store.countLeads(widget.id));

  // Completions per day for the last fortnight.
  const byDay = new Map<string, number>();
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    byDay.set(date.toISOString().slice(0, 10), 0);
  }
  for (const event of events) {
    if (event.type !== "widget_complete") continue;
    const day = event.createdAt.slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const points = [...byDay.entries()].map(([day, value]) => ({ day: day.slice(5), value }));

  // Drop-off is measured against the *published* document, because that's the
  // one visitors met. Reading the draft would relabel history the moment you
  // renamed a question, and would list a draft-only question as a question
  // nobody got past — a 100% cliff for something never put in front of anyone.
  const measured = widget.published ?? widget.draft;
  const steps = dropOff(events, measured.steps, stats.starts);

  return (
    <>
      <BackLink id={widget.id} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title">{widget.name}</h1>
          <p className="mt-1 text-sm text-slate">
            {widget.status === "published"
              ? "Everything since you published it."
              : "This widget isn't published yet, so there's nothing to count."}
          </p>
        </div>
        <Link href={`/dashboard/widgets/${widget.id}`} className="btn-secondary">
          Edit widget
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Views" value={stats.views.toLocaleString()} hint="People who saw it" />
        <StatTile label="Starts" value={stats.starts.toLocaleString()} hint="People who answered something" />
        <StatTile
          label="Completed"
          value={stats.completions.toLocaleString()}
          hint={stats.starts > 0 ? `${stats.completionRate}% of starts` : "No starts yet"}
        />
        <StatTile label="CTA clicks" value={stats.ctaClicks.toLocaleString()} hint="Pressed the button" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-sm font-bold">Where people get to</h2>
          <div className="mt-5">
            <Funnel
              stages={[
                { label: "Saw it", value: stats.views, tone: "purple" },
                { label: "Started", value: stats.starts, tone: "mint" },
                { label: "Finished", value: stats.completions, tone: "yellow" },
                { label: "Clicked through", value: stats.ctaClicks, tone: "coral" },
              ]}
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-bold">Completions, last {DAYS} days</h2>
          <div className="mt-5">
            <Sparkbars points={points} label={`Completions per day for ${widget.name}`} />
          </div>
        </div>
      </div>

      {/* Where people drop out — the most useful thing on this page (§25). */}
      <div className="card mt-6 p-6">
        <h2 className="text-sm font-bold">Question by question</h2>
        <p className="mt-1 text-xs text-muted">How many people got past each one.</p>

        <div className="mt-5">
          <DropOff steps={steps} />
        </div>
      </div>

      <div className="card mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Enquiries</h2>
          <span className="text-xs font-semibold text-muted">{stats.leads.toLocaleString()} total</span>
        </div>

        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-slate">
            Nothing yet. They&rsquo;ll appear here with the answers that produced their quote.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">Contact</th>
                  <th className="py-2 pr-4 font-semibold">Result</th>
                  <th className="py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-rule/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-navy">{lead.name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-slate">
                      {lead.email ?? lead.phone ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate">
                      {String((lead.metadata as { result?: string } | null)?.result ?? "—")}
                    </td>
                    <td className="py-2.5 text-muted">{lead.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link href={`/dashboard/widgets/${id}`} className="btn-ghost -ml-2">
      <ArrowLeftIcon size={16} />
      Back to the builder
    </Link>
  );
}
