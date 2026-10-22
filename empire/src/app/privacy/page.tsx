import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="prose-empire mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <PageHeader eyebrow="Privacy" title="Your business details are yours" />
        <p>
          We store your email, your business profile, products, photos and everything you generate,
          so the studio can work and you can come back to it. Only you can see it.
        </p>
        <p>
          To write your copy, the details you enter are sent to our AI provider (Anthropic) for that
          request. They aren't used to advertise to you and aren't sold.
        </p>
        <p>
          We measure how the studio is used with our own first-party analytics — which features are
          used, not what you wrote. With your consent we set one random identifier to connect
          visits. There are no advertising trackers.
        </p>
        <p>
          Payments are handled by Gumroad; we receive your email, what you bought and whether it was
          refunded, never your card.
        </p>
        <p>
          You can download all your data, or delete your account and everything in it, from your
          account page. Purchase records are kept (without a link to your account) because tax law
          requires it.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
