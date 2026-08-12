import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import {
  cadenceLabel,
  interactionLimit,
  ORDERED_PLANS,
  PLANS,
  priceFor,
  widgetLimit,
} from "@/lib/plans";
import { billingEnabled, periodsFor } from "@/lib/billing/stripe";
import { UpgradeAction } from "@/components/dashboard/UpgradeAction";
import { ChangePassword, DeleteAccount } from "@/components/dashboard/AccountSecurity";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  const store = getStore();
  const plan = PLANS[user?.plan ?? "free"];
  const widgets = user ? await store.countWidgets(user.id) : 0;
  const interactions = user ? await store.countInteractionsThisMonth(user.id) : 0;
  const paused = interactions >= interactionLimit(plan.id);

  // Counted for the delete confirmation, so it can say what goes rather than
  // gesturing at "all your data".
  const owned = user ? await store.listWidgets(user.id) : [];
  const leads = (
    await Promise.all(owned.map((widget) => store.countLeads(widget.id)))
  ).reduce((total, count) => total + count, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-title">Settings</h1>

      <section className="card mt-8 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Account</h2>
        {isRegistered(user) ? (
          <p className="mt-3 text-sm text-slate">
            Signed in as <strong className="font-semibold text-navy">{user.email}</strong>.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate">
              You haven&rsquo;t created an account yet. Your widgets are saved against this browser —
              create an account to keep them and publish.
            </p>
            <Link href="/signup" className="btn mt-4">
              Create an account
            </Link>
          </>
        )}
      </section>

      <section className="card mt-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Plan</h2>
          <span className="rounded-full bg-purple-soft px-3 py-1 text-xs font-bold text-purple">
            {plan.name}
          </span>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Usage
            label="Widgets"
            used={widgets}
            limit={widgetLimit(plan.id)}
          />
          <Usage
            label="Interactions this month"
            used={interactions}
            limit={interactionLimit(plan.id)}
            hint="Visitors who answered something."
          />
        </dl>

        {/* The limit does something, so it has to say what — and it has to say
            it here, where the bar that fills up lives. */}
        {paused ? (
          <div className="mt-4 rounded-card border border-coral/40 bg-coral-soft p-4">
            <p className="text-sm leading-relaxed text-navy">
              <strong className="font-bold">Your widgets are paused.</strong> They&rsquo;ve had
              every interaction your plan allows this month, so visitors see a short notice
              instead. They start working again on {monthResets()} — nothing is lost in the
              meantime, and your analytics and leads are all still here.
            </p>
            {/* Waiting until the 1st shouldn't be the only way out. */}
            <UpgradeAction plan={plan.id} />
          </div>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Past {interactionLimit(plan.id).toLocaleString()} interactions your published widgets
            pause until the month turns over. Drafts and the builder are never affected.
          </p>
        )}

        {/* Not rendered while paused — the banner above is already offering
            the same move, and saying it twice on one card reads as a bug.
            Left out of the tree rather than hidden with a class, so it isn't
            there for a screen reader to read out either. */}
        {paused ? null : (
        <div className="mt-6 border-t border-rule pt-5">
          {billingEnabled() ? (
            <div className="flex flex-wrap gap-2">
              {ORDERED_PLANS.filter(
                (option) => option.id !== plan.id && option.priceYearly > 0
              ).flatMap((option) =>
                periodsFor(option.id).map((period) => (
                  <form
                    key={`${option.id}-${period}`}
                    action="/api/billing/checkout"
                    method="post"
                  >
                    <input type="hidden" name="plan" value={option.id} />
                    <input type="hidden" name="period" value={period} />
                    <button type="submit" className="btn-secondary">
                      {option.name} — ${priceFor(option, period)} {cadenceLabel(option, period)}
                    </button>
                  </form>
                ))
              )}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate">
              Card payments aren&rsquo;t switched on in this deployment yet. Everything in your plan
              works;{" "}
              <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-purple">
                email us
              </a>{" "}
              if you need a bigger one.
            </p>
          )}
        </div>
        )}
      </section>

      {isRegistered(user) ? (
        <section className="card mt-4 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Password</h2>
          <ChangePassword />
        </section>
      ) : null}

      <section className="card mt-4 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Your data</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          We store the widgets you build, the events your visitors generate (an anonymous per-tab id,
          nothing more) and any contact details visitors choose to give you. Deleting a widget
          deletes its analytics and leads with it.
        </p>

        {/* The paragraph above describes what we hold; this is how you get it
            back. Only for real accounts — there is nothing to close for an
            anonymous author, and the card above already offers them signup. */}
        {isRegistered(user) ? (
          <div className="mt-5 border-t border-rule pt-5">
            <p className="text-sm font-semibold text-navy">Close your account</p>
            <p className="mt-1 text-sm leading-relaxed text-slate">
              Deletes your account, your widgets and everything they collected.
            </p>
            <DeleteAccount widgets={owned.length} leads={leads} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** First of next month, matching the notice visitors are shown. */
function monthResets(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function Usage({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  hint?: string;
}) {
  const share = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-navy">
        {used.toLocaleString()} <span className="text-muted">of {limit.toLocaleString()}</span>
      </dd>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-lavender">
        <div
          className={`h-full rounded-full ${share > 85 ? "bg-coral" : "bg-purple"}`}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}
