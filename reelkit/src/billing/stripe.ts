/**
 * The only file that talks to Stripe.
 */

import Stripe from "stripe";
import type { Pack } from "./packs.js";

export type Checkout = (args: { pack: Pack; user: { id: string; email?: string }; origin: string }) => Promise<string>;
export type VerifyWebhook = (body: string, signature: string) => Stripe.Event;

export function stripeClient(key: string): Stripe {
  return new Stripe(key, { appInfo: { name: "Reelkit" } });
}

export function stripeCheckout(stripe: Stripe): Checkout {
  return async ({ pack, user, origin }) => {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pack.currency,
            unit_amount: pack.cents,
            product_data: {
              name: `Reelkit ${pack.name} — ${pack.credits} ad credits`,
              description: "Each credit makes one set of three AI-written video ads.",
            },
          },
        },
      ],
      client_reference_id: user.id,
      ...(user.email ? { customer_email: user.email } : {}),
      metadata: { user_id: user.id, pack: pack.id },
      payment_intent_data: { metadata: { user_id: user.id, pack: pack.id } },
      success_url: `${origin}/?purchase=done`,
      cancel_url: `${origin}/?purchase=cancelled`,
    });
    if (!session.url) throw new Error("Stripe returned a session without a URL.");
    return session.url;
  };
}

export function stripeVerifier(stripe: Stripe, secret: string): VerifyWebhook {
  return (body, signature) => stripe.webhooks.constructEvent(body, signature, secret);
}
