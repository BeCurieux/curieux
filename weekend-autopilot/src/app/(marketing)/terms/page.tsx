import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Terms" };

/**
 * Plain-language terms covering what the product actually promises. The
 * important clause is the third one: we recommend, we do not operate, and a
 * customer needs to understand that a plan is a suggestion built from live
 * data rather than a booking or a guarantee (§53).
 *
 * Placeholder pending legal review before launch.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <SectionLabel>Terms</SectionLabel>
      <h1 className="mt-3 text-[36px] leading-[1.1] text-ink sm:text-[44px]">
        The deal, in plain words.
      </h1>

      <div className="mt-10 space-y-8 text-[16px] leading-relaxed text-graphite">
        <section>
          <h2 className="text-[22px] leading-snug text-ink">What we provide</h2>
          <p className="mt-2">
            {brand.name} sends you a weekend plan each week for the period you have paid for.
            The four-week pilot is a single payment covering four delivered weekends. A
            subscription continues until you cancel it.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">What a plan is</h2>
          <p className="mt-2">
            A recommendation built from live data. We check that venues exist and are likely to
            be open before we send anything, and we say so when we could not confirm something.
            Costs are estimates and are labelled as such. Weather is a forecast.
          </p>
          <p className="mt-2">
            Things change after we send a plan: a café closes early, a road is shut, rain
            arrives sooner than forecast. Check anything that would ruin your day if it were
            wrong.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">We don’t run the activities</h2>
          <p className="mt-2">
            We are not the operator of anywhere we recommend and we take no payment on your
            behalf. Your arrangement with a venue is between you and them, including bookings,
            entry conditions and refunds.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Use your judgement</h2>
          <p className="mt-2">
            Plans stay in the gentle-to-moderate range and we do not recommend activities
            requiring specialist skill or equipment. Even so, you know your household, the
            conditions on the day and your own limits better than we do. Nothing we send is
            safety, medical or accessibility advice.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Payment and cancellation</h2>
          <p className="mt-2">
            Payments are handled by Stripe; we never see your card details. Subscriptions can
            be cancelled at any time and continue until the end of the period you have paid
            for. If we fail to deliver the weekends you paid for, write to us and we will put
            it right.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Your account</h2>
          <p className="mt-2">
            Keep access to your email address secure, since that is how you sign in. You can
            delete your account at any time from settings.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Questions</h2>
          <p className="mt-2">
            <a
              href={`mailto:${brand.supportEmail}`}
              className="font-semibold text-forest underline-offset-4 hover:underline"
            >
              {brand.supportEmail}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
