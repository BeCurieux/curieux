import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// What Ovyko does with each message from Stripe (docs/M7_PAYMENTS.md, M7b).
// The route checks the signature first; this only ever hands Stripe's word
// to the database, which checks it matches the school's own account, the
// payment Ovyko started and its amount, and ignores repeats.
// `admin` is the secret-key client: these functions are the server's alone.

type Admin = SupabaseClient<Database>;

// What the handler asks Stripe itself, rather than trusting a message's
// copy, which may be old or arrive out of order.
export type StripeLookups = {
  // Ovyko's payment id on a payment intent, if it's Ovyko's.
  paymentIdForIntent(account: string, intent: string): Promise<string | null>;
  // How a school's account stands now.
  accountFlags(account: string): Promise<{ charges: boolean; payouts: boolean; details: boolean }>;
  // A school's subscription to Ovyko's plan as it stands now (Ovyko's own
  // Stripe account).
  subscription(id: string): Promise<PlanSubscription>;
};

export type PlanSubscription = {
  id: string;
  customer: string;
  status: string;
  locations: number;
  priceCents: number;
  trialEnd: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

// Thrown so the route answers with an error and Stripe sends the message
// again later.
export class TryAgainLater extends Error {}

const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === "string" ? v : (v?.id ?? null);

export async function handleStripeEvent(
  admin: Admin,
  event: Stripe.Event,
  stripe: StripeLookups,
): Promise<string> {
  const account = event.account;
  switch (event.type) {
    case "account.updated": {
      const id = event.data.object.id;
      const flags = await stripe.accountFlags(id);
      const { data, error } = await admin.rpc("update_payment_account", {
        p_account: id,
        p_charges: flags.charges,
        p_payouts: flags.payouts,
        p_details: flags.details,
      });
      if (error) throw error;
      return data ? "account updated" : "ignored";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      // Only Ovyko's own plan: a school's subscriptions to its own
      // customers, on its own account, are none of Ovyko's business.
      if (account) return "ignored";
      const sub = await stripe.subscription(event.data.object.id);
      const { data, error } = await admin.rpc("save_school_subscription", {
        p_customer: sub.customer,
        p_subscription: sub.id,
        p_status: sub.status,
        p_locations: sub.locations,
        p_price_cents: sub.priceCents,
        // No trial or period yet is stored as none.
        p_trial_end: sub.trialEnd as string,
        p_period_end: sub.periodEnd as string,
        p_cancel_at_period_end: sub.cancelAtPeriodEnd,
      });
      if (error) throw error;
      return data ? `plan ${sub.status}` : "ignored";
    }
    case "account.application.deauthorized": {
      if (!account) return "ignored";
      const { data, error } = await admin.rpc("payment_account_disconnected", {
        p_account: account,
      });
      if (error) throw error;
      return data ? "account disconnected" : "ignored";
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object;
      const paymentId = s.metadata?.ovyko_payment_id;
      if (!paymentId || !account || s.amount_total == null) return "ignored";
      const [status, method] =
        event.type === "checkout.session.completed"
          ? s.payment_status === "paid"
            ? (["paid", "card"] as const)
            : (["processing", "direct_debit"] as const)
          : event.type === "checkout.session.async_payment_succeeded"
            ? (["paid", "direct_debit"] as const)
            : event.type === "checkout.session.async_payment_failed"
              ? (["failed", "direct_debit"] as const)
              : (["expired", null] as const);
      const { data, error } = await admin.rpc("settle_online_payment", {
        p_payment: paymentId,
        p_account: account,
        p_session: s.id,
        p_amount_cents: s.amount_total,
        p_status: status,
        p_payment_intent: idOf(s.payment_intent) ?? undefined,
        p_method: method ?? undefined,
      });
      // A payment id that isn't a uuid is someone else's page, not an error.
      if (error?.code === "22P02") return "ignored";
      if (error) throw error;
      return data ?? "ignored";
    }
    case "charge.refunded": {
      const c = event.data.object;
      const intent = idOf(c.payment_intent);
      if (!intent || !account) return "ignored";
      const { data, error } = await admin.rpc("record_online_refund", {
        p_account: account,
        p_payment_intent: intent,
        p_refunded_cents: c.amount_refunded,
      });
      if (error) throw error;
      if (data != null) return `refunded ${data}`;
      await settledOrRetry(admin, stripe, account, intent);
      return "ignored";
    }
    case "refund.failed":
    case "charge.refund.updated": {
      const r = event.data.object;
      if (r.status !== "failed") return "ignored";
      const intent = idOf(r.payment_intent);
      if (!intent || !account) return "ignored";
      const { data, error } = await admin.rpc("record_refund_failed", {
        p_account: account,
        p_payment_intent: intent,
        p_refund: r.id,
        p_amount_cents: r.amount,
      });
      if (error) throw error;
      if (data != null) return `refund failed ${data}`;
      await settledOrRetry(admin, stripe, account, intent);
      return "ignored";
    }
    case "charge.dispute.closed": {
      const d = event.data.object;
      if (d.status !== "lost") return "ignored";
      const intent = idOf(d.payment_intent);
      if (!intent || !account) return "ignored";
      const { data, error } = await admin.rpc("record_lost_dispute", {
        p_account: account,
        p_payment_intent: intent,
        p_dispute: d.id,
        p_amount_cents: d.amount,
      });
      if (error) throw error;
      if (data != null) return `dispute lost ${data}`;
      await settledOrRetry(admin, stripe, account, intent);
      return "ignored";
    }
    default:
      return "ignored";
  }
}

// A message about one of Ovyko's payments that hasn't been settled yet
// (Stripe doesn't promise order): ask Stripe to send it again later rather
// than lose it. Anything that isn't Ovyko's is ignored.
async function settledOrRetry(
  admin: Admin,
  stripe: StripeLookups,
  account: string,
  intent: string,
) {
  const paymentId = await stripe.paymentIdForIntent(account, intent);
  if (!paymentId) return;
  const { data, error } = await admin.rpc("online_payment_status", {
    p_account: account,
    p_payment: paymentId,
  });
  if (error) throw error;
  if (data && data !== "paid") throw new TryAgainLater(`payment ${paymentId} is ${data}`);
}
