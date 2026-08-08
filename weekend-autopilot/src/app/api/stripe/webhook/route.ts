import { NextResponse, type NextRequest } from "next/server";
import { constructWebhookEvent, handleStripeEvent } from "@/lib/billing/stripe";
import { serviceClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

// The signature is computed over the raw body, so it must not be parsed or
// re-serialised before verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (error) {
    // An unverifiable webhook is an attacker or a misconfiguration. Either way
    // it does not get to change subscription state (§29, §50).
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const db = serviceClient();
    const outcome = await handleStripeEvent(db, event);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const householdId = session.metadata?.household_id;
      if (householdId) {
        track(householdId, ANALYTICS_EVENTS.PURCHASE_COMPLETED, {
          tier: session.metadata?.tier,
        });
      }
    }

    return NextResponse.json({ received: true, ...outcome });
  } catch (error) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // database problem. The event has already been verified at this point.
    const message = error instanceof Error ? error.message : "Handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
