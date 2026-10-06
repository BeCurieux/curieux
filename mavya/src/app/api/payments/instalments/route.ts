import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { paymentsOn, stripe } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/supabase/server-env";

// Takes the instalments due today (docs/M7_PAYMENTS.md, M7c part 2), with
// the card or bank account each plan saved. Called every hour by the
// database's schedule (private.kick_instalments) with CRON_SECRET; nobody
// else can call it. Each instalment is claimed once and charged once.
export async function POST(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  if (!paymentsOn()) return NextResponse.json({ taken: 0 });
  const admin = createAdminClient();
  const { data: due, error } = await admin.rpc("claim_due_instalments", { p_limit: 50 });
  if (error) throw error;

  // waiting: Stripe gave no clear answer; tried again later with the same
  // payment id, so it's never charged twice.
  const tally = { paid: 0, processing: 0, failed: 0, waiting: 0 };
  for (const d of due ?? []) {
    let intent: string;
    let status: "paid" | "processing" | "failed";
    try {
      const pi = await stripe().paymentIntents.create(
        {
          amount: d.amount_cents,
          currency: "aud",
          customer: d.stripe_customer_id,
          payment_method: d.payment_method_id,
          off_session: true,
          confirm: true,
          application_fee_amount: d.platform_fee_cents,
          description: `Fees: ${d.school_name} (instalment)`,
          metadata: { ovyko_payment_id: d.payment_id },
        },
        { stripeAccount: d.stripe_account_id, idempotencyKey: `instalment:${d.payment_id}` },
      );
      intent = pi.id;
      status =
        pi.status === "succeeded" ? "paid" : pi.status === "processing" ? "processing" : "failed";
    } catch (e) {
      // Only a decline (or the bank wanting the parent present) is a
      // failure. Anything else (a timeout, Stripe down) may still have
      // charged: leave it for Stripe's message or the next try.
      if (!(e instanceof Stripe.errors.StripeCardError)) {
        console.error("instalment not taken yet", d.payment_id, e);
        tally.waiting += 1;
        continue;
      }
      const pi = (e.raw as { payment_intent?: { id: string } } | undefined)?.payment_intent;
      intent = pi?.id ?? `failed:${d.payment_id}`;
      status = "failed";
    }
    const settled = await admin.rpc("settle_instalment_payment", {
      p_payment: d.payment_id,
      p_account: d.stripe_account_id,
      p_payment_intent: intent,
      p_amount_cents: d.amount_cents,
      p_status: status,
    });
    if (settled.error) {
      // Stripe's own message settles it instead.
      console.error("instalment not recorded yet", d.payment_id, settled.error);
      tally.waiting += 1;
      continue;
    }
    tally[status] += 1;
  }
  return NextResponse.json(tally);
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
