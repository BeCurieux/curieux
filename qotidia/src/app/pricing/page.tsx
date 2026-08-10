// A book a year.
//
// Cut back, hard. The previous version argued about money four separate
// times: a per-day figure under the monthly price, a boxed panel headed
// "What this one is worse at" on each plan, a paragraph explaining that
// twelve months costs A$29 more than buying once, and then a set of
// questions about money underneath. Every sentence was true. Together they
// read as a company that is anxious about its own price, which is the one
// impression that makes a reader anxious too.
//
// What is left: two options, what each costs, what you get, one plain line
// naming the trade-off, and a button. Then what happens if you stop, because
// that is reassurance rather than argument.
//
// Cut and why:
//
//   The per-day figure. 62c a day is arithmetic nobody asked for, and the
//   only reason to print it is to make A$19 feel smaller.
//
//   The A$29 paragraph. The same fact already appears once, in the monthly
//   option's own trade-off line, computed from the real prices in plans.ts.
//   Saying it twice is not twice as honest.
//
//   The boxed caveat. The rule that each option names what it is worse at
//   is a good one and it stays — but as a sentence in the same type as
//   everything else, not in a highlighted panel with a heading, which draws
//   more attention to the downside than the thing being sold.
//
// Option A and Option B, rather than "Keep the year" and "Just the book" as
// headings. The names still appear — they are what the plan is called in
// billing and in the account — but a reader arriving here wants to know
// which of two things to pick, and two labels they have to decode first is
// friction dressed as voice.

import Link from "next/link";
import { CANCELLATION_PROMISE, planCopy } from "@/lib/billing/plans";
import {
  HEADLINE, STATUTORY as FIRST_STORY_STATUTORY, TERMS,
} from "@/lib/trust/first-story";
import { BRAND } from "@/lib/brand";
import { PRICING, PRICING_LOWER } from "@/lib/nav";
import { FREE_MEMORIES, WHAT_PAYING_ADDS } from "@/lib/billing/free";
import { countOf } from "@/lib/words";

export const metadata = { title: `${PRICING} — ${BRAND}` };

const LABELS = ["Option A", "Option B"];

export default function PricingPage() {
  const plans = planCopy();

  return (
    <div className="py-12 md:py-20">
      <div>
        <h1 className="text-display font-display lowercase">{PRICING_LOWER}</h1>
        <p className="mt-7 max-w-[40ch] text-lede text-stone">
          Start free. Two ways to pay when you want the year kept and the book
          it makes.
        </p>
      </div>

      {/* ------------------------------------------------------------- free
          First, and not as a locked version of the paid thing. Everything
          that makes this product worth having happens well inside the first
          hundred — the noticing, the questions, the first story — and a
          parent who never pays a cent should get it. lib/billing/free.ts
          argues why the wall is where it is. */}
      <section className="mt-14 rounded-2xl bg-card p-8 md:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl lowercase">start free</h2>
          <p className="text-sm text-stone">
            {countOf(FREE_MEMORIES, "memory", "memories")}, no card
          </p>
        </div>
        <p className="reading mt-4 max-w-[54ch] leading-relaxed">
          Drop in a few dozen photographs and the archive reads them: what
          keeps turning up, which day of the week it happens on, the thing
          that stopped in March. You get your first story out of it, and you
          can send it to somebody. None of that needs a card.
        </p>
        <p className="reading mt-4 max-w-[54ch] text-sm leading-relaxed text-stone">
          The wall is only ever on adding. Everything you keep stays readable
          and downloadable for as long as you want it, whether you ever pay or
          not &mdash; we never delete a family&rsquo;s archive.
        </p>
        <p className="mt-7">
          <Link href="/signup" className="btn !px-7 !py-3">Start with a few photos</Link>
        </p>
      </section>

      <h2 className="mt-16 font-display text-2xl lowercase">when you want the year</h2>
      <ul className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {WHAT_PAYING_ADDS.map((line) => (
          <li key={line} className="flex gap-3 leading-relaxed">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-clay" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {plans.map((plan, i) => {
          const isMonthly = plan.id === "monthly";
          return (
            <div
              key={plan.id}
              className={`flex h-full flex-col !p-8 md:!p-10 ${isMonthly ? "panel-raised" : "panel"}`}
            >
              <p className="text-sm uppercase tracking-[0.2em] text-clay">{LABELS[i]}</p>

              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display leading-none" style={{ fontSize: "clamp(3rem, 6vw, 4rem)" }}>
                  {plan.price}
                </span>
                <span className="text-stone">{plan.cadence}</span>
              </p>

              <p className="mt-2 text-stone">{plan.name}</p>

              <p className="mt-7 leading-relaxed">{plan.blurb}</p>

              <ul className="mt-7 space-y-2.5">
                {plan.includes.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-clay" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* The trade-off, in the same type as everything above it. A
                  caveat set small and grey is a caveat written to be
                  skipped, which is worse than not printing one. */}
              <p className="mt-7 leading-relaxed text-stone md:mt-auto md:pt-7">{plan.caveat}</p>

              <Link
                href={isMonthly ? "/signup?plan=monthly" : "/signup?plan=one_off"}
                className={`${isMonthly ? "btn" : "btn-secondary"} mt-9 w-full !py-3.5 text-center`}
              >
                {isMonthly ? "Start keeping the year" : "Just the book"}
              </Link>
            </div>
          );
        })}
      </div>

      {/* ---------------------------------------------- the first story promise
          Above "if you stop", because it answers the earlier question. The
          hardest thing about this sale is being asked to pay before seeing
          anything only your own family could have produced; "if you stop" is
          about month nine, and this is about the decision being made on this
          page right now. */}
      <section className="mt-16 border-t border-rule pt-12">
        <p className="text-xs uppercase tracking-[0.28em] text-clay">
          The First Story Promise
        </p>
        <h2 className="mt-4 max-w-[20ch] font-display text-3xl leading-tight md:text-4xl">
          {HEADLINE}
        </h2>

        <dl className="mt-10 grid gap-7 sm:grid-cols-2">
          {TERMS().map((t) => (
            <div key={t.what}>
              <dt className="text-sm">{t.what}</dt>
              <dd className="reading mt-1.5 max-w-[42ch] text-sm leading-relaxed text-stone">
                {t.detail}
              </dd>
            </div>
          ))}
        </dl>

        <p className="reading mt-9 max-w-[56ch] text-sm leading-relaxed text-stone">
          {FIRST_STORY_STATUTORY}
        </p>
      </section>

      {/* Reassurance, not argument. The strongest thing this company can say
          and the reason it is not folded into a list of questions. */}
      <section className="panel mt-16 md:!p-10">
        <h2 className="font-display text-2xl lowercase">if you stop</h2>
        <p className="mt-5 max-w-[56ch] leading-relaxed">{CANCELLATION_PROMISE}</p>
        <p className="mt-4 max-w-[56ch] leading-relaxed text-stone">
          And the months you&rsquo;ve already paid aren&rsquo;t lost &mdash;
          they come off the price of that year&rsquo;s book if you decide you
          want it after all.
        </p>
        <p className="mt-7">
          <Link href="/privacy" className="text-ochre underline underline-offset-4">
            How we keep your family private
          </Link>
        </p>
      </section>
    </div>
  );
}
