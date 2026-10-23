import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdminEmail, serverEnv } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { systemRepo } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui/card";
import { FUNNEL_EVENTS } from "@/lib/analytics/metrics";
import { CATALOGUE } from "@/content/catalogue";
import { METHODOLOGY } from "@/content/methodology";
import { MODULES } from "@/lib/domain/modules";

export const metadata: Metadata = { title: "Founder dashboard" };

// For the founder: is anyone using what they make, and what does it cost?
// Aggregate numbers only — no customer's business details appear here.
export default async function Admin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) notFound();
  const m = await systemRepo().adminMetrics();
  const e = (name: string) => m.events[name] ?? 0;
  const rate = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
  const funnel: [string, number, string][] = [
    ["Landing views", e("landing_viewed"), ""],
    [
      "Free previews started",
      e("preview_started"),
      rate(e("preview_started"), e("landing_viewed")),
    ],
    ["Signups", e("signup_completed"), rate(e("signup_completed"), e("preview_started"))],
    [
      "Business profiles",
      e("profile_completed"),
      rate(e("profile_completed"), e("signup_completed")),
    ],
    [
      "Checkouts started",
      e("checkout_started"),
      rate(e("checkout_started"), e("profile_completed")),
    ],
    [
      "Verified purchases",
      e("purchase_verified"),
      rate(e("purchase_verified"), e("checkout_started")),
    ],
    ["Refunds", e("purchase_refunded"), rate(e("purchase_refunded"), e("purchase_verified"))],
  ];
  const usage: [string, number][] = [
    ["Generations requested", e("generation_requested")],
    ["Generations succeeded", e("generation_succeeded")],
    ["Generations failed", e("generation_failed")],
    ["Assets edited", e("asset_edited")],
    ["Assets copied", e("asset_copied")],
    ["Assets downloaded", e("asset_downloaded")],
    ["Packs exported", e("pack_exported")],
    ["Checklist updates", e("task_updated")],
  ];
  const env = serverEnv();
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <PageHeader eyebrow="Founder dashboard" title="Are people using what they make?">
        Last 90 days of events. Measures use, not just generation.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl">Funnel</h2>
          <table className="mt-4 w-full text-left text-sm">
            <tbody>
              {funnel.map(([label, n, r]) => (
                <tr key={label} className="border-line border-t">
                  <th className="py-2 font-medium">{label}</th>
                  <td className="font-num py-2 text-right text-xl">{n}</td>
                  <td className="text-mute w-16 py-2 text-right">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="text-2xl">Use</h2>
          <table className="mt-4 w-full text-left text-sm">
            <tbody>
              {usage.map(([label, n]) => (
                <tr key={label} className="border-line border-t">
                  <th className="py-2 font-medium">{label}</th>
                  <td className="font-num py-2 text-right text-xl">{n}</td>
                </tr>
              ))}
              <tr className="border-line border-t">
                <th className="py-2 font-medium">Copies + downloads per successful generation</th>
                <td className="font-num py-2 text-right text-xl">
                  {e("generation_succeeded")
                    ? (
                        (e("asset_copied") + e("asset_downloaded")) /
                        e("generation_succeeded")
                      ).toFixed(1)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="text-2xl">Customers and cost</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-mute">Accounts</dt>
              <dd className="font-num text-3xl">{m.users}</dd>
            </div>
            <div>
              <dt className="text-mute">Paying customers</dt>
              <dd className="font-num text-3xl">{m.payingCustomers}</dd>
            </div>
            <div>
              <dt className="text-mute">7-day repeat users</dt>
              <dd className="font-num text-3xl">{m.repeatUsers7d}</dd>
            </div>
            <div>
              <dt className="text-mute">30-day repeat users</dt>
              <dd className="font-num text-3xl">{m.repeatUsers30d}</dd>
            </div>
            <div>
              <dt className="text-mute">AI cost, last 30 days</dt>
              <dd className="font-num text-3xl">US${m.costLast30Days.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-mute">Avg cost per paying customer</dt>
              <dd className="font-num text-3xl">
                {m.payingCustomers
                  ? `US$${(m.costLast30Days / m.payingCustomers).toFixed(2)}`
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-mute mt-4 text-sm">
            Daily AI ceiling: US${env.EMPIRE_AI_DAILY_BUDGET_USD}. Provider:{" "}
            {env.EMPIRE_AI_PROVIDER} ({env.EMPIRE_AI_MODEL}).
          </p>
        </Card>
        <Card>
          <h2 className="text-2xl">Where signups come from</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {Object.entries(m.sources)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <li key={s} className="border-line flex justify-between border-t py-2">
                  <span>{s}</span>
                  <span>{n}</span>
                </li>
              ))}
            {Object.keys(m.sources).length === 0 ? (
              <li className="text-mute">No signups yet. Add ?utm_source=… to links you share.</li>
            ) : null}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-2xl">Marketing funnel by source (last 90 days)</h2>
          <p className="text-mute mt-1 text-sm">
            Counted from our own events only. Instagram reach, followers and Meta ad results
            aren&apos;t here: they live in Instagram Insights and Ads Manager. Purchases arrive from
            Gumroad without campaign data, so they show under &ldquo;(none recorded)&rdquo;.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-mute">
                  <th scope="col" className="py-1 pr-3 font-semibold">
                    Source
                  </th>
                  {FUNNEL_EVENTS.map((e) => (
                    <th key={e} scope="col" className="px-2 py-1 font-semibold">
                      {e.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.funnel).map(([source, row]) => (
                  <tr key={source} className="border-line border-t">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {source}
                    </th>
                    {FUNNEL_EVENTS.map((e) => (
                      <td key={e} className="font-num px-2 py-2">
                        {row[e] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.keys(m.funnel).length === 0 ? (
              <p className="text-mute mt-2 text-sm">No funnel events yet.</p>
            ) : null}
          </div>
          <p className="text-mute mt-4 text-sm">
            Email sign-ups with consent: {m.emailSignups.active} active,{" "}
            {m.emailSignups.unsubscribed} unsubscribed.
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-2xl">Content conversion status</h2>
          <p className="text-mute mt-1 text-sm">
            Which modules run on a Her Little Empire method, and which are still interim
            (content/REGISTER.md).
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(METHODOLOGY).map(([key, method]) => (
              <li
                key={key}
                className="border-line flex justify-between rounded-xl border px-4 py-2 text-sm"
              >
                <span>{MODULES[key as keyof typeof MODULES].title}</span>
                <span
                  className={
                    method.status === "source" || method.status === "studio"
                      ? "text-success"
                      : "text-warning"
                  }
                >
                  {method.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-mute mt-4 text-sm">
            Catalogue items with Gumroad ids filled in:{" "}
            {CATALOGUE.filter((c) => c.gumroadProductIds.length > 0).length} of {CATALOGUE.length}.
          </p>
        </Card>
      </div>
    </main>
  );
}
