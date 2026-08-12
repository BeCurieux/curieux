import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { CheckIcon } from "@/components/ui/Icons";
import { brand } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import {
  cadenceLabel,
  isBillingPeriod,
  ORDERED_PLANS,
  priceLabel,
  yearlySaving,
  type BillingPeriod,
} from "@/lib/plans";
import { billingEnabled } from "@/lib/billing/stripe";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free to build and publish. Pay when it's earning you something.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { billing?: string };
}) {
  const user = await currentUser();
  const paid = billingEnabled();

  // The period lives in the URL rather than in client state: it survives a
  // reload, it can be linked to ("here, look at the monthly prices"), and the
  // toggle keeps working with JavaScript off, like the checkout form below it.
  const period: BillingPeriod = isBillingPeriod(searchParams.billing)
    ? searchParams.billing
    : "yearly";

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-5xl px-5 py-14">
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-2 text-title">Free until it&rsquo;s working.</h1>
          <p className="mt-3 leading-relaxed text-slate">
            Build, publish and embed on the free plan — really. Upgrade when you want the enquiries
            in your inbox and our name off the bottom.
          </p>
        </div>

        <PeriodToggle period={period} />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {ORDERED_PLANS.map((plan) => {
            const featured = plan.id === "pro";
            return (
              <div
                key={plan.id}
                className={`card relative flex flex-col p-7 ${
                  featured ? "border-purple shadow-lift lg:-mt-3 lg:mb-3" : ""
                }`}
              >
                {featured ? (
                  // Ringed in the page colour so it reads as sitting on top of
                  // the card's border rather than being sliced by it.
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-purple px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white ring-4 ring-canvas">
                    Most people
                  </span>
                ) : null}

                <h2 className="text-lg font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate">{plan.blurb}</p>

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight">
                    {priceLabel(plan, period)}
                  </span>
                  <span className="text-sm text-muted">{cadenceLabel(plan, period)}</span>
                </p>

                {/* The saving is the gap between the two real prices, so it
                    can't outlive them — and it only appears on the option it
                    is a saving against. */}
                <p className="mt-1 min-h-[1.25rem] text-xs font-semibold text-purple">
                  {plan.priceYearly > 0 && yearlySaving(plan) > 0
                    ? period === "yearly"
                      ? `Saves $${yearlySaving(plan)} against monthly`
                      : `$${plan.priceYearly} a year saves $${yearlySaving(plan)}`
                    : ""}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate">
                      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-purple-soft text-purple">
                        <CheckIcon size={12} strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Every card ends with a real action. Building is free on
                    any plan, so that is always the honest first step — and
                    when Stripe isn't configured the upgrade route becomes a
                    quiet line underneath rather than a dashed box that looks
                    like an error (§41). */}
                <div className="mt-7">
                  {plan.id === "free" || !paid ? (
                    <Link
                      href="/dashboard/widgets/new"
                      className={featured ? "btn w-full" : "btn-secondary w-full"}
                    >
                      Start building
                    </Link>
                  ) : (
                    <Link
                      href={`/dashboard/settings?upgrade=${plan.id}&billing=${period}`}
                      className={featured ? "btn w-full" : "btn-secondary w-full"}
                    >
                      Choose {plan.name}
                    </Link>
                  )}

                  {/* Every card carries a line here, in a slot tall enough for
                      two, so the buttons sit level across all three however
                      the notes wrap. */}
                  <p className="mt-2.5 min-h-[2.25rem] text-center text-xs leading-relaxed text-muted">
                    {plan.priceYearly === 0 ? (
                      "No card needed. Nothing expires."
                    ) : paid ? (
                      period === "monthly" ? "Cancel any time." : "Cancel any time. Renews yearly."
                    ) : (
                      <>
                        Card payments aren&rsquo;t on yet —{" "}
                        <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-purple">
                          email us
                        </a>{" "}
                        to upgrade.
                      </>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-title text-center">Questions people actually ask</h2>
          <dl className="mt-8 space-y-5">
            {[
              {
                q: "What counts as an interaction?",
                a: "Someone answering at least one question. Views are free and unlimited — we only count people who actually engaged.",
              },
              {
                // This answer has to track widgets/service.ts:isOverInteractionLimit.
                // It described the behaviour before the limit was enforced, and
                // promised an email nothing in the product sends.
                q: "What happens if I go over?",
                a: "Your published widgets pause for the rest of the month and visitors see a short notice — your builder, drafts, analytics and enquiries all carry on as normal. They come back on the 1st, or the moment you move up a plan.",
              },
              {
                q: "Can I switch between monthly and yearly?",
                a: "Yes, whenever you like — email us and we'll move you across at your next renewal. Your widgets, analytics and enquiries are untouched either way.",
              },
              {
                q: "Can I use it on more than one site?",
                a: "Yes. A widget is a link and a snippet — put it wherever you like.",
              },
              {
                q: "Do I own what I build?",
                a: "Yes. Your questions, your prices, your copy, your leads.",
              },
            ].map((item) => (
              <div key={item.q} className="card p-5">
                <dt className="font-bold">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-slate">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * Yearly / monthly, as two links rather than a control.
 *
 * Links because the choice belongs in the URL — it survives a reload, it can
 * be sent to someone, and it needs no JavaScript, which matches the checkout
 * form it eventually leads to.
 */
function PeriodToggle({ period }: { period: BillingPeriod }) {
  const options: Array<{ id: BillingPeriod; label: string }> = [
    { id: "yearly", label: "Pay yearly" },
    { id: "monthly", label: "Pay monthly" },
  ];

  return (
    <div className="mt-8 flex justify-center">
      <div
        className="inline-flex gap-1 rounded-full border border-rule bg-white p-1"
        role="group"
        aria-label="Billing period"
      >
        {options.map((option) => {
          const active = option.id === period;
          return (
            <Link
              key={option.id}
              href={option.id === "yearly" ? "/pricing" : `/pricing?billing=${option.id}`}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active ? "bg-navy text-white" : "text-slate hover:text-navy"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
