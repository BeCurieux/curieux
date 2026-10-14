import Link from "next/link";
import type { Metadata } from "next";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { PromptToTool } from "@/components/brand/PromptToTool";
import { miniFromDocument } from "@/components/widget/MiniWidget";
import { ArrowRightIcon, PlusIcon } from "@/components/ui/Icons";
import { hostedUrl } from "@/config/brand";
import { currentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { emptyStats, summarise } from "@/lib/analytics/events";
import { can, interactionLimit, PLANS, widgetLimit } from "@/lib/plans";

export const metadata: Metadata = { title: "Your widgets" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  const store = getStore();
  const widgets = user ? await store.listWidgets(user.id) : [];
  const plan = PLANS[user?.plan ?? "free"];
  const analyticsAllowed = can(plan.id, "analytics");

  const cards = await Promise.all(
    widgets.map(async (widget) => {
      const stats = analyticsAllowed
        ? summarise(await store.listEvents(widget.id), await store.countLeads(widget.id))
        : emptyStats();
      return { widget, stats };
    })
  );

  const used = user ? await store.countInteractionsThisMonth(user.id) : 0;
  const limit = interactionLimit(plan.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title">Your widgets</h1>
          <p className="mt-2 text-sm text-slate">
            {widgets.length === 0
              ? "Nothing here yet."
              : `${widgets.length} of ${widgetLimit(plan.id)} on your ${plan.name} plan.`}
          </p>
        </div>

        <Link href="/dashboard/widgets/new" className="btn">
          <PlusIcon size={18} />
          New widget
        </Link>
      </div>

      {widgets.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map(({ widget, stats }) => (
              <WidgetCard
                key={widget.id}
                id={widget.id}
                name={widget.name}
                type={widget.type}
                slug={widget.slug}
                status={widget.status}
                updatedAt={widget.updatedAt}
                stats={stats}
                hostedUrl={hostedUrl(widget.slug)}
                analyticsAllowed={analyticsAllowed}
                preview={miniFromDocument(widget.published ?? widget.draft)}
              />
            ))}
          </div>

          {/* Running out has a consequence, so the strip that counts it says
              so — finding out from a paused widget is finding out too late. */}
          <div
            className={`mt-8 flex flex-wrap items-center justify-between gap-3 rounded-card border px-5 py-4 ${
              used >= limit ? "border-coral/40 bg-coral-soft" : "border-rule bg-white"
            }`}
          >
            <p className="text-sm text-slate">
              <strong className="font-bold text-navy">{used.toLocaleString()}</strong> of{" "}
              {limit.toLocaleString()} interactions used this month.
              {used >= limit ? (
                <span className="font-semibold text-navy">
                  {" "}
                  Your published widgets are paused until the 1st.
                </span>
              ) : null}
            </p>
            {/* Paused, this points at the control rather than the sales page:
                the thing that actually restarts your widgets lives in
                settings. Under the limit there is nothing to do, so it stays
                the ordinary comparison link. */}
            {used >= limit ? (
              <Link
                href="/dashboard/settings"
                className="btn py-2 text-sm"
              >
                Bring them back
              </Link>
            ) : (
              <Link href="/pricing" className="text-sm font-semibold text-purple hover:underline">
                See plans →
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** §39: not a blank grey box. */
function EmptyState() {
  return (
    <div className="mt-8 rounded-panel border border-dashed border-rule bg-white px-6 py-16 text-center">
      {/* One mark that says what happens next, rather than three drawings
          of nothing in particular. */}
      <PromptToTool height={64} className="mx-auto text-navy" />

      <h2 className="mt-6 text-xl font-bold">You haven&rsquo;t made anything yet.</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate">
        Tell us what you want your website to do, and we&rsquo;ll build the first one for you.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard/widgets/new" className="btn btn-lg">
          Build my first widget
          <ArrowRightIcon size={18} />
        </Link>
        <Link href="/templates" className="btn-secondary btn-lg">
          Browse templates
        </Link>
      </div>
    </div>
  );
}
