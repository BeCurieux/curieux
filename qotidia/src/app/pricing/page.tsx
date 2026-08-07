// A book a year.
//
// It was called "What it costs", which is an accountant's question asked on
// the customer's behalf. This page is where somebody decides whether their
// child gets a shelf, and the old title made that decision sound like an
// expense claim. The name now says what they get; the numbers are all still
// here, unhidden, because the other way to lose this sale is to look coy
// about the price.
//
// Written as a choice rather than a ladder. There is no "Pro", nothing is
// greyed out, and neither column is called "best value" — the two are
// genuinely different products and a parent who wants the object without a
// relationship is not a lesser customer.
//
// Each plan states what it is worse at, in the same size type as what it is
// good at. A comparison table where one column has no downside is an advert,
// and everyone can tell.
//
// The band near the foot divides the price — per day, per year of keeping —
// which is a device with a bad reputation, and deservedly. It is honest here
// only because of three rules it is held to. Every figure is arithmetic the
// reader can do (see lib/billing/money.ts, which is tested). Nothing is
// compared to a competitor or to a coffee. And the same band states the
// counterweight in the same size type: a year of monthly costs A$29 more
// than buying the book once. A page that only divides is an advert too.

import Link from "next/link";
import { CANCELLATION_PROMISE, PLAN_PRICES, planCopy } from "@/lib/billing/plans";
import {
  aDay,
  aud,
  audExact,
  aYearOfKeeping,
  moreThanBuyingOnce,
  small,
  YEARS_A_BOOK_IS_KEPT,
} from "@/lib/billing/money";
import { BRAND } from "@/lib/brand";
import { PRICING, PRICING_LOWER } from "@/lib/nav";

export const metadata = { title: `${PRICING} — ${BRAND}` };

export default function PricingPage() {
  const plans = planCopy();
  const monthly = PLAN_PRICES.monthlyAud();
  const oneOff = PLAN_PRICES.oneOffAud();

  // The second way of counting, computed rather than typed. Written into a
  // page once, these become three numbers nobody re-derives when a price
  // changes — and a marketing page quietly quoting last year's price is a
  // worse failure than a broken one, because it still looks fine.
  const daily = small(aDay(monthly));
  const perYearKept = audExact(aYearOfKeeping(oneOff));
  const extra = aud(moreThanBuyingOnce(monthly, oneOff));

  return (
    <div className="py-16">
      <h1 className="font-display lowercase" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", lineHeight: 0.95 }}>
        {PRICING_LOWER}
      </h1>
      <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-stone">
        One of these is a book. The other is the year that makes it.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="card flex flex-col !p-8">
            <h2 className="font-display text-2xl">{plan.name}</h2>
            <p className="mt-3">
              <span className="font-display text-4xl">{plan.price}</span>{" "}
              <span className="text-stone">{plan.cadence}</span>
            </p>
            {/* The same money, said the other way. Directly under the price
                rather than in a band of its own, because a figure that has
                to be scrolled to is a figure nobody weighs against the one
                they have already reacted to. */}
            <p className="mt-1.5 text-sm text-stone">
              {plan.id === "monthly"
                ? `${daily} a day`
                : `${perYearKept} a year, if it is still on a shelf when they are ${YEARS_A_BOOK_IS_KEPT}`}
            </p>
            <p className="mt-4 max-w-[38ch] leading-relaxed text-stone">{plan.blurb}</p>

            <ul className="mt-6 space-y-2 text-sm">
              {plan.includes.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span aria-hidden className="text-clay">&middot;</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {/* Same size as everything above it. A caveat in 10px grey is a
                caveat written to be skipped, which is worse than none. */}
            <p className="mt-6 max-w-[38ch] text-sm leading-relaxed text-stone">
              {plan.caveat}
            </p>

            <div className="mt-8 pt-2">
              <Link
                href={plan.id === "monthly" ? "/signup?plan=monthly" : "/signup?plan=one_off"}
                className={plan.id === "monthly" ? "btn" : "btn-secondary"}
              >
                {plan.id === "monthly" ? "Start keeping the year" : "Just the book"}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------- another way to count it
          On the ink ground, full bleed, so it reads as the page changing its
          mind about how to talk rather than as another card. */}
      <section className="bleed band-ink mt-20 py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="font-display lowercase" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}>
            another way to count it
          </h2>

          <div className="mt-10 grid gap-10 md:grid-cols-3">
            <div>
              <div className="font-display leading-none" style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)" }}>
                {daily}
              </div>
              <p className="mt-3 max-w-[26ch] leading-relaxed text-paper/70">
                A day, on the monthly plan. The archive stays open, everyone
                you invited can add to it, and the book is included.
              </p>
            </div>

            <div>
              <div className="font-display leading-none" style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)" }}>
                {perYearKept}
              </div>
              <p className="mt-3 max-w-[26ch] leading-relaxed text-paper/70">
                A year, if the book is still on a shelf when they are{" "}
                {YEARS_A_BOOK_IS_KEPT}. It is the one thing in the house that
                cannot be bought again.
              </p>
            </div>

            <div>
              <div className="font-display leading-none" style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)" }}>
                {aud(0)}
              </div>
              <p className="mt-3 max-w-[26ch] leading-relaxed text-paper/70">
                To keep everything you have already saved if you stop paying.
                We have never deleted a family&rsquo;s archive for money and
                we are not going to start.
              </p>
            </div>
          </div>

          {/* The counterweight, in the same type as the figures above it.
              Dividing a price is only honest next to the number the division
              is hiding. */}
          <p className="mt-12 max-w-[54ch] leading-relaxed text-paper/70">
            None of which makes {aud(oneOff)} a small amount of money on the
            day you spend it, and the plan with the smallest daily figure is
            the more expensive one: twelve months at {aud(monthly)} comes to{" "}
            {extra} more than buying the book once. We would rather you decided
            on the arithmetic than on a discount.
          </p>
        </div>
      </section>

      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="text-title">If you stop</h2>
        <p className="mt-3 max-w-[54ch] leading-relaxed text-stone">{CANCELLATION_PROMISE}</p>
        <p className="mt-4 max-w-[54ch] leading-relaxed text-stone">
          And the months you&rsquo;ve already paid aren&rsquo;t lost &mdash; they
          come off the price of that year&rsquo;s book if you decide you want it
          after all.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/privacy" className="text-ochre">
            How we keep your family private
          </Link>
        </p>
      </section>
    </div>
  );
}
