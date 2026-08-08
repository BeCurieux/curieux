import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, userClient } from "@/lib/supabase/server";
import { createCheckoutSession, stripeConfigured } from "@/lib/billing/stripe";
import { offerForTier, visibleOffers } from "@/lib/billing/plans";
import { getHouseholdForUser } from "@/lib/db/repository";
import { rateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({ tier: z.string() });

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "checkout", { limit: 10, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Only offers currently on sale can be purchased. Without this check the
  // flags hide an offer from the page while leaving it buyable by anyone who
  // knows the tier name (§6).
  const offer = offerForTier(parsed.data.tier);
  if (!offer || !visibleOffers().some((o) => o.tier === offer.tier)) {
    return NextResponse.json({ error: "That plan isn’t available" }, { status: 400 });
  }

  if (!stripeConfigured()) {
    // Local development without Stripe keys: the client walks the user through
    // signup instead, so the rest of the flow stays testable.
    return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
  }

  // The customer may or may not have an account yet — both orders are
  // supported (§8). When they do, the household travels in metadata so the
  // webhook can attach the purchase without trusting the browser’s return.
  const user = await currentUser();
  const household = user ? await getHouseholdForUser(userClient(), user.id) : null;

  try {
    const session = await createCheckoutSession({
      offer,
      householdId: household?.id ?? null,
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
