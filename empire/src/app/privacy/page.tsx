import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { PageHeader } from "@/components/ui/card";
import { SELLER } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Privacy" };

// Plain-language privacy notice. Founder review and a professional privacy
// review are still needed before taking payments: docs/launch/PLATFORM_INTEGRATION_PLAN.md §5.
// Every statement here describes what the code actually does; change the
// code and this page together.
export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="prose-empire mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <PageHeader eyebrow="Privacy" title="Your business details are yours" />

        <h2 className="mt-8 text-2xl">Who we are</h2>
        <p>
          {SELLER.name} (ABN {SELLER.abn}, {SELLER.country}). Questions about your data, or a
          request to see, correct or delete it:{" "}
          <a href={`mailto:${SELLER.email}`} className="underline">
            {SELLER.email}
          </a>
          .
        </p>

        <h2 className="mt-8 text-2xl">What we keep, and why</h2>
        <p>
          <strong>Your account:</strong> your email address, so you can sign in by emailed link.
        </p>
        <p>
          <strong>What you put into the studio:</strong> your business profile, products, photos,
          FIT Finder answers and results, your progress, and everything you generate, so the tools
          work and you can come back to them. Only you can see it.
        </p>
        <p>
          <strong>Purchases:</strong> payments are handled by Gumroad. We receive your email, what
          you bought, the sale reference and whether it was refunded, never your card, so we can
          unlock what you paid for.
        </p>
        <p>
          <strong>Usage:</strong> our own analytics record which features are used, not what you
          wrote. With your consent we set a random identifier to connect visits and remember which
          campaign link brought you. Without it, visits are counted but not connected. There are no
          advertising trackers: no Meta (Facebook or Instagram) pixel, no Google Analytics, and
          nothing that builds advertising audiences from your visit.
        </p>
        <p>
          <strong>The free calculators:</strong> the numbers you type into the Ads Profitability
          Calculator are worked out in your browser. They aren&apos;t sent to us or saved.
        </p>

        <h2 className="mt-8 text-2xl">Who handles it for us</h2>
        <p>
          <strong>Supabase</strong> stores the database, sign-in and uploaded files, in the United
          States. <strong>Vercel</strong> hosts the site; its servers may be outside Australia.{" "}
          <strong>Anthropic</strong> receives the details you enter when you ask the studio to write
          something, for that request only; it isn&apos;t used to advertise to you and isn&apos;t
          sold. <strong>Gumroad</strong> handles checkout and downloads under its own privacy
          policy. Sign-in emails are sent through an email delivery service.
        </p>
        <p>
          This means your information is stored and processed outside Australia, mainly in the
          United States.
        </p>

        <h2 className="mt-8 text-2xl">Emails</h2>
        <p>
          Sign-in emails are sent only when you ask for one. We send news or offers only if you
          chose to receive them, and every one of those has a way to stop them.
        </p>
        <p>
          If you ask for our emails on the Fit Check page, we keep your email address, the exact
          wording you agreed to, when you agreed, and the name of the link or campaign that brought
          you (for example &ldquo;instagram&rdquo;), so we can show you agreed and stop when you
          ask. Unsubscribing takes one click; we then keep the record, marked unsubscribed, so we
          never email you again by mistake. To have it removed entirely, write to us.
        </p>

        <h2 className="mt-8 text-2xl">How long we keep it, and deleting it</h2>
        <p>
          You can download all your data, or delete your account, from your account page. Deleting
          your account deletes your profile, products, photos, results and generated work. Purchase
          records are kept without a link to your account, because tax law requires it. Usage events
          are kept without a link to your account.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
