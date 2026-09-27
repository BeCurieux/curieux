import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { Clause, LegalFooterLinks, LegalNotice, LegalUpdated, Operator } from "@/components/site/Legal";
import { brand, legalEntityKnown } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { ORDERED_PLANS, interactionLimit, widgetLimit } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Terms",
  description: "What you can expect from us, and what we expect from you.",
};

const UPDATED = "13 August 2026";

/**
 * The terms.
 *
 * Limits are rendered from lib/plans.ts rather than typed out, so the document
 * you agreed to and the gates the code enforces are the same numbers. A terms
 * page quoting a limit the product no longer has is the same drift problem as
 * a pricing page doing it, with worse consequences.
 */
export default async function TermsPage() {
  const user = await currentUser();
  const free = ORDERED_PLANS[0];

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-2xl px-5 py-14">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-2 text-title">Terms</h1>
        <p className="mt-3 leading-relaxed text-slate">
          What you can expect from us, and what we expect from you.
        </p>
        <LegalUpdated date={UPDATED} />
        <LegalNotice />

        <Clause title="What this is">
          <p>
            {/* `Operator` is never sentence-initial: with no entity configured
                it falls back to "the company operating MEKMI", which reads
                fine mid-sentence and as a lowercase typo at the start of one. */}
            {brand.name} is a tool for building small interactive things — calculators, estimators,
            quizzes — and putting them on your own website. It&rsquo;s provided by <Operator />, and
            using it means agreeing to what&rsquo;s on this page.
          </p>
        </Clause>

        <Clause title="Your account">
          <p>
            You can build without an account; we ask who you are when you publish. Keep your
            password to yourself, and tell us if you think somebody else has it. You need to be old
            enough to enter a contract where you live.
          </p>
          <p>
            One person or business per account. You&rsquo;re responsible for what happens under
            yours.
          </p>
        </Clause>

        <Clause title="What you build is yours">
          <p>
            Your questions, your prices, your copy, your logo, and every lead your widgets
            collect — all yours. We claim no ownership of any of it, and we don&rsquo;t use it to
            train anything.
          </p>
          <p>
            We need permission to host and display it, because that is literally the service: you
            give us a license to store your widgets and serve them to your visitors, for as long as
            you keep them here. That license ends when you delete them.
          </p>
          <p>
            The product itself — the software, the templates, the name, the design — stays ours.
          </p>
        </Clause>

        <Clause title="What you can't do with it">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Collect anything you don&rsquo;t have the right to collect, or use it in ways you haven&rsquo;t told your visitors about.</li>
            <li>Ask for card numbers, passwords, health records, or anything else that shouldn&rsquo;t be typed into a quote form. It isn&rsquo;t built for that.</li>
            <li>Impersonate somebody else, or publish something illegal, misleading or malicious.</li>
            <li>Hammer the service, work around its limits, or resell it as your own product.</li>
          </ul>
          <p>
            If a widget is doing one of these, we may take it down. If an account keeps doing it, we
            may close it. We&rsquo;ll tell you why.
          </p>
        </Clause>

        <Clause title="Plans and limits">
          <p>
            The free plan gives you {widgetLimit(free.id)} widgets and{" "}
            {interactionLimit(free.id).toLocaleString()} interactions a month, and it doesn&rsquo;t
            expire. An interaction is somebody answering at least one question; views are free,
            however many you get.
          </p>
          <p>
            Past your monthly allowance your published widgets pause and visitors see a short
            notice. Your builder, your drafts, your analytics and every lead you&rsquo;ve already
            collected carry on untouched. They come back on the 1st, or the moment you move up a
            plan. Current prices are on the{" "}
            <Link href="/pricing" className="font-semibold text-purple">
              pricing page
            </Link>
            .
          </p>
          <p>
            Paid plans renew until you cancel, and cancelling stops the next renewal rather than
            refunding the current period. We may change prices, but not for a period you&rsquo;ve
            already paid for, and we&rsquo;ll tell you before a renewal at a new price.
          </p>
        </Clause>

        <Clause title="What we promise, and what we don't">
          <p>
            We&rsquo;ll do our best to keep it running and your data safe. We can&rsquo;t promise it
            will never be down, never lose anything, or suit any particular purpose — nobody
            honestly can, and a paragraph in capital letters saying so doesn&rsquo;t change it.
          </p>
          <p>
            The numbers your widgets produce come from the formulas and prices{" "}
            <em>you</em> put in. We don&rsquo;t check them, and a quote a widget gives your customer
            is between you and them.
          </p>
          <p>
            Where the law allows us to limit what we owe you if something goes wrong, we limit it to
            what you&rsquo;ve paid us in the twelve months before it did. Nothing here limits
            anything that can&rsquo;t legally be limited.
          </p>
        </Clause>

        <Clause title="Ending it">
          <p>
            Close your account whenever you like, from Settings. It deletes your widgets, their
            analytics and every lead, immediately and permanently, and anything embedded on a
            page stops working.
          </p>
          <p>
            We can close an account that breaks these terms. If we ever shut the service down,
            we&rsquo;ll give you reasonable notice and a way to get your data out first.
          </p>
        </Clause>

        <Clause title="Changes, and the law">
          <p>
            We may update these terms. If a change matters, we&rsquo;ll say so rather than quietly
            moving the date at the top.
          </p>
          <p>
            {legalEntityKnown() ? (
              <>
                These terms are governed by the law of {brand.legal.jurisdiction}, and its courts
                deal with any dispute. {brand.legal.entity} is at {brand.legal.address}.
              </>
            ) : (
              <>
                The governing law and the operating company are not yet stated — see the note at the
                top of this page.
              </>
            )}
          </p>
        </Clause>

        <LegalFooterLinks current="terms" />
      </main>

      <SiteFooter />
    </>
  );
}
