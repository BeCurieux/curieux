import { NextResponse } from "next/server";
import { currentUser, userClient } from "@/lib/supabase/server";
import { getHouseholdForUser, getSubscription } from "@/lib/db/repository";
import { createPortalSession, stripeConfigured } from "@/lib/billing/stripe";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const db = userClient();
  const household = await getHouseholdForUser(db, user.id);
  if (!household) return NextResponse.json({ error: "No household" }, { status: 404 });

  // Read through the user client so RLS confirms the caller owns this
  // subscription before we hand them a portal session for its customer.
  const subscription = await getSubscription(db, household.id);
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 404 });
  }

  try {
    const session = await createPortalSession(subscription.stripe_customer_id);
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Couldn’t open the billing portal" }, { status: 500 });
  }
}
