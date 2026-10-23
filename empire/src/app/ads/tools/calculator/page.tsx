import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { AdsCalculator } from "@/components/ads/calculator";
import { OfferLink } from "@/components/ads/offer-link";
import { ViewBeacon } from "@/components/beacon";
import { Card, PageHeader } from "@/components/ui/card";
import { FIT_CHECK_URL, INCOME_FIT_TEST_URL } from "@/content/catalogue";
import { MIN_SALES_TO_JUDGE } from "@/lib/ads/calculator-view";
import { REFUND_POLICY } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Ads Profitability Calculator",
  description:
    "Free: work out the most you can spend on ads per sale and still make money, after fees, GST, refunds and costs. Your numbers stay in your browser.",
  openGraph: {
    title: "Ads Profitability Calculator · Her Little Empire",
    description:
      "The most you can spend on ads per sale and still make money, with every formula shown.",
  },
};

const LIMITS = [
  [
    "It works from your numbers.",
    "Put in your real price, fees and refund rate. Rough is fine to start; the answer is only as good as what goes in.",
  ],
  [
    "It shows where break-even is, not what an ad will do.",
    "Nobody can predict an ad's results, and this doesn't try. It tells you the line an ad has to clear.",
  ],
  [
    "A few sales can't judge an ad.",
    `Under ${MIN_SALES_TO_JUDGE} sales, chance swings the result. The calculator says so instead of giving a verdict.`,
  ],
  [
    "It leaves out your time.",
    "Contribution is before you pay yourself. If a sale only just breaks even on ads, you worked for free.",
  ],
  [
    "It's not tax or financial advice.",
    "GST and VAT are shown so they aren't counted as yours. Whether and when you register is a question for the tax office or your accountant.",
  ],
];

export default function CalculatorPage() {
  return (
    <>
      <ViewBeacon name="calculator_viewed" />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <PageHeader eyebrow="Free tool · Her Little Empire" title="Ads Profitability Calculator">
          <p>
            Before you spend a dollar on ads: the most you can pay for one sale and still make
            money, after fees, GST, refunds and costs. Then check a real ad period against it.
          </p>
          <p className="mt-2 text-base">
            Everything is worked out on this page. Nothing you type is sent to us or saved.
          </p>
        </PageHeader>

        <AdsCalculator />

        <section aria-labelledby="limits" className="mt-14">
          <h2 id="limits" className="text-3xl">
            What this does, and doesn&apos;t, tell you
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIMITS.map(([title, text]) => (
              <Card key={title}>
                <h3 className="text-lg">{title}</h3>
                <p className="text-mute mt-2 text-sm">{text}</p>
              </Card>
            ))}
          </div>
          <p className="text-mute mt-4 text-sm">
            The example filled in is hypothetical: a A$49 digital bundle sold with Gumroad&apos;s
            fee, 3% refunds, and A$120 of ads that brought 2 sales. It loses money, on purpose.
          </p>
        </section>

        <section aria-labelledby="next" className="no-print mt-14">
          <h2 id="next" className="text-3xl">
            Not sure the product is the right one yet?
          </h2>
          <p className="text-mute mt-3 max-w-2xl">
            Ads can only sell something people already want. If you&apos;re still choosing what to
            sell, start there.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <p className="eyebrow">Free</p>
              <h3 className="mt-2 text-xl">The 5-Question Fit Check</h3>
              <p className="text-mute mt-2 text-sm">
                A ten-minute printable: score up to three ideas against the week you actually have,
                with six red flags to watch for. Delivered by Gumroad, which asks for your email.
              </p>
              <div className="mt-4">
                <OfferLink href={FIT_CHECK_URL} offer="fit-check" variant="secondary">
                  Get the Fit Check
                </OfferLink>
              </div>
            </Card>
            <Card>
              <p className="eyebrow">Free with an account</p>
              <h3 className="mt-2 text-xl">The FIT Finder</h3>
              <p className="text-mute mt-2 text-sm">
                Twenty questions, scored against 23 researched ideas. You see your top three and why
                each fits. Sign in with your email; no card.
              </p>
              <div className="mt-4">
                <OfferLink href="/studio/fit" offer="fit-finder" variant="secondary">
                  Take the FIT Finder
                </OfferLink>
              </div>
            </Card>
            <Card>
              <p className="eyebrow">US$19</p>
              <h3 className="mt-2 text-xl">The Income Fit Test</h3>
              <p className="text-mute mt-2 text-sm">
                The full report: your top three with a calculator, rules for five countries, a dated
                14-day plan to test one idea cheaply, and how to decide at the end. {REFUND_POLICY}
              </p>
              <div className="mt-4">
                <OfferLink href={INCOME_FIT_TEST_URL} offer="income-fit-test">
                  See the Income Fit Test
                </OfferLink>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
