import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { OfferLink } from "@/components/ads/offer-link";
import { ViewBeacon } from "@/components/beacon";
import { Card, PageHeader } from "@/components/ui/card";
import { PROMISE } from "@/content/brand";
import { FIT_CHECK_URL, INCOME_FIT_TEST_URL } from "@/content/catalogue";
import { CONSUMER_RIGHTS, REFUND_POLICY, SELLER } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "The Income Fit Test",
  description:
    "Twenty questions, 23 researched side-income ideas, the rules for five countries and a dated 14-day plan to test one cheaply. US$19.",
};

const INSIDE = [
  [
    "Your Income Fit Report",
    "The 20-question quiz, your top three of 23 researched ideas, a calculator for each idea, the rules for five countries, a dated 14-day plan and how to decide at the end.",
  ],
  ["The workbook", "Work through it on paper or in a spreadsheet."],
  ["23 Opportunity Cards", "One researched card per idea, each with the date it was checked."],
  ["The 14-Day Test Plan", "One objective, one task and one output a day, 30 to 60 minutes (EST)."],
  ["The Go / No-Go Scorecard", "For Day 14."],
  ["The AI Shortcut System", "Prompts that speed up the research and the writing."],
  [
    "Rules Guides",
    "Australia, the US, the UK, Canada and New Zealand: registration, records, tax, GST/VAT thresholds, insurance and licences, each item dated.",
  ],
];

const SHOTS = [
  {
    src: "/images/income-fit-test/quiz.png",
    alt: "The FIT Finder's first question, 'Where do you live?', with six country choices and a progress bar showing 1 of 20.",
    caption: "Twenty plain questions. The first sets your currency and your country's rules.",
  },
  {
    src: "/images/income-fit-test/top-three.png",
    alt: "A report headed 'Sam, here's what fits.' with the answers summarised as tags and a table of the top three ideas, each with fit score, start-up cost, hours a week, time to first income and biggest catch.",
    caption:
      "Your top three, side by side, with each idea's biggest catch. (A test account, named Sam.)",
  },
  {
    src: "/images/income-fit-test/calculator.png",
    alt: "The calculator with a price of 60 and 1.5 hours per job typed in, showing scenarios at 25, 50 and 100 percent busy and a warning that the hourly floor is only reached if nearly all hours are paid.",
    caption:
      "The calculator, with numbers we typed in for this screenshot. It's a scenario from your inputs, not a forecast, and it warns you when the maths doesn't work.",
  },
  {
    src: "/images/income-fit-test/day-14.png",
    alt: "Day 14 decision lines: 'Not enough evidence yet' for fewer than 5 real conversations, and 'Go: next test' with its conditions.",
    caption: "Day 14: decide on evidence. Fewer than five real conversations isn't a no.",
  },
];

const FAQ = [
  [
    "Will this make me money?",
    "It can't promise that, and neither can anyone else. It helps you choose an idea that fits and test it cheaply, so you find out quickly and spend little.",
  ],
  [
    "I'm not in Australia. Does it work for me?",
    "The Rules Guides cover Australia, the US, the UK, Canada and New Zealand. Somewhere else? The quiz works in US$, and the rules are yours to check.",
  ],
  [
    "What if I already have an idea?",
    "Score it against your week, then test it with the 14-day plan.",
  ],
  [
    "How long does it take?",
    "The quiz takes about 15 minutes (EST). The test is 14 days of 30 to 60 minutes (EST).",
  ],
  [
    "What's the interactive version?",
    "Sign in to Empire Studio with the email you bought with and the same report works on screen, saving your answers and your 14-day plan.",
  ],
  ["Can I get a refund?", `${REFUND_POLICY} ${CONSUMER_RIGHTS}`],
];

