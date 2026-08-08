// A book a year.
//
// Rebuilt after "pricing is a bit weird". It was: a headline, two flat
// cards, and then a full-bleed ink band carrying three enormous numbers —
// 62c, A$6.63, A$0 — followed by a paragraph explaining why the cheapest
// number was also the most expensive plan. Every sentence in it was true and
// the whole thing was hard work. A page that makes a reader do arithmetic to
// find out whether they can afford something has failed at the one job it
// has.
//
// So the two ways to pay are now two proper panels, side by side, each
// answering the same four questions in the same order: what it costs, what
// you get, what it is worse at, and what happens if you stop. The per-day
// figure survives as one quiet line under the monthly price — it is genuinely
// useful there and unbearable at 60px.
//
// What has not changed, because it is the point:
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
// And the counterweight is still on the page: a year of monthly costs more
// than buying the book once, said plainly, near the prices rather than in a
// footnote. See lib/billing/money.ts, which computes both and is tested.

import Link from "next/link";
import { CANCELLATION_PROMISE, PLAN_PRICES, planCopy } from "@/lib/billing/plans";
import { aDay, aud, moreThanBuyingOnce, small } from "@/lib/billing/money";
import { moneyQuestions } from "@/lib/marketing/questions";
import { BRAND } from "@/lib/brand";
import { PRICING, PRICING_LOWER } from "@/lib/nav";

export const metadata = { title: `${PRICING} — ${BRAND}` };

export default function PricingPage() {
  const plans = planCopy();
  const monthly = PLAN_PRICES.monthlyAud();
  const oneOff = PLAN_PRICES.oneOffAud();
  const extra = aud(moreThanBuyingOnce(monthly, oneOff));

  return (
    <div className="py-12 md:py-16">
      {/* ------------------------------------------------------------ head */}
      <div className="max-w-[46ch]">
        <p className="pill">
          <span aria-hidden className="pill-dot" />
          One hardcover book, printed and posted
        </p>
        <h1
          className="mt-7 font-display lowercase"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)", lineHeight: 0.98 }}
        >
          {PRICING_LOWER}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-stone">
          Two ways to pay, and they are genuinely different things. One of
          them is a book. The other is the year that makes it.
        </p>
      </div>

      {/* ----------------------------------------------------------- plans */}
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isMonthly = plan.id === "monthly";
          return (
            <div
              key={plan.id}
              // Equal height, actions on the same line, whatever the copy
              // does. Two cards whose buttons sit at different heights read
              // as one being an afterthought.
              className={`flex h-full flex-col !p-8 md:!p-10 ${
                isMonthly ? "panel-raised" : "panel"
              }`}
            >
              <h2 className="font-display text-2xl lowercase">{plan.name}</h2>

              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display leading-none" style={{ fontSize: "clamp(2.75rem, 6vw, 3.75rem)" }}>
                  {plan.price}
                </span>
                <span className="text-stone">{plan.cadence}</span>
              </p>

              {/* The one place dividing the price earns its keep: small,
                  beside the number it divides, not set at 60px on a dark
                  band as though it were an argument. */}
              {isMonthly && (
                <p className="mt-2 text-sm text-stone">
                  About {small(aDay(monthly))} a day.
                </p>
              )}

              <p className="mt-6 leading-relaxed text-stone">{plan.blurb}</p>

              <ul className="mt-7 space-y-2.5">
                {plan.includes.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-clay" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* Same size as everything above it. A caveat in 10px grey is a
                  caveat written to be skipped, which is worse than none. */}
              <div className="mt-7 rounded-2xl bg-paper/70 p-5 md:mt-auto">
                <p className="text-sm font-semibold">What this one is worse at</p>
                <p className="mt-1.5 leading-relaxed text-stone">{plan.caveat}</p>
              </div>

              <Link
                href={isMonthly ? "/signup?plan=monthly" : "/signup?plan=one_off"}
                className={`${isMonthly ? "btn" : "btn-secondary"} mt-8 w-full !py-3.5 text-center`}
              >
                {isMonthly ? "Start keeping the year" : "Just the book"}
              </Link>
            </div>
          );
        })}
      </div>

      {/* The counterweight, on the same ground as the prices rather than
          three sections away. Whichever way a reader jumps, they have seen
          the number that makes the cheaper-sounding plan the dearer one. */}
      <p className="mt-8 max-w-[62ch] leading-relaxed text-stone">
        Twelve months of the monthly plan comes to {extra} more than buying the
        book once &mdash; it is a way to spread the cost and to have the
        archive open all year, not a discount. Extra copies for grandparents
        are ordered with the book and come to you, so you can write in them
        before you pass them on.
      </p>

      {/* ------------------------------------------------------- questions */}
      <section className="mt-20">
        <h2 className="font-display lowercase" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)" }}>
          before you decide
        </h2>
        <div className="mt-8 max-w-[70ch]">
          {moneyQuestions().map((item) => (
            <details key={item.q} className="qa">
              <summary>{item.q}</summary>
              <div>{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- if you stop
          Kept as its own block rather than folded into the questions. It is
          the single most reassuring thing this company can say, and burying
          the strongest promise inside an accordion nobody opens would be a
          strange way to treat it. */}
      <section className="panel mt-16 md:!p-10">
        <h2 className="font-display text-2xl lowercase">if you stop</h2>
        <p className="mt-4 max-w-[56ch] leading-relaxed text-stone">{CANCELLATION_PROMISE}</p>
        <p className="mt-4 max-w-[56ch] leading-relaxed text-stone">
          And the months you&rsquo;ve already paid aren&rsquo;t lost &mdash;
          they come off the price of that year&rsquo;s book if you decide you
          want it after all.
        </p>
        <p className="mt-6">
          <Link href="/privacy" className="text-ochre underline underline-offset-4">
            How we keep your family private
          </Link>
        </p>
      </section>
    </div>
  );
}
