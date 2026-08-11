// Stripe webhook (brief §22, §20).
//
// Two things arrive here. A completed checkout with kind=print releases the
// draft print order for submission. Subscription events move a family's
// membership state.
//
// The membership half is written defensively in one specific way: a failed
// payment does not take anything away. Stripe retries a card for a couple of
// weeks, and a family locked out of their child's archive on the first
// decline — over an expired card they have not noticed — is the single worst
// support conversation this product could generate. past_due keeps full
// access; only an actual cancellation changes anything, and even that leaves
// everything readable.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/server";
import { enqueue } from "@/lib/jobs/queue";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookId = session.metadata?.book_id;
    const kind = session.metadata?.kind;
    // Not `return`. A membership checkout carries no book_id, and returning
    // here would skip every subscription branch below — the bug this shape
    // invites, since the early return reads as "nothing more to do" when it
    // means "nothing more to do *for a book purchase*".
    if (!bookId) {
      if (session.customer && session.customer_email) {
        await adminClient()
          .from("profiles")
          .update({ stripe_customer_id: String(session.customer) })
          .eq("email", session.customer_email);
      }
    } else {

    const db = adminClient();

    // Remember the Stripe customer for future purchases.
    if (session.customer && session.customer_email) {
      await db
        .from("profiles")
        .update({ stripe_customer_id: String(session.customer) })
        .eq("email", session.customer_email);
    }

    // If they asked us to keep the card, store the reference and enough of
    // the card to show them what will be charged — never the number itself,
    // which we neither receive nor want.
    if (session.metadata?.autorenew === "1" && session.payment_intent && session.customer_email) {
      try {
        const intent = await stripe().paymentIntents.retrieve(String(session.payment_intent));
        const pmId = intent.payment_method ? String(intent.payment_method) : null;
        if (pmId) {
          const pm = await stripe().paymentMethods.retrieve(pmId);
          await db
            .from("profiles")
            .update({
              default_payment_method_id: pmId,
              card_brand: pm.card?.brand ?? null,
              card_last4: pm.card?.last4 ?? null,
              card_exp_month: pm.card?.exp_month ?? null,
              card_exp_year: pm.card?.exp_year ?? null,
            })
            .eq("email", session.customer_email);
        }
      } catch (err) {
        // Not fatal: the book they just paid for still ships. They will be
        // asked again next year rather than charged silently.
        console.error("could not store the saved card:", (err as Error).message);
      }
    }

    if (kind === "print") {
      // Payment confirmed → submit the already-drafted print order (§20).
      const { data: order } = await db
        .from("print_orders")
        .select("id, status")
        .eq("book_id", bookId)
        .eq("status", "draft")
        .maybeSingle();
      if (order) {
        await enqueue(db, "submit_print", { print_order_id: order.id }, `submit-${order.id}`);
      }
    }
    }
  }

  // ---------------------------------------------------------- membership
  //
  // Every branch records a billing_events row before anything else. A
  // dispute a year from now is decided by whoever has a record of what
  // happened and when, and Stripe's dashboard is not ours.

  const db = adminClient();

  const familyOf = (obj: any): string | null => obj?.metadata?.family_id ?? null;

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as any;
    const familyId = familyOf(sub);
    if (familyId) {
      // Stripe's own status is the source of truth for whether money is
      // arriving; ours is the source of truth for what a family may do.
      const state =
        sub.status === "active" || sub.status === "trialing"
          ? "active"
          : sub.status === "past_due" || sub.status === "unpaid"
            ? "past_due"
            : sub.status === "canceled"
              ? "cancelled"
              : "active";

      await db.from("billing_events").insert({
        family_id: familyId,
        kind: `subscription.${sub.status}`,
        plan: "monthly",
        state,
        external_id: sub.id,
        note: sub.cancel_at_period_end ? "will end at the end of this period" : null,
      });

      await db
        .from("families")
        .update({
          plan: "monthly",
          membership_state: state,
          stripe_subscription_id: sub.id,
          paid_until: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        .eq("id", familyId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as any;
    const familyId = familyOf(sub);
    if (familyId) {
      await db.from("billing_events").insert({
        family_id: familyId,
        kind: "subscription.deleted",
        plan: "monthly",
        state: "cancelled",
        external_id: sub.id,
      });
      // Note what is *not* here: nothing touches subjects, memories or
      // storage. A cancelled family keeps everything, readable and
      // exportable, for ever. See ACCESS_AFTER_CANCELLING.
      await db
        .from("families")
        .update({ membership_state: "cancelled" })
        .eq("id", familyId);
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as any;
    const subId = invoice.subscription ? String(invoice.subscription) : null;
    if (subId) {
      const { data: family } = await db
        .from("families")
        .select("id, months_paid_total, months_paid_this_year")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
      if (family) {
        await db.from("billing_events").insert({
          family_id: family.id,
          kind: "invoice.paid",
          plan: "monthly",
          state: "active",
          amount_aud: invoice.amount_paid ?? null,
          external_id: invoice.id,
        });
        // Counted here rather than derived from Stripe later: the credit a
        // lapsed member is owed must not depend on a third party's API
        // being reachable at the moment they ask for it.
        await db
          .from("families")
          .update({
            membership_state: "active",
            months_paid_total: (family.months_paid_total ?? 0) + 1,
            months_paid_this_year: (family.months_paid_this_year ?? 0) + 1,
          })
          .eq("id", family.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
