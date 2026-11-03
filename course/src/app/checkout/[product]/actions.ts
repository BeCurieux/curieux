"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/env";
import { requestOrigin } from "@/lib/auth/origin";
import { currentUser } from "@/lib/auth/session";
import { myCurrency } from "@/lib/calc/runs";
import { loadProducts, ownedBy } from "@/lib/commerce/orders";
import { checkoutPlan } from "@/lib/commerce/plan";
import { stripe } from "@/lib/commerce/stripe";
import { userClient } from "@/lib/supabase/server";

export interface CheckoutState {
  error?: string;
}

const SESSION_MINUTES = 30;

// Creates the Stripe Checkout Session and sends her to it. Every rule is
// decided here, on the server, from the database: currency by country, the
// bump, the Module 0 credit, the founding limit, nothing she already owns.
export async function startCheckout(
  slug: string,
  _prev: CheckoutState,
  _form: FormData,
): Promise<CheckoutState> {
  const user = await currentUser();
  if (!user?.email) redirect(`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`);
  const api = stripe();
  if (!api) return { error: "Checkout isn't switched on yet. Please try again soon." };

  const supabase = await userClient();
  const [products, owned, currency] = await Promise.all([
    loadProducts(),
    ownedBy(user.id),
    myCurrency(supabase),
  ]);
  const plan = checkoutPlan(slug, products, owned, currency);
  if (!plan.ok) return { error: plan.reason };

  const origin = requestOrigin(await headers(), serverEnv().APP_URL);
  let url: string | null;
  try {
    const coupon = plan.credit
      ? await api.coupons.create({
          amount_off: plan.credit.amountCents,
          currency: currency.toLowerCase(),
          duration: "once",
          max_redemptions: 1,
          name: "Module 0 credit",
          metadata: { user_id: user.id, for: plan.product.slug },
        })
      : null;
    const metadata = { user_id: user.id, product_slug: plan.product.slug };
    const session = await api.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      ...(plan.bump ? { optional_items: [{ price: plan.bump.priceId, quantity: 1 }] } : {}),
      ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
      customer_email: user.email,
      client_reference_id: user.id,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${plan.product.slug}?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
    });
    url = session.url;
  } catch (error) {
    console.error("checkout", slug, error instanceof Error ? error.message : error);
    return { error: "We couldn't start the payment just now. Please try again in a minute." };
  }
  if (!url)
    return { error: "We couldn't start the payment just now. Please try again in a minute." };
  redirect(url);
}
