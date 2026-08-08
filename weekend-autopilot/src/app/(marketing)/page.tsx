import Link from "next/link";
import { brand, PRODUCT_PROMISE_SECONDARY } from "@/config/brand";
import { defaultMarket } from "@/config/markets";
import { ButtonLink, Card, SectionLabel } from "@/components/ui";
import { PlanSummary } from "@/components/plan/badges";
import { FitReason } from "@/components/plan/plan-card";
import { Timeline } from "@/components/plan/timeline";
import { EXAMPLE_PLAN } from "@/lib/example-plan";
import { displayTime } from "@/lib/util/time";
import { visibleOffers } from "@/lib/billing/plans";
import { PricingCard } from "@/components/marketing/pricing-card";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

/**
 * Landing page (§7).
 *
 * The argument it has to make, in order: you have 52 weekends and you waste
 * them deciding; here is what we would send you; here is why that is a
 * different thing from a recommendations app; here is what it costs.
 *
 * The example weekend appears above the fold-and-a-half deliberately — the
 * product is easier to show than to describe, and "here’s what you’re doing
 * Saturday" only lands once you have seen one.
 */
export default function LandingPage() {
  const market = defaultMarket();
  const plan = EXAMPLE_PLAN;
  const offers = visibleOffers();
  const finish = plan.items[plan.items.length - 1];

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <h1 className="text-[40px] leading-[1.05] text-ink sm:text-[62px]">
            You get 52 weekends a&nbsp;year.
            <br />
            <span className="text-forest">We’ll make them count.</span>
          </h1>
          <p className="mt-6 max-w-prose text-[18px] leading-relaxed text-graphite sm:text-[20px]">
            Every Thursday, one genuinely good weekend is waiting for you — planned around
            your energy, budget, weather and the people you’re with.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/pricing" size="lg">
              Plan my next 4 weekends
            </ButtonLink>
            <ButtonLink href="#example" size="lg" variant="secondary">
              See an example
            </ButtonLink>
          </div>
          <p className="mt-5 text-[14px] text-mist">
            {PRODUCT_PROMISE_SECONDARY} Sydney only, for now.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------- example weekend */}
      <section id="example" className="mx-auto max-w-5xl px-5 py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:top-24">
            <SectionLabel>What lands in your inbox</SectionLabel>
            <h2 className="mt-3 text-[30px] leading-tight text-ink sm:text-[38px]">
              Not 47 things you could do. One thing you’re doing.
            </h2>
            <p className="mt-4 max-w-prose text-[17px] leading-relaxed text-graphite">
              A real plan with times, costs and travel worked out — checked against opening
              hours and the forecast before it’s sent. If we can’t build one
              we’d genuinely recommend, we don’t send one.
            </p>
            <p className="mt-4 text-[15px] text-mist">
              The plan below is an illustration, not a live recommendation.
            </p>
          </div>

          <Card className="p-6 sm:p-8">
            <SectionLabel>Your Saturday is sorted</SectionLabel>
            <h3 className="mt-2.5 text-[27px] leading-tight text-ink">{plan.title}</h3>
            <p className="mt-2 text-[16px] leading-relaxed text-graphite">
              {plan.short_description}
            </p>

            <div className="mt-6">
              <Timeline items={plan.items} market={market} />
            </div>

            {finish ? (
              <p className="mt-4 text-[15px] text-mist">
                Home around {displayTime(finish.end_time)}
              </p>
            ) : null}

            <div className="mt-5">
              <PlanSummary
                market={market}
                weatherSummary={plan.weather_summary}
                costMin={Number(plan.estimated_total_cost_min)}
                costMax={Number(plan.estimated_total_cost_max)}
                activityLevel={plan.activity_level}
                distanceKm={plan.total_activity_distance_km}
                travelMinutes={plan.total_travel_minutes}
              />
            </div>

            <FitReason reason={plan.fit_reason} className="mt-6" />
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-3 max-w-2xl text-[30px] leading-tight text-ink sm:text-[38px]">
          Three minutes once. Then it runs itself.
        </h2>

        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Tell us about your weekends",
              body: "Where you are, who you’re with, how far you’ll go, what you actually like. Chips and taps, not a form. About three minutes.",
            },
            {
              step: "02",
              title: "We plan Wednesday night",
              body: "We combine your profile with the forecast, opening hours and travel times, then check every venue before anything is sent.",
            },
            {
              step: "03",
              title: "Thursday morning it’s done",
              body: "One plan, one backup, in your inbox. Sunday we ask whether you did it — and next weekend gets better.",
            },
          ].map((s) => (
            <li key={s.step}>
              <span className="tabular text-[13px] font-semibold tracking-[0.16em] text-clay">
                {s.step}
              </span>
              <h3 className="mt-2 text-[20px] leading-snug text-ink">{s.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-graphite">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- comparison */}
      <section className="border-y border-rule bg-white/60">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <SectionLabel>Why this isn’t another recommendations app</SectionLabel>
          <h2 className="mt-3 max-w-2xl text-[30px] leading-tight text-ink sm:text-[38px]">
            Search gives you options. Options are the problem.
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-card border border-rule bg-paper p-6">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mist">
                Search and listings apps
              </p>
              <p className="mt-3 font-display text-[24px] leading-snug text-graphite">
                &ldquo;Here are 47 things you could do.&rdquo;
              </p>
              <ul className="mt-5 space-y-2 text-[15px] leading-relaxed text-mist">
                <li>You still have to choose.</li>
                <li>You still have to check what’s open.</li>
                <li>You still have to work out the timing.</li>
                <li>By Friday night you default to the usual.</li>
              </ul>
            </div>

            <div className="rounded-card border border-forest/25 bg-sage p-6">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-forest">
                {brand.name}
              </p>
              <p className="mt-3 font-display text-[24px] leading-snug text-ink">
                &ldquo;Here’s what you’re doing Saturday.&rdquo;
              </p>
              <ul className="mt-5 space-y-2 text-[15px] leading-relaxed text-graphite">
                <li>One plan, already decided.</li>
                <li>Opening hours and travel times checked.</li>
                <li>Costed, timed, and honest about both.</li>
                <li>A backup for when you’re tired.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- household intelligence */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Household intelligence</SectionLabel>
            <h2 className="mt-3 text-[30px] leading-tight text-ink sm:text-[36px]">
              A four-year-old changes everything. So we ask.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-graphite">
              A plan that works for you and not for the people you’re with is not a plan.
              We build around the whole household: ages, how far anyone will realistically
              walk, who hates driving, whether there needs to be a playground within sight of
              lunch.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-graphite">
              The best weekend isn’t the average of what everyone wants. It’s the one
              most likely to actually work.
            </p>
          </div>

          <div>
            <SectionLabel>It learns what you actually do</SectionLabel>
            <h2 className="mt-3 text-[30px] leading-tight text-ink sm:text-[36px]">
              Doing it counts. Liking the idea doesn’t.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-graphite">
              Every Sunday we ask one question: did you do it? That single answer teaches us
              more than any preference form. Tick &ldquo;culture&rdquo; at signup and then
              skip four galleries, and we stop sending galleries — whatever you originally
              said.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-graphite">
              After a couple of months it knows you prefer water, that seven kilometres is
              your limit, and that you leave at half nine.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-5 py-16">
        <SectionLabel>Pricing</SectionLabel>
        <h2 className="mt-3 max-w-xl text-[30px] leading-tight text-ink sm:text-[38px]">
          Try four weekends. Decide after.
        </h2>
        <p className="mt-4 max-w-prose text-[17px] leading-relaxed text-graphite">
          One payment, four Thursdays. No subscription to forget about, and by the fourth
          weekend you’ll know whether this is for you.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:max-w-3xl">
          {offers.map((offer) => (
            <PricingCard key={offer.tier} offer={offer} highlighted={offer.tier === "PILOT_4_WEEK"} />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- privacy */}
      <section className="border-y border-rule bg-white/60">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <SectionLabel>Privacy</SectionLabel>
          <h2 className="mt-3 max-w-2xl text-[30px] leading-tight text-ink sm:text-[36px]">
            We need to know your suburb. Not your movements.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: "Approximate location only",
                body: "We store your rough home area so we can work out travel time. There’s no continuous tracking and no location history.",
              },
              {
                title: "“Did it” means you told us",
                body: "We never need GPS proof that you went somewhere. One tap on Sunday is the whole mechanism.",
              },
              {
                title: "Yours to take or delete",
                body: "Export your data or delete your account whenever you like. Deletion removes your personal data properly.",
              },
            ].map((c) => (
              <div key={c.title}>
                <h3 className="text-[18px] leading-snug text-ink">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-graphite">{c.body}</p>
              </div>
            ))}
          </div>
          <Link
            href="/privacy"
            className="mt-8 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
          >
            Read the full privacy note →
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------------- FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <SectionLabel>Questions</SectionLabel>
        <div className="mt-8 divide-y divide-rule border-y border-rule">
          {FAQ_ITEMS.slice(0, 5).map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-[17px] leading-snug text-ink">{faq.q}</span>
                <span className="shrink-0 text-mist transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-graphite">{faq.a}</p>
            </details>
          ))}
        </div>
        <Link
          href="/faq"
          className="mt-6 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
        >
          All questions →
        </Link>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-8">
        <div className="rounded-card border border-rule bg-white p-8 text-center sm:p-14">
          <h2 className="mx-auto max-w-xl text-[32px] leading-tight text-ink sm:text-[42px]">
            {brand.tagline}
          </h2>
          <p className="mx-auto mt-4 max-w-prose text-[17px] leading-relaxed text-graphite">
            Start with four. See what your Saturdays look like when someone else has done the
            deciding.
          </p>
          <div className="mt-8">
            <ButtonLink href="/pricing" size="lg">
              Plan my next 4 weekends
            </ButtonLink>
          </div>
        </div>

        <div className="mt-10">
          <WaitlistForm />
        </div>
      </section>
    </>
  );
}

