import "server-only";

// Billing (brief §35, §44).
//
// §44 says don't start with billing, and this file takes that seriously: the
// *gates* are everywhere (src/lib/plans.ts), but the payment rail is optional.
// With no Stripe keys the product runs completely — every plan boundary is
// enforced, the pricing page says plainly that cards aren't switched on, and
// no button pretends to take money (§41).
//
// Add STRIPE_SECRET_KEY and the two price ids and checkout starts working
// without a line of this changing.

import Stripe from "stripe";
import { PLANS, type BillingPeriod, type PlanId } from "@/lib/plans";

export function billingEnabled(): boolean {
  // At least one purchasable period on the entry paid plan. A deployment may
  // configure yearly only, or monthly only; `periodsFor` is what decides
  // which buttons a page is allowed to draw.
  return Boolean(process.env.STRIPE_SECRET_KEY && periodsFor("pro").length > 0);
}

export function priceIdFor(plan: PlanId, period: BillingPeriod = "yearly"): string | undefined {
  const key = period === "monthly" ? PLANS[plan].stripePriceEnvMonthly : PLANS[plan].stripePriceEnv;
  return key ? process.env[key] : undefined;
}

/** The periods this deployment can actually take money for, for this plan. */
export function periodsFor(plan: PlanId): BillingPeriod[] {
  return (["yearly", "monthly"] as const).filter((period) => Boolean(priceIdFor(plan, period)));
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  // No apiVersion pin: the installed SDK's default is the version its types
  // were generated against, so upgrading the package can't silently skew them.
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export interface CheckoutRequest {
  userId: string;
  email: string | null;
  plan: PlanId;
  period: BillingPeriod;
  successUrl: string;
  cancelUrl: string;
}

/** Returns a hosted checkout URL, or null when billing is switched off. */
export async function createCheckout(request: CheckoutRequest): Promise<string | null> {
  const price = priceIdFor(request.plan, request.period);
  if (!billingEnabled() || !price) return null;

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: request.email ?? undefined,
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    // The webhook needs to know whose plan to change, and Stripe is the only
    // thing that survives the round trip.
    client_reference_id: request.userId,
    metadata: { userId: request.userId, plan: request.plan, period: request.period },
  });

  return session.url;
}

/**
 * Map a Stripe price id back to one of our plans.
 *
 * Both periods, because the subscription webhook reports whichever price the
 * customer is actually on — miss the monthly ids here and every monthly
 * subscriber is silently downgraded to free on their first renewal.
 */
export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    for (const key of [plan.stripePriceEnv, plan.stripePriceEnvMonthly]) {
      if (key && process.env[key] === priceId) return plan.id;
    }
  }
  return null;
}
