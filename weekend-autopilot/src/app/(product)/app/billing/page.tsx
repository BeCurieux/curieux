import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { conversionOffers, PILOT_DELIVERIES } from "@/lib/billing/plans";
import { Card, SectionLabel } from "@/components/ui";
import { PricingCard } from "@/components/marketing/pricing-card";
import { PortalButton } from "@/components/app/portal-button";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  NONE: "No plan yet",
  TRIAL: "Trial",
  PILOT_ACTIVE: "Four-week pilot",
  ACTIVE: "Active",
  PAST_DUE: "Payment failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Finished",
};

/** Billing (§29). Also the conversion surface once the pilot has run out. */
export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app/billing");

  const db = userClient();
  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household) redirect("/onboarding");

  const subscription = await repo.getSubscription(db, household.id);
  const pilotWeek = subscription?.pilot_week_number ?? 0;
  const pilotFinished =
    subscription?.tier === "PILOT_4_WEEK" && pilotWeek >= PILOT_DELIVERIES;

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Billing</SectionLabel>
        <h1 className="mt-2 text-[28px] leading-tight text-ink">
          {STATUS_COPY[subscription?.status ?? "NONE"]}
        </h1>
      </div>

      {subscription?.tier === "PILOT_4_WEEK" ? (
        <Card className="p-6">
          <SectionLabel>Your pilot</SectionLabel>
          <p className="mt-2 text-[17px] text-ink">
            {pilotWeek} of {PILOT_DELIVERIES} weekends delivered
          </p>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: PILOT_DELIVERIES }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full ${index < pilotWeek ? "bg-forest" : "bg-rule"}`}
              />
            ))}
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-graphite">
            {pilotFinished
              ? "That’s your four. Nothing renews automatically — if you want to keep going, choose an option below."
              : "One payment, four weekends. Nothing renews automatically when they’re done."}
          </p>
        </Card>
      ) : null}

      {subscription?.status === "PAST_DUE" ? (
        <Card className="border-clayWash bg-clayWash/40 p-6">
          <p className="text-[15px] font-semibold text-clay">A payment didn’t go through</p>
          <p className="mt-2 text-[15px] leading-relaxed text-graphite">
            We’ve paused deliveries until it’s sorted. Updating your card starts them
            again straight away.
          </p>
          <div className="mt-4">
            <PortalButton />
          </div>
        </Card>
      ) : null}

      {pilotFinished || subscription?.status === "EXPIRED" || !subscription ? (
        <div>
          <SectionLabel>Keep going</SectionLabel>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            {conversionOffers().map((offer) => (
              <PricingCard key={offer.tier} offer={offer} highlighted={offer.tier === "ANNUAL"} />
            ))}
          </div>
          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-mist">
            Your preferences and everything we’ve learned stay exactly as they are — the
            next four weekends start from what we already know about you, not from scratch.
          </p>
        </div>
      ) : null}

      {subscription?.stripe_customer_id ? (
        <Card className="p-6">
          <SectionLabel>Payment details</SectionLabel>
          <p className="mt-2 text-[15px] leading-relaxed text-graphite">
            Cards, invoices and cancellation are handled by Stripe. We never see your card
            details.
          </p>
          <div className="mt-4">
            <PortalButton />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