// The Income Fit Test's offer page. Screenshots are of the real interactive
// version (a test account), and every limit is stated next to the promise.
export default function IncomeFitTestPage() {
  return (
    <>
      <ViewBeacon name="offer_viewed" props={{ path: "income-fit-test" }} />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <PageHeader
          eyebrow="The Income Fit Test · US$19"
          title="Which side income fits your real week?"
        >
          <p>{PROMISE}</p>
        </PageHeader>

        <p className="text-charcoal max-w-3xl text-lg">
          Most side-income ideas don&apos;t fail because they&apos;re bad. They fail because they
          don&apos;t fit the week you actually have. The Income Fit Test asks 20 questions about
          your time, budget, skills and limits, matches them against 23 ideas we researched (each
          one dated), and gives you a 14-day plan to test one cheaply before you spend big.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <OfferLink href={INCOME_FIT_TEST_URL} offer="income-fit-test" source="offer-page">
            Get it on Gumroad, US$19
          </OfferLink>
          <p className="text-mute text-sm">{REFUND_POLICY}</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="text-2xl">Who it&apos;s for</h2>
            <ul className="text-charcoal mt-3 list-disc space-y-2 pl-5">
              <li>
                You want your own money around a real life: school hours, a day job, limited
                evenings.
              </li>
              <li>You&apos;d rather know the costs and the rules before you start.</li>
              <li>You&apos;re happy to test an idea for 14 days instead of guessing.</li>
            </ul>
          </Card>
          <Card>
            <h2 className="text-2xl">Who it isn&apos;t for</h2>
            <ul className="text-charcoal mt-3 list-disc space-y-2 pl-5">
              <li>Anyone looking for a promise of income. Nobody honest can make one.</li>
              <li>
                Anyone after a scheme where you earn by signing other people up. Pay-to-join schemes
                are on our red-flag list.
              </li>
            </ul>
          </Card>
        </div>

        <section aria-labelledby="screens" className="mt-14">
          <h2 id="screens" className="text-3xl">
            What it looks like
          </h2>
          <p className="text-mute mt-2">
            Real screens from the interactive version in Empire Studio. The PDF kit has the same
            report.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {SHOTS.map((s) => (
              <figure
                key={s.src}
                className="border-line bg-paper overflow-hidden rounded-3xl border"
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  width={1200}
                  height={900}
                  className="h-auto w-full"
                />
                <figcaption className="text-mute p-4 text-sm">{s.caption}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-6">
            <OfferLink
              href="/images/income-fit-test/sample-report.jpg"
              offer="sample-report"
              source="offer-page"
              variant="secondary"
            >
              See a whole sample report
            </OfferLink>
            <p className="text-mute mt-2 text-sm">
              One long image of a complete report, for a test account named Sam. The calculator is
              empty because it only works from your own numbers.
            </p>
          </div>
        </section>

        <section aria-labelledby="inside" className="mt-14">
          <h2 id="inside" className="text-3xl">
            What&apos;s inside
          </h2>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">
            {INSIDE.map(([t, d]) => (
              <div key={t} className="border-line border-t pt-3">
                <dt className="font-semibold">{t}</dt>
                <dd className="text-mute mt-1 text-sm">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="method" className="mt-14">
          <h2 id="method" className="text-3xl">
            How it decides
          </h2>
          <ol className="text-charcoal mt-4 list-decimal space-y-3 pl-5">
            <li>
              <strong>Rule out what can&apos;t work for you.</strong> Some answers rule an idea out
              (for example no car, no evenings, or a check you can&apos;t get). Those are listed at
              the end, with the reason.
            </li>
            <li>
              <strong>Score the rest</strong> against your time, budget, skills and preferences.
              Ties go to what you said matters most.
            </li>
            <li>
              <strong>Show the catch.</strong> Each idea comes with its biggest risk, its start-up
              cost and the date its research was checked.
            </li>
            <li>
              <strong>Test, then decide on evidence:</strong> go, adjust, stop, or not enough
              evidence yet.
            </li>
          </ol>
        </section>

        <section aria-labelledby="limits" className="mt-14">
          <Card className="bg-blush-soft">
            <h2 id="limits" className="text-2xl">
              What it won&apos;t do
            </h2>
            <p className="text-charcoal mt-3">
              It won&apos;t tell you whether your customers will pay; only a real test can, which is
              what the 14-day plan is for. It won&apos;t give you an income figure to expect, and
              the calculator&apos;s scenarios come from numbers you put in. Every figure is labelled
              FACT (checked, with a date), EST (an estimate) or UNKNOWN.
            </p>
          </Card>
        </section>

        <section aria-labelledby="faq" className="mt-14">
          <h2 id="faq" className="text-3xl">
            Questions
          </h2>
          <dl className="mt-5 space-y-5">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold">{q}</dt>
                <dd className="text-mute mt-1">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-num text-aubergine text-3xl">US$19</p>
            <p className="text-mute text-sm">
              {REFUND_POLICY} Sold by {SELLER.name}, ABN {SELLER.abn}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <OfferLink href={INCOME_FIT_TEST_URL} offer="income-fit-test" source="offer-page">
              Get it on Gumroad
            </OfferLink>
            <OfferLink
              href={FIT_CHECK_URL}
              offer="fit-check"
              source="offer-page"
              variant="secondary"
            >
              Start with the free Fit Check
            </OfferLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
