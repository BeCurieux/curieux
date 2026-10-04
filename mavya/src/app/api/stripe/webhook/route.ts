import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { accountFlags, stripe } from "@/lib/payments/stripe";
import { handleStripeEvent, TryAgainLater, type StripeLookups } from "@/lib/payments/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/supabase/server-env";

// Stripe's messages about schools' accounts and payments (M7b). Only a
// message signed with STRIPE_WEBHOOK_SECRET is read; anything else is
// turned away before it reaches the database.

const lookups: StripeLookups = {
  async paymentIdForIntent(account, intent) {
    const pi = await stripe().paymentIntents.retrieve(intent, {}, { stripeAccount: account });
    return pi.metadata?.ovyko_payment_id ?? null;
  },
  async accountFlags(account) {
    return accountFlags(await stripe().accounts.retrieve(account));
  },
};

export async function POST(request: NextRequest) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !serverEnv().STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "payments are off" }, { status: 503 });
  }
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      body,
      request.headers.get("stripe-signature") ?? "",
      secret,
    );
  } catch {
    return NextResponse.json({ error: "not signed by Stripe" }, { status: 400 });
  }
  try {
    const outcome = await handleStripeEvent(createAdminClient(), event, lookups);
    return NextResponse.json({ outcome });
  } catch (error) {
    // Stripe sends the message again later.
    if (error instanceof TryAgainLater)
      return NextResponse.json({ error: "not ready yet" }, { status: 409 });
    throw error;
  }
}
