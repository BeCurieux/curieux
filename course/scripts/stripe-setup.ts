// Creates the Stripe products and prices: `npm run stripe:setup`
//
// One Stripe product per tier with two prices, AUD and USD (SPEC.md →
// Access tiers and Stripe), from the prices in the products table. Writes
// the price ids back to the table. Safe to re-run: prices are found by
// lookup key (hle_<tier>_<currency>); a changed amount gets a new price
// that takes over the lookup key, since Stripe prices can't be edited.
// No tax settings are added.
//
// Run against test mode first (sk_test_… in .env.local), then once with
// the live key and production's Supabase values at launch.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const { STRIPE_SECRET_KEY, STRIPE_API_BASE, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } =
  process.env;
if (!STRIPE_SECRET_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Set STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or put them in .env.local).",
  );
  process.exit(1);
}
const base = STRIPE_API_BASE ? new URL(STRIPE_API_BASE) : null;
const stripe = new Stripe(
  STRIPE_SECRET_KEY,
  base
    ? {
        host: base.hostname,
        port: base.port,
        protocol: base.protocol === "https:" ? "https" : "http",
      }
    : {},
);
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Row {
  id: string;
  slug: string;
  name: string;
  tier: string;
  price_aud_cents: number;
  price_usd_cents: number;
}

const { data: products, error } = await db
  .from("products")
  .select("id, slug, name, tier, price_aud_cents, price_usd_cents")
  .neq("tier", "free")
  .returns<Row[]>();
if (error) throw new Error(error.message);

for (const product of products) {
  const keys = { aud: `hle_${product.tier}_aud`, usd: `hle_${product.tier}_usd` };
  const existing = await stripe.prices.list({
    lookup_keys: [keys.aud, keys.usd],
    active: true,
    limit: 10,
  });
  const byKey = new Map(existing.data.map((price) => [price.lookup_key, price]));
  const productId =
    (existing.data[0]?.product as string | undefined) ??
    (
      await stripe.products.create({
        name: product.name,
        metadata: { tier: product.tier, slug: product.slug },
      })
    ).id;

  const ids: Record<"aud" | "usd", string> = { aud: "", usd: "" };
  for (const currency of ["aud", "usd"] as const) {
    const amount = currency === "aud" ? product.price_aud_cents : product.price_usd_cents;
    const current = byKey.get(keys[currency]);
    if (current && current.unit_amount === amount && current.currency === currency) {
      ids[currency] = current.id;
      continue;
    }
    const created = await stripe.prices.create({
      product: productId,
      currency,
      unit_amount: amount,
      lookup_key: keys[currency],
      transfer_lookup_key: true,
      nickname: `${product.name} (${currency.toUpperCase()})`,
    });
    ids[currency] = created.id;
    console.log(`${product.name}: new ${currency.toUpperCase()} price ${created.id}`);
  }

  const { error: saveError } = await db
    .from("products")
    .update({ stripe_price_id_aud: ids.aud, stripe_price_id_usd: ids.usd })
    .eq("id", product.id);
  if (saveError) throw new Error(saveError.message);
}
console.log(`Stripe prices ready for ${products.length} products.`);
