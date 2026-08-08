import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

/**
 * The privacy page states the product’s actual data posture (§51, §52). It is
 * written plainly on purpose: the commitments here are ones the architecture
 * enforces — coordinates are coarsened at write time, "did it" is self-
 * reported, deletion runs a real deletion — so there is nothing to hedge.
 *
 * This is not a substitute for a lawyer-reviewed policy before launch.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <SectionLabel>Privacy</SectionLabel>
      <h1 className="mt-3 text-[36px] leading-[1.1] text-ink sm:text-[44px]">
        What we know about you, and what we don’t.
      </h1>

      <div className="prose-none mt-10 space-y-8 text-[16px] leading-relaxed text-graphite">
        <section>
          <h2 className="text-[22px] leading-snug text-ink">Location</h2>
          <p className="mt-2">
            We store your approximate home area — roughly a hundred metres, not an address —
            because we cannot work out a travel time without it. We do not track your location,
            we do not ask for continuous location permission, and we do not keep a history of
            where you have been.
          </p>
          <p className="mt-2">
            If you tell us you started somewhere else on a particular weekend, we use that for
            that plan and nothing more.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Your household</h2>
          <p className="mt-2">
            We ask who your weekends are usually for, and for children we ask an age. A
            nickname is optional; nothing else about a child is collected, and none of it is
            required. Age is there because a plan that works for a seven-year-old does not work
            for a two-year-old.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">&ldquo;Did you do it?&rdquo;</h2>
          <p className="mt-2">
            The most useful thing you can tell us is whether you actually did the weekend we
            planned. You tell us by tapping yes or no. We never need proof, and we never check.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">What we do with it</h2>
          <p className="mt-2">
            Everything we collect is used to plan your weekends. We combine your preferences
            with live data — weather, opening hours, travel times — to build each plan. We do
            not sell your data, and we do not let anyone pay to be recommended to you.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Third parties</h2>
          <p className="mt-2">
            We use a payment processor (Stripe), an email provider, a mapping and places
            provider, a weather provider and an AI model provider. They receive only what they
            need to do their part: the model provider, for example, receives your preferences
            and the candidate places, never your name or email address.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Taking it with you, or deleting it</h2>
          <p className="mt-2">
            You can export your account data or delete your account from settings at any time.
            Deletion removes your household, preferences, plans and history. We retain payment
            records where the law requires, with your identifying details removed from them.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] leading-snug text-ink">Getting in touch</h2>
          <p className="mt-2">
            Questions about any of this go to{" "}
            <a
              href={`mailto:${brand.supportEmail}`}
              className="font-semibold text-forest underline-offset-4 hover:underline"
            >
              {brand.supportEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
