// Stripe webhook (brief §22, §20).
// checkout.session.completed with kind=print releases the draft print order
// for submission. Digital purchases mark the book paid for download.

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
    if (!bookId) return NextResponse.json({ received: true });

    const db = adminClient();

    // Remember the Stripe customer for future purchases/subscriptions.
    if (session.customer && session.customer_email) {
      await db
        .from("profiles")
        .update({ stripe_customer_id: String(session.customer) })
        .eq("email", session.customer_email);
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

  return NextResponse.json({ received: true });
}
