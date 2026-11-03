import type { Currency } from "@/lib/calc/format";
import { reaches, type AccessTier } from "@/lib/course/tiers";

// What a checkout should charge, decided before Stripe is called. Pure, so
// every rule in SPEC.md → Access tiers and Stripe is unit-tested:
//   - AUD for Australia, USD for everyone else (the caller picks currency)
//   - Module 0 offers the benchmark pack as an optional item (the bump)
//   - the course (and founding) credit Module 0 in full for its owners
//   - founding is refused once 30 places are sold
//   - nobody pays for something she already has
// No tax is added or itemised anywhere.

export type ProductTier = AccessTier | "benchmark_pack";

export interface Product {
  id: string;
  slug: string;
  name: string;
  tier: ProductTier;
  price_aud_cents: number;
  price_usd_cents: number;
  stripe_price_id_aud: string | null;
  stripe_price_id_usd: string | null;
  active: boolean;
  places_total: number | null;
  places_sold: number;
}

export interface Owned {
  tier: AccessTier | null;
  benchmarkPack: boolean;
}

export type Plan =
  | {
      ok: true;
      product: Product;
      currency: Currency;
      priceId: string;
      amountCents: number;
      bump: { product: Product; priceId: string; amountCents: number } | null;
      credit: { amountCents: number; reason: string } | null;
      placesLeft: number | null;
    }
  | { ok: false; reason: string };

export const priceCents = (product: Product, currency: Currency) =>
  currency === "AUD" ? product.price_aud_cents : product.price_usd_cents;

export const priceId = (product: Product, currency: Currency) =>
  currency === "AUD" ? product.stripe_price_id_aud : product.stripe_price_id_usd;

const TIER_NAME: Record<AccessTier, string> = {
  free: "the free Product Check",
  module0: "Module 0",
  course: "the full course",
  founding: "a founding place",
};

export function checkoutPlan(
  slug: string,
  products: Product[],
  owned: Owned,
  currency: Currency,
): Plan {
  const product = products.find((p) => p.slug === slug);
  if (!product || !product.active || product.tier === "free")
    return { ok: false, reason: "That isn't something you can buy." };

  if (product.tier === "benchmark_pack") {
    if (owned.benchmarkPack) return { ok: false, reason: "You already have the benchmark pack." };
  } else if (reaches(owned.tier, product.tier)) {
    return {
      ok: false,
      reason: `You already have ${TIER_NAME[owned.tier!]}, which includes this.`,
    };
  }

  let placesLeft: number | null = null;
  if (product.places_total !== null) {
    placesLeft = Math.max(0, product.places_total - product.places_sold);
    if (placesLeft === 0)
      return { ok: false, reason: `All ${product.places_total} founding places are taken.` };
  }

  const id = priceId(product, currency);
  if (!id) return { ok: false, reason: `${product.name} isn't on sale in ${currency} yet.` };

  // The bump: the benchmark pack, offered on Module 0 to someone without it.
  let bump: Extract<Plan, { ok: true }>["bump"] = null;
  const pack = products.find((p) => p.tier === "benchmark_pack");
  if (product.tier === "module0" && pack?.active && !owned.benchmarkPack) {
    const bumpId = priceId(pack, currency);
    if (bumpId) bump = { product: pack, priceId: bumpId, amountCents: priceCents(pack, currency) };
  }

  // Module 0 is credited in full when she moves up from it.
  let credit: Extract<Plan, { ok: true }>["credit"] = null;
  const moduleZero = products.find((p) => p.tier === "module0");
  if (
    (product.tier === "course" || product.tier === "founding") &&
    owned.tier === "module0" &&
    moduleZero
  ) {
    credit = {
      amountCents: priceCents(moduleZero, currency),
      reason: "Module 0, credited in full",
    };
  }

  return {
    ok: true,
    product,
    currency,
    priceId: id,
    amountCents: priceCents(product, currency),
    bump,
    credit,
    placesLeft,
  };
}

// ---------------------------------------------------------------------------
// Refunds: 14 days from purchase, self-serve, no reason asked. After that,
// she emails and the founder can still refund from /admin.

export const REFUND_DAYS = 14;

export function refundable(
  order: { status: string; created_at: string },
  now = new Date(),
): boolean {
  if (order.status !== "paid") return false;
  return now.getTime() - new Date(order.created_at).getTime() <= REFUND_DAYS * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Reading a completed Checkout Session back into a purchase.

export interface SessionLike {
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_intent: string | { id: string } | null;
}

export interface Purchase {
  sessionId: string;
  paymentIntent: string;
  userId: string;
  productSlug: string;
  amountCents: number;
  currency: string;
  bump: boolean;
}

/** Null unless the session is paid and carries what we put on it. */
export function purchaseFromSession(
  session: SessionLike,
  lineItemPriceIds: string[],
  bumpPriceIds: string[],
): Purchase | null {
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const productSlug = session.metadata?.product_slug;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (session.payment_status !== "paid" || !userId || !productSlug || !paymentIntent) return null;
  return {
    sessionId: session.id,
    paymentIntent,
    userId,
    productSlug,
    amountCents: session.amount_total ?? 0,
    currency: (session.currency ?? "aud").toLowerCase(),
    bump: lineItemPriceIds.some((id) => bumpPriceIds.includes(id)),
  };
}
