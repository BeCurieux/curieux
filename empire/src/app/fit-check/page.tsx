import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { OfferLink } from "@/components/ads/offer-link";
import { ViewBeacon } from "@/components/beacon";
import { Card, PageHeader } from "@/components/ui/card";
import { FIT_CHECK_URL, INCOME_FIT_TEST_URL } from "@/content/catalogue";
import { serverEnv } from "@/env";
import { REFUND_POLICY } from "@/lib/billing/plans";
import { OptInForm } from "./opt-in-form";

export const metadata: Metadata = {
  title: "The 5-Question Fit Check: free",
  description:
    "A free ten-minute printable: score up to three side-income ideas against the week you actually have, and check six red flags.",
};

const QUESTIONS = [
  "How many hours a week you really have",
  "Your longest reliable block of time",
  "Whether evenings and weekends are free",
  "How much money you can spend to start",
  "How much you want to talk to customers",
];

// Public page for the free Fit Check. Gumroad delivers the PDF; the optional
// opt-in below is separate and only shows once a sender is set up.
export default function FitCheckPage() {
  const env = serverEnv();
  const optInOpen = env.EMPIRE_EMAIL_OPTIN === "on";
  const direct = env.FIT_CHECK_DOWNLOAD_URL;
  return (
    <>
      <ViewBeacon name="fit_check_viewed" />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <PageHeader
          eyebrow="Free · The 5-Question Fit Check"
          title="Ten minutes. Five questions. The week you actually have."
        >
          <p>
            Most side-income ideas don&apos;t fail because they&apos;re bad. They fail because they
            don&apos;t fit the week you actually have. This checks that, before you spend anything.
          </p>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <h2 className="text-2xl">How it works</h2>
            <p className="text-mute mt-2">Score up to three ideas, 0, 1 or 2 on each question:</p>
            <ol className="text-charcoal mt-3 list-decimal space-y-1 pl-5">
              {QUESTIONS.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            <p className="text-charcoal mt-4">
              Out of 10: <strong>8 to 10</strong> is worth testing first, <strong>5 to 7</strong> is
              possible, <strong>0 to 4</strong> means park it for now. Then check six red flags,
              including licences, big upfront spending, cold messaging as the only way to find
              customers, and anything that promises income or asks you to pay to join.
            </p>
            <div className="mt-6">
              {direct ? (
                <>
                  <OfferLink href={direct} offer="fit-check-pdf" source="fit-check-page">
                    Download the free Fit Check (PDF)
                  </OfferLink>
                  <p className="text-mute mt-2 text-sm">
                    No sign-up: no account, no email, no password. Just the printable.
                  </p>
                </>
              ) : (
                <>
                  <OfferLink href={FIT_CHECK_URL} offer="fit-check" source="fit-check-page">
                    Get the free Fit Check
                  </OfferLink>
                  <p className="text-mute mt-2 text-sm">
                    No sign-up: no account and no password. It&apos;s a printable PDF from our
                    Gumroad shop, which asks where to send the file.
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card className="bg-blush-soft">
            <h2 className="text-2xl">Want a follow-up by email? (Optional)</h2>
            <p className="text-mute mt-2 text-sm">
              Entirely optional, and not needed for the Fit Check. Five short emails: how to test an
              idea honestly, what the numbers really look like, and when &ldquo;not enough evidence
              yet&rdquo; is the right answer. No income promises.
            </p>
            <div className="mt-4">
              {optInOpen ? (
                <OptInForm />
              ) : (
                <p className="text-charcoal text-sm">
                  Email sign-up opens soon. For now, the Fit Check itself is free on Gumroad.
                </p>
              )}
            </div>
          </Card>
        </div>

        <section aria-labelledby="next" className="mt-12">
          <h2 id="next" className="text-3xl">
            When you want the full answer
          </h2>
          <p className="text-mute mt-3 max-w-2xl">
            The Income Fit Test matches 20 questions against 23 researched ideas, then gives you a
            dated 14-day plan to test one cheaply. US$19. {REFUND_POLICY}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <OfferLink
              href="/income-fit-test"
              offer="offer-page"
              source="fit-check-page"
              variant="secondary"
            >
              See what&apos;s in it
            </OfferLink>
            <OfferLink
              href={INCOME_FIT_TEST_URL}
              offer="income-fit-test"
              source="fit-check-page"
              variant="quiet"
            >
              Go to Gumroad
            </OfferLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
