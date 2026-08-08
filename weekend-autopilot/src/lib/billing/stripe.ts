/**
 * Stripe integration (§29).
 *
 * Checkout, Customer Portal and webhooks. The signature is verified on every
 * webhook without exception (§50), and subscription state is derived from
 * Stripe events rather than from what the browser told us after a redirect —
 * a success URL is a hint, not a payment.
 */

import Stripe from "stripe";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireEnv, serverEnv } from "@/config/env";
import { url } from "@/config/brand";
import type { PlanTier, SubscriptionStatus } from "@/lib/types";
import { offerForTier, stripePriceId, type Offer } from "./plans";

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) {
    cached = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2025-02-24.acacia" });
  }
  return cached;
}

export function stripeConfigured(): boolean {
  return Boolean(serverEnv().STRIPE_SECRET_KEY);
}

// ------------------------------------------------------------ checkout

export interface CheckoutInput {
  offer: Offer;
  /** Set once the account exists, so the payment attaches to a household. */
  householdId: string | null;
  userId: string | null;
  email: string | null;
}

/**
 * Create a Checkout session.
 *
 * The brief allows the account to be created before Stripe if
 * checkout-before-account causes friction (§8). We take that option: the
 * household id travels in metadata, so the webhook can attach the payment
 * without depending on the browser returning to the success URL at all.
 */
export async function createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
  const priceId = stripePriceId(input.offer);
  if (!priceId) throw new Error(`No Stripe price configured for ${input.offer.tier}`);

  const session = await stripe().checkout.sessions.create({
    mode: input.offer.mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: url("/app?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: url("/pricing?checkout=cancelled"),
    customer_email: input.email ?? undefined,
    allow_promotion_codes: true,
    metadata: {
      tier: input.offer.tier,
      household_id: input.householdId ?? "",
      user_id: input.userId ?? "",
    },
    // Mirrored onto the subscription so renewal events carry the same context.
    ...(input.offer.mode === "subscription"
      ? {
          subscription_data: {
            metadata: {
              tier: input.offer.tier,
              household_id: input.householdId ?? "",
              user_id: input.userId ?? "",
            },
          },
        }
      : {}),
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

export async function createPortalSession(customerId: string): Promise<{ url: string }> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: url("/app/billing"),
  });
  return { url: session.url };
}

// ------------------------------------------------------------ webhooks

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(payload, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
}

export interface WebhookOutcome {
  handled: boolean;
  description: string;
}

/**
 * Apply a Stripe event to our subscription state.
 *
 * Idempotent: every path is an upsert keyed on household or Stripe customer,
 * so a replayed event produces the same state. Stripe retries aggressively and
 * a webhook handler that is not idempotent will eventually double-count
 * something that matters.
 */
export async function handleStripeEvent(
  db: SupabaseClient,
  event: Stripe.Event
): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const tier = (session.metadata?.tier ?? "PILOT_4_WEEK") as PlanTier;
      const householdId = session.metadata?.household_id || null;
      const userId = session.metadata?.user_id || null;
      const customerId = typeof session.customer === "string" ? session.customer : null;

      await recordPayment(db, {
        householdId,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        checkoutSessionId: session.id,
        amountCents: session.amount_total ?? 0,
        currency: (session.currency ?? "aud").toUpperCase(),
        tier,
        status: "paid",
        email: session.customer_details?.email ?? null,
      });

      if (householdId) {
        const offer = offerForTier(tier);
        await upsertSubscription(db, {
          householdId,
          userId,
          status: offer?.mode === "payment" ? "PILOT_ACTIVE" : "ACTIVE",
          tier,
          customerId,
          subscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
        });
      }

      return { handled: true, description: `checkout completed for ${tier}` };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const householdId = subscription.metadata?.household_id || null;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;

      await updateSubscriptionByStripeId(db, {
        householdId,
        customerId,
        subscriptionId: subscription.id,
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      return { handled: true, description: `subscription ${subscription.status}` };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await updateSubscriptionByStripeId(db, {
        householdId: subscription.metadata?.household_id || null,
        customerId: typeof subscription.customer === "string" ? subscription.customer : null,
        subscriptionId: subscription.id,
        status: "CANCELLED",
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: true,
      });
      return { handled: true, description: "subscription cancelled" };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        await db
          .from("subscriptions")
          .update({ status: "PAST_DUE" satisfies SubscriptionStatus })
          .eq("stripe_customer_id", customerId);
      }
      return { handled: true, description: "payment failed" };
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        // Recovering from PAST_DUE is the case that matters here: a renewal
        // that succeeds must restore delivery, not merely stop the dunning.
        await db
          .from("subscriptions")
          .update({ status: "ACTIVE" satisfies SubscriptionStatus })
          .eq("stripe_customer_id", customerId)
          .in("status", ["PAST_DUE", "CANCELLED"]);
      }
      return { handled: true, description: "payment succeeded" };
    }

    default:
      return { handled: false, description: `ignored ${event.type}` };
  }
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIAL";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELLED";
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "NONE";
  }
}

