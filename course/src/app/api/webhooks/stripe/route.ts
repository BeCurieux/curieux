import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { serverEnv } from "@/env";
import { recordCheckoutSession, recordRefund } from "@/lib/commerce/orders";
import { stripe } from "@/lib/commerce/stripe";

// Stripe webhook (SPEC.md → Webhook rules). Verifies the signature on the
// raw body, then records through the same idempotent steps as the success
// page and the refund button. Any failure returns 500 so Stripe retries.
//
// Events: checkout.session.completed (and async_payment_succeeded, for
// payment methods that settle later), charge.refunded.
// Receipts and the onboarding emails arrive with step 7 (Resend).

export async function POST(request: NextRequest) {
  const api = stripe();
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!api || !secret) {
    console.error("stripe webhook: not configured");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = api.webhooks.constructEvent(
      payload,
      request.headers.get("stripe-signature") ?? "",
      secret,
    );
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const outcome = await recordCheckoutSession(event.data.object.id);
        console.info("stripe webhook", event.type, event.data.object.id, outcome.status);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        // Only a full refund ends access; a partial refund is a goodwill gesture.
        if (charge.refunded && paymentIntent)
          console.info("stripe webhook refund", paymentIntent, await recordRefund(paymentIntent));
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("stripe webhook", event.type, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
