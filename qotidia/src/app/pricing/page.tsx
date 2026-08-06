// Two ways to pay.
//
// Written as a choice rather than as a ladder. There is no "Pro", nothing is
// greyed out, and neither column is called "best value" — the two are
// genuinely different products and a parent who wants the object without a
// relationship is not a lesser customer.
//
// Each plan states what it is worse at, in the same size type as what it is
// good at. A comparison table where one column has no downside is an advert,
// and everyone can tell.

import Link from "next/link";
import { CANCELLATION_PROMISE, planCopy } from "@/lib/billing/plans";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `What it costs — ${BRAND}` };

export default function PricingPage() {
  const plans = planCopy();

  return (
    <div className="py-16">
      <h1 className="text-display">What it costs</h1>
      <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-stone">
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