// ------------------------------------------------------------ persistence

async function recordPayment(
  db: SupabaseClient,
  input: {
    householdId: string | null;
    paymentIntentId: string | null;
    checkoutSessionId: string;
    amountCents: number;
    currency: string;
    tier: PlanTier;
    status: string;
    email: string | null;
  }
): Promise<void> {
  await db.from("payments").upsert(
    {
      household_id: input.householdId,
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_checkout_session_id: input.checkoutSessionId,
      amount_cents: input.amountCents,
      currency: input.currency,
      tier: input.tier,
      status: input.status,
      // Financial records survive account deletion; the email does not (§52).
      customer_email_hash: input.email
        ? createHash("sha256").update(input.email.toLowerCase()).digest("hex")
        : null,
    },
    { onConflict: "stripe_checkout_session_id" }
  );
}

async function upsertSubscription(
  db: SupabaseClient,
  input: {
    householdId: string;
    userId: string | null;
    status: SubscriptionStatus;
    tier: PlanTier;
    customerId: string | null;
    subscriptionId: string | null;
  }
): Promise<void> {
  const existing = await db
    .from("subscriptions")
    .select("id, user_id")
    .eq("household_id", input.householdId)
    .maybeSingle();

  const userId = input.userId ?? (existing.data?.user_id as string | undefined);
  if (!userId) throw new Error("Cannot create a subscription without a user");

  await db.from("subscriptions").upsert(
    {
      household_id: input.householdId,
      user_id: userId,
      status: input.status,
      tier: input.tier,
      stripe_customer_id: input.customerId,
      stripe_subscription_id: input.subscriptionId,
    },
    { onConflict: "household_id" }
  );
}

async function updateSubscriptionByStripeId(
  db: SupabaseClient,
  input: {
    householdId: string | null;
    customerId: string | null;
    subscriptionId: string;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  }
): Promise<void> {
  const patch = {
    status: input.status,
    stripe_subscription_id: input.subscriptionId,
    current_period_end: input.currentPeriodEnd,
    cancel_at_period_end: input.cancelAtPeriodEnd,
  };

  // Prefer the household from metadata; fall back to the Stripe customer so a
  // subscription created outside our flow still lands somewhere sensible.
  if (input.householdId) {
    await db.from("subscriptions").update(patch).eq("household_id", input.householdId);
    return;
  }
  if (input.customerId) {
    await db.from("subscriptions").update(patch).eq("stripe_customer_id", input.customerId);
  }
}

/** Advance the pilot counter after a delivery, and flag the fourth (§29). */
export async function advancePilotWeek(
  db: SupabaseClient,
  householdId: string
): Promise<{ week: number; completed: boolean }> {
  const { data } = await db
    .from("subscriptions")
    .select("pilot_week_number, status")
    .eq("household_id", householdId)
    .maybeSingle();

  if (!data || data.status !== "PILOT_ACTIVE") return { week: 0, completed: false };

  const week = Math.min(4, (data.pilot_week_number as number) + 1);
  await db.from("subscriptions").update({ pilot_week_number: week }).eq("household_id", householdId);

  return { week, completed: week >= 4 };
}
