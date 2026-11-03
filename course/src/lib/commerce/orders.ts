import "server-only";
import type Stripe from "stripe";
import type { AccessTier } from "@/lib/course/tiers";
import { serviceClient } from "@/lib/supabase/server";
import { purchaseFromSession, type Owned, type Product } from "./plan";
import { stripe } from "./stripe";

// Purchases and refunds, shared by the webhook, the checkout success page,
// the account page's refund button and (step 8) the admin page. Each reads
// the truth from Stripe and records it through the database functions in
// migration 6, which are idempotent, so the order they run in never matters.

const PRODUCT_COLUMNS =
  "id, slug, name, tier, price_aud_cents, price_usd_cents, stripe_price_id_aud, stripe_price_id_usd, active, places_total, places_sold";

export async function loadProducts(): Promise<Product[]> {
  const { data, error } = await serviceClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .returns<Product[]>();
  if (error) throw new Error(`products: ${error.message}`);
  return data;
}

export async function ownedBy(userId: string): Promise<Owned> {
  const db = serviceClient();
  const [tier, pack] = await Promise.all([
    db.rpc("tier_of", { p_user: userId }),
    db.rpc("has_benchmark_pack_of", { p_user: userId }),
  ]);
  if (tier.error) throw new Error(`tier_of: ${tier.error.message}`);
  if (pack.error) throw new Error(`has_benchmark_pack_of: ${pack.error.message}`);
  return { tier: tier.data as AccessTier, benchmarkPack: pack.data === true };
}

export type RecordOutcome =
  | { status: "recorded" | "duplicate"; userId: string; productSlug: string }
  | { status: "sold_out"; userId: string; productSlug: string }
  | { status: "unpaid" };

/** Records a Checkout Session as Stripe reports it. Safe to call any number of times. */
export async function recordCheckoutSession(sessionId: string): Promise<RecordOutcome> {
  const api = stripe();
  if (!api) throw new Error("Stripe isn't configured");
  const session = await api.checkout.sessions.retrieve(sessionId);
  const lineItems = await api.checkout.sessions.listLineItems(sessionId, { limit: 10 });
  const products = await loadProducts();
  const bumpPriceIds = products
    .filter((p) => p.tier === "benchmark_pack")
    .flatMap((p) => [p.stripe_price_id_aud, p.stripe_price_id_usd])
    .filter((id): id is string => Boolean(id));
  const purchase = purchaseFromSession(
    session as unknown as Parameters<typeof purchaseFromSession>[0],
    lineItems.data.map((item) => item.price?.id).filter((id): id is string => Boolean(id)),
    bumpPriceIds,
  );
  if (!purchase) return { status: "unpaid" };

  const { data, error } = await serviceClient().rpc("record_purchase", {
    p_session_id: purchase.sessionId,
    p_payment_intent: purchase.paymentIntent,
    p_user: purchase.userId,
    p_product_slug: purchase.productSlug,
    p_amount_cents: purchase.amountCents,
    p_currency: purchase.currency,
    p_bump: purchase.bump,
  });
  if (error) throw new Error(`record_purchase: ${error.message}`);
  const status = data as "recorded" | "duplicate" | "sold_out";

  if (status === "sold_out") {
    // She paid while the 30th place went. Give it all back.
    try {
      await api.refunds.create({
        payment_intent: purchase.paymentIntent,
        reason: "requested_by_customer",
        metadata: { why: "founding_sold_out" },
      });
    } catch (refundError) {
      if (!isAlreadyRefunded(refundError)) throw refundError;
    }
    console.warn("founding sold out; refunded", purchase.sessionId);
  }
  return { status, userId: purchase.userId, productSlug: purchase.productSlug };
}

const isAlreadyRefunded = (error: unknown) =>
  (error as Stripe.errors.StripeError | undefined)?.code === "charge_already_refunded";

/** Records a refund Stripe has made (the webhook's charge.refunded). */
export async function recordRefund(paymentIntent: string): Promise<string> {
  const { data, error } = await serviceClient().rpc("record_refund", {
    p_payment_intent: paymentIntent,
  });
  if (error) throw new Error(`record_refund: ${error.message}`);
  return data as string;
}

/**
 * Refunds an order in full: Stripe first, then the same recording the
 * webhook does, so access goes now even if the webhook is slow. The caller
 * has already checked who may refund it (her own within 14 days, or an
 * admin).
 */
export async function refundOrder(orderId: string): Promise<"refunded" | "already"> {
  const api = stripe();
  if (!api) throw new Error("Stripe isn't configured");
  const { data: order, error } = await serviceClient()
    .from("orders")
    .select("stripe_payment_intent, status")
    .eq("id", orderId)
    .single<{ stripe_payment_intent: string | null; status: string }>();
  if (error) throw new Error(`order: ${error.message}`);
  if (order.status === "refunded") return "already";
  if (!order.stripe_payment_intent) throw new Error("order has no payment to refund");
  try {
    await api.refunds.create({
      payment_intent: order.stripe_payment_intent,
      reason: "requested_by_customer",
    });
  } catch (refundError) {
    if (!isAlreadyRefunded(refundError)) throw refundError;
  }
  const result = await recordRefund(order.stripe_payment_intent);
  return result === "already" ? "already" : "refunded";
}
