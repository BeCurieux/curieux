// Stripe webhook (brief §35).
//
// Only does two things: move a paying user onto their plan, and move them off
// it when the subscription ends. Signature verification is mandatory — an
// unverified webhook is an open endpoint for granting yourself a paid plan.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStore } from "@/lib/db/store";
import { billingEnabled, planForPrice, stripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ ok: false }, { status: 404 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ ok: false }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("[stripe] bad signature", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const store = getStore();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      const plan = (session.metadata?.plan as "pro" | "business" | undefined) ?? null;
      if (userId && plan) {
        await store.upsertSubscription({
          userId,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
          plan,
          status: "active",
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      const active = subscription.status === "active" || subscription.status === "trialing";
      const plan = active ? (planForPrice(subscription.items.data[0]?.price?.id) ?? "free") : "free";

      await store.upsertSubscription({
        userId,
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
        stripeSubscriptionId: subscription.id,
        plan,
        status: subscription.status,
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
