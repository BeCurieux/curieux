import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { ViewBeacon } from "@/components/beacon";
import { FREE, LAUNCH_PACK } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Pricing" };

export default function Pricing() {
  return (
    <>
      <ViewBeacon name="pricing_viewed" />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <PageHeader eyebrow="Pricing" title="Simple, one-time, and honest about the limits.">
          No subscription. Pay once for the launch pack; keep everything you make.
        </PageHeader>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-3xl">Free studio</h2>
            <p className="text-ink mt-2 font-serif text-4xl">US$0</p>
            <ul className="text-ink mt-6 space-y-3">
              <li>One business profile</li>
              <li>A Brand Blueprint preview: positioning, customer, personality and palette</li>
              <li>A real Sidekick prompt for your store's global design</li>
              <li>A look at every workflow, and the launch checklist</li>
              <li>{FREE.generations} generations to try it properly</li>
            </ul>
            <div className="mt-8">
              <ButtonLink href="/sign-in?start=1" variant="secondary">
                Start free
              </ButtonLink>
            </div>
          </Card>
          <Card className="border-oxblood">
            <h2 className="text-3xl">{LAUNCH_PACK.name}</h2>
            <p className="text-ink mt-2 font-serif text-4xl">
              {LAUNCH_PACK.priceLabel} <span className="text-ink-soft text-base">one time</span>
            </p>
            <ul className="text-ink mt-6 space-y-3">
              <li>The full Brand Blueprint</li>
              <li>Store design brief, all ten Sidekick prompts and homepage copy</li>
              <li>
                Product listings and photo briefs for up to {LAUNCH_PACK.productsPerPack} products
              </li>
              <li>Launch announcement, three launch emails and a social launch kit</li>
              <li>The launch checklist with saved progress</li>
              <li>Download everything as one launch pack</li>
            </ul>
            <div className="bg-blush-soft text-ink mt-6 rounded-2xl p-4 text-sm">
              <p className="font-semibold">Exactly what “one time” means</p>
              <p className="mt-1">
                Everything you generate is yours to keep, edit, copy and export for as long as you
                have an account. The pack includes {LAUNCH_PACK.generationsPerPack} AI generations
                (including regenerations) for one business. It isn't unlimited AI — that would cost
                more than it's worth to either of us. Editing, copying and exporting never use
                generations.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/account">Get the Launch Pack</ButtonLink>
            </div>
            <p className="text-ink-soft mt-3 text-sm">
              Paid securely through Gumroad. {LAUNCH_PACK.refundDays}-day no-questions refund —
              after a refund, your saved work stays but new generations stop.
            </p>
          </Card>
        </div>
        <Card className="mt-6">
          <h2 className="text-2xl">Already bought a Her Little Empire download?</h2>
          <p className="text-ink-soft mt-2">
            Your downloads stay exactly where they are on Gumroad. Sign in here with the same email
            and they'll show up in your library. They don't include the Launch Pack software, and
            the Launch Pack doesn't replace them.
          </p>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
