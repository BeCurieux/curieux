import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { OfferLink } from "@/components/ads/offer-link";
import { ViewBeacon } from "@/components/beacon";
import { Card, PageHeader } from "@/components/ui/card";
import { PROMISE, PROMISE_SUPPORT } from "@/content/brand";
import { FIT_CHECK_URL, INCOME_FIT_TEST_URL } from "@/content/catalogue";
import { REFUND_POLICY } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "The FIT Finder: free",
  description:
    "Twenty questions about your time, budget, skills and limits, scored against 23 researched side-income ideas. Free: your top three and why each fits.",
};

const FREE = [
  "Twenty questions about your week, your budget, your skills and your limits",
  "Scored against 23 side-income ideas, each researched and dated",
  "Your top three, with one line on why each fits",
  "Saved to your account, so you can come back to it",
];

const FULL = [
  "A calculator for each idea, using the least you'd accept for an hour of your time",
  "The rules where you live, for five countries",
  "A dated 14-day plan to test one idea cheaply",
  "Day 14 decision lines: go, adjust, stop, or not enough evidence yet",
];

// The FIT Finder's public front door. The quiz itself is in the studio (an
// account keeps your answers); signing in from here comes straight back to it.
export default function FitLanding() {
  return (
    <>
      <ViewBeacon name="fit_landing_viewed" />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <PageHeader eyebrow="Free · The FIT Finder" title={PROMISE}>
          <p>{PROMISE_SUPPORT}</p>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3">
          <OfferLink href="/studio/fit" offer="fit-finder" source="fit-landing">
            Start the FIT Finder
          </OfferLink>
          <p className="text-mute text-sm">
            Free. Sign in with your email to save your answers; no card, no password.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="eyebrow">Free</p>
            <h2 className="mt-2 text-2xl">What you get</h2>
            <ul className="text-charcoal mt-4 list-disc space-y-2 pl-5">
              {FREE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
          <Card className="bg-blush-soft">
            <p className="eyebrow">With the Income Fit Test · US$19</p>
            <h2 className="mt-2 text-2xl">The full report adds</h2>
            <ul className="text-charcoal mt-4 list-disc space-y-2 pl-5">
              {FULL.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-mute mt-4 text-sm">
              Already bought it on Gumroad? Sign in with the same email and the full report unlocks.{" "}
              {REFUND_POLICY}
            </p>
            <div className="mt-4">
              <OfferLink
                href={INCOME_FIT_TEST_URL}
                offer="income-fit-test"
                source="fit-landing"
                variant="secondary"
              >
                See the Income Fit Test
              </OfferLink>
            </div>
          </Card>
        </div>

        <section aria-labelledby="honest" className="mt-12">
          <h2 id="honest" className="text-3xl">
            What it won&apos;t do
          </h2>
          <p className="text-mute mt-3 max-w-2xl">
            It won&apos;t promise you an income. It matches your circumstances to ideas and helps
            you test one cheaply; whether your customers will pay is the one thing only a real test
            can show. Every figure is labelled FACT, EST (estimate) or UNKNOWN.
          </p>
        </section>

        <section aria-labelledby="quick" className="mt-12">
          <h2 id="quick" className="text-3xl">
            Only got ten minutes?
          </h2>
          <p className="text-mute mt-3 max-w-2xl">
            The free 5-Question Fit Check is a printable: score up to three ideas against the week
            you actually have. Gumroad delivers it and asks for your email.
          </p>
          <div className="mt-4">
            <OfferLink
              href={FIT_CHECK_URL}
              offer="fit-check"
              source="fit-landing"
              variant="secondary"
            >
              Get the Fit Check
            </OfferLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
