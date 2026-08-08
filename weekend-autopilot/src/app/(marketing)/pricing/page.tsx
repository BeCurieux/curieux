import type { Metadata } from "next";
import { visibleOffers, stripePriceId } from "@/lib/billing/plans";
import { stripe, stripeConfigured } from "@/lib/billing/stripe";
import { PricingCard } from "@/components/marketing/pricing-card";
import { SectionLabel } from "@/components/ui";
import { defaultMarket, formatMoney } from "@/config/markets";

export const metadata: Metadata = { title: "Pricing" };

/**
 * Prices are read from Stripe at render time rather than written into the page
 * (§6): the number a customer sees and the number they are charged come from
 * the same place, and changing the price is a Stripe change, not a deploy.
 */
async function priceLabels(): Promise<Record<string, string>> {
  if (!stripeConfigured()) return {};

  const labels: Record<string, string> = {};
  const market = defaultMarket();

  await Promise.all(
    visibleOffers().map(async (offer) => {
      const priceId = stripePriceId(offer);
      if (!priceId) return;
      try {
        const price = await stripe().prices.retrieve(priceId);
        if (price.unit_amount === null) return;
        labels[offer.tier] = formatMoney(market, price.unit_amount / 100);
      } catch {
        // Fall back to the offer’s own label rather than failing the page.
      }
    })
  );

  return labels;
}

export default async function PricingPage() {
  const offers = visibleOffers();
  const labels = await priceLabels();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <SectionLabel>Pricing</SectionLabel>
      <h1 className="mt-3 max-w-2xl text-[38px] leading-[1.08] text-ink sm:text-[52px]">
        Try four weekends. Decide after.
      </h1>
      <p className="mt-5 max-w-prose text-[18px] leading-relaxed text-graphite">
        One payment, four Thursdays, no subscription running quietly in the background. By the
        fourth weekend you’ll know whether this is worth keeping.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:max-w-3xl">
        {offers.map((offer) => (
          <PricingCard
            key={offer.tier}
            offer={offer}
            priceLabel={labels[offer.tier]}
            highlighted={offer.tier === "PILOT_4_WEEK"}
          />
        ))}
      </div>

      <div className="mt-14 max-w-prose space-y-4 text-[16px] leading-relaxed text-graphite">
        <p>
          <strong className="font-semibold text-ink">What you’re paying for.</strong> The
          planning, not the activities. Most weekends we send cost very little to actually do —
          a good free walk and a decent lunch beats an expensive experience most of the time.
        </p>
        <p>
          <strong className="font-semibold text-ink">We don’t take a cut of where you go.</strong>{" "}
          Recommendations are ranked before any commercial arrangement is considered, and no
          venue can pay to be recommended.
        </p>
        <p>
          <strong className="font-semibold text-ink">If a weekend isn’t good enough, we don’t send it.</strong>{" "}
          When we can’t build something we’d genuinely recommend, we tell you rather
          than filling the slot.
        </p>
      </div>
    </div>
  );
}
