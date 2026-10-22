import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { PageHeader } from "@/components/ui/card";
import { LAUNCH_PACK, REFUND_POLICY, SELLER } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Terms and refunds" };

// Plain-language terms. Reviewed by a lawyer before launch: see docs/QA-REPORT.md.
export default function Terms() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="prose-empire mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <PageHeader eyebrow="The small print, in big type" title="Terms and refunds" />
        <h2 className="mt-8 text-2xl">What you're buying</h2>
        <p>
          The {LAUNCH_PACK.name} is a one-time purchase for one business. It includes{" "}
          {LAUNCH_PACK.generationsPerPack} AI generations and up to {LAUNCH_PACK.productsPerPack}{" "}
          products. Everything you create stays available to view, edit, copy and export while your
          account exists. It doesn't include unlimited or ongoing AI generation.
        </p>
        <h2 className="mt-8 text-2xl">Refunds</h2>
        <p>
          {REFUND_POLICY} After a refund, your saved work stays in your account, but the pack's
          remaining generations and exports stop.
        </p>
        <h2 className="mt-8 text-2xl">Your content</h2>
        <p>
          What you write and what Empire Studio generates for you is yours to use in your business.
          You're responsible for checking it's accurate before you publish it — especially product
          facts, claims, prices, policies and images. Empire Studio doesn't guarantee sales or
          results.
        </p>
        <h2 className="mt-8 text-2xl">Shopify and other tools</h2>
        <p>
          Empire Studio isn't made by or affiliated with Shopify. Shopify Sidekick prompts are
          suggestions: what Sidekick does depends on your theme and plan. Work on a duplicate theme
          and review every change before publishing.
        </p>
        <h2 className="mt-8 text-2xl">Who you're buying from</h2>
        <p>
          {SELLER.name}, ABN {SELLER.abn}, {SELLER.country}. A registered business name; not
          registered for GST. Questions:{" "}
          <a href={`mailto:${SELLER.email}`} className="underline">
            {SELLER.email}
          </a>
          .
        </p>
        <h2 className="mt-8 text-2xl">Earlier Her Little Empire downloads</h2>
        <p>Anything you bought before stays yours on Gumroad under the terms you bought it with.</p>
      </main>
      <SiteFooter />
    </>
  );
}
