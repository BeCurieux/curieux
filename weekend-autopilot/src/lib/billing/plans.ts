/**
 * Commercial offers (§6).
 *
 * Prices come from Stripe price IDs in the environment — never hard-coded
 * amounts — because the displayed price and the charged price must be the same
 * thing, and because we expect to test A$29 against other numbers.
 *
 * The launch posture is to sell the four-week pilot and nothing else. Annual
 * and monthly exist behind flags so the conversion sequence can offer them
 * without a deploy (§6).
 */

import { serverEnv } from "@/config/env";
import { flags } from "@/config/flags";
import type { PlanTier } from "@/lib/types";

export interface Offer {
  tier: PlanTier;
  /** Stripe Checkout mode. The pilot is a one-off; the rest are subscriptions. */
  mode: "payment" | "subscription";
  name: string;
  /** Shown only when Stripe has not been configured (e.g. local dev). */
  fallbackPriceLabel: string;
  description: string;
  features: string[];
  priceEnvKey: "STRIPE_PRICE_PILOT" | "STRIPE_PRICE_ANNUAL" | "STRIPE_PRICE_MONTHLY";
  /** Deliveries included. Null means "until cancelled". */
  deliveries: number | null;
}

export const OFFERS: Record<PlanTier, Offer> = {
  PILOT_4_WEEK: {
    tier: "PILOT_4_WEEK",
    mode: "payment",
    name: "Your next 4 weekends",
    fallbackPriceLabel: "A$29",
    description: "Four Thursdays. Four plans built around you. One payment.",
    features: [
      "Personalised setup, about three minutes",
      "Four weekly plans, main and backup",
      "Refined every week from what you actually do",
      "Your full recommendation history",
    ],
    priceEnvKey: "STRIPE_PRICE_PILOT",
    deliveries: 4,
  },
  ANNUAL: {
    tier: "ANNUAL",
    mode: "subscription",
    name: "A year of weekends",
    fallbackPriceLabel: "A$89",
    description: "Fifty-two weekends, planned.",
    features: [
      "A plan every Thursday",
      "Main and backup, every week",
      "Learns continuously from what you do",
      "Cancel any time",
    ],
    priceEnvKey: "STRIPE_PRICE_ANNUAL",
    deliveries: null,
  },
  MONTHLY: {
    tier: "MONTHLY",
    mode: "subscription",
    name: "Monthly",
    fallbackPriceLabel: "A$12.99",
    description: "Weekend plans, month to month.",
    features: ["A plan every Thursday", "Main and backup", "Cancel any time"],
    priceEnvKey: "STRIPE_PRICE_MONTHLY",
    deliveries: null,
  },
};

/** Offers to display, honouring the feature flags (§6). */
export function visibleOffers(): Offer[] {
  const f = flags();
  const visible: Offer[] = [];
  if (f.offerPilot) visible.push(OFFERS.PILOT_4_WEEK);
  if (f.offerAnnual) visible.push(OFFERS.ANNUAL);
  if (f.offerMonthly) visible.push(OFFERS.MONTHLY);
  return visible;
}

/** Offers for the post-pilot conversion page, whatever the landing page shows. */
export function conversionOffers(): Offer[] {
  const f = flags();
  const offers = [OFFERS.ANNUAL];
  if (f.offerMonthly) offers.push(OFFERS.MONTHLY);
  return offers;
}

export function stripePriceId(offer: Offer): string | null {
  return serverEnv()[offer.priceEnvKey] ?? null;
}

export function offerForTier(tier: string): Offer | null {
  return OFFERS[tier as PlanTier] ?? null;
}

/** Number of weekends a pilot includes. Used by the expiry job (§29). */
export const PILOT_DELIVERIES = 4;
