import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// What Ovyko does with each message from Stripe (docs/M7_PAYMENTS.md, M7b).
// The route checks the signature first; this only ever hands Stripe's word
// to the database, which checks it matches the school's own account, the
// payment Ovyko started and its amount, and ignores repeats.
// `admin` is the secret-key client: these functions are the server's alone.

type Admin = SupabaseClient<Database>;

const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === "string" ? v : (v?.id ?? null);

export async function handleStripeEvent(admin: Admin, event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "account.updated": {
      const a = event.data.object;
      const { data, error } = await admin.rpc("update_payment_account", {
        p_account: a.id,
        p_charges: Boolean(a.charges_enabled),
        p_payouts: Boolean(a.payouts_enabled),
        p_details: Boolean(a.details_submitted),
      });
      if (error) throw error;
      return data ? "account updated" : "ignored";
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object;
      const paymentId = s.metadata?.ovyko_payment_id;
      if (!paymentId || !event.account || s.amount_total == null) return "ignored";
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
        p_account: event.account,
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
      if (!intent || !event.account) return "ignored";
      const { data, error } = await admin.rpc("record_online_refund", {
        p_account: event.account,
        p_payment_intent: intent,
        p_refunded_cents: c.amount_refunded,
      });
      if (error) throw error;
      return data == null ? "ignored" : `refunded ${data}`;
    }
    default:
      return "ignored";
  }
}
