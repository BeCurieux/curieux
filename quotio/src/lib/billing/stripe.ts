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
import { PLANS, type PlanId } from "@/lib/plans";

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && priceIdFor("pro"));
}

export function priceIdFor(plan: PlanId): string | undefined {
  const key = PLANS[plan].stripePriceEnv;
  return key ? process.env[key] : undefined;
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
  successUrl: string;
  cancelUrl: string;
}

/** Returns a hosted checkout URL, or null when billing is switched off. */
export async function createCheckout(request: CheckoutRequest): Promise<string | null> {
  const price = priceIdFor(request.plan);
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
    metadata: { userId: request.userId, plan: request.plan },
  });

  return session.url;
}

/** Map a Stripe price id back to one of our plans. */
export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId) return plan.id;
  }
  return null;
}
