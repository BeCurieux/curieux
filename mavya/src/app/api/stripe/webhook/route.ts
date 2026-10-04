import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { accountFlags, planSubscription, stripe } from "@/lib/payments/stripe";
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
  async subscription(id) {
    return planSubscription(await stripe().subscriptions.retrieve(id));
  },
  async savedPaymentMethod(account, intent) {
    const pi = await stripe().paymentIntents.retrieve(
      intent,
      { expand: ["payment_method"] },
      { stripeAccount: account },
    );
    const pm = pi.payment_method;
    if (!pm || typeof pm === "string") return null;
    if (pm.type === "card") return { id: pm.id, type: "card" };
    if (pm.type === "au_becs_debit") return { id: pm.id, type: "direct_debit" };
    return null;
  },
};

// Stripe signs messages about schools' accounts and about Ovyko's own
// account with different secrets; either will do.
function verify(body: string, signature: string, secrets: string[]): Stripe.Event | null {
  for (const secret of secrets) {
    try {
      return stripe().webhooks.constructEvent(body, signature, secret);
    } catch {
      // Try the next secret.
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !serverEnv().STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "payments are off" }, { status: 503 });
  }
  const body = await request.text();
  const event = verify(
    body,
    request.headers.get("stripe-signature") ?? "",
    secret.split(",").map((s) => s.trim()),
  );
  if (!event) return NextResponse.json({ error: "not signed by Stripe" }, { status: 400 });
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