export const FAQ_ITEMS = [
  {
    q: "What exactly do I get?",
    a: "Every Thursday morning, one weekend plan built for your household, plus a lighter backup for when you’re tired. Each plan has times, an estimated cost, travel from your area, and the reasoning behind it. Full detail lives in the web app; the email is the summary.",
  },
  {
    q: "How is this different from a recommendations app?",
    a: "A recommendations app gives you options and leaves the work with you. We make the decision: one plan, sequenced, timed and checked. You get to say yes or say you’re tired.",
  },
  {
    q: "What if the weather turns?",
    a: "The forecast is an input to the plan, not an afterthought. On a wet weekend the plan is weather-proof by construction, and the backup is deliberately more sheltered than the main plan.",
  },
  {
    q: "Do you make things up?",
    a: "No. Venues, opening hours, travel times, prices and weather all come from live data sources, and every venue is re-checked before a plan is sent. Where we can’t confirm something — a small café that doesn’t publish hours — we say so rather than guessing.",
  },
  {
    q: "Does it work with young children?",
    a: "That’s most of why the household setup exists. Ages change what’s possible far more than preferences do: a three-year-old’s realistic walking distance, whether there’s a playground near lunch, whether a venue is somewhere children are actually welcome.",
  },
  {
    q: "What happens after four weekends?",
    a: "Nothing automatic. The pilot is a one-off payment, not a trial that converts on its own. We’ll ask whether you want to keep going, and if you don’t, that’s the end of it.",
  },
  {
    q: "I’m not in Sydney.",
    a: "Then not yet. Leave your city on the waitlist and we’ll tell you when we open it — we would rather be genuinely good in one city than mediocre in twenty.",
  },
  {
    q: "How much of my data do you need?",
    a: "Your approximate home area, who your weekends are usually for, and what you like. Not your movements, not precise GPS, not a location history. We ask 'did you do it?' rather than checking.",
  },
];
