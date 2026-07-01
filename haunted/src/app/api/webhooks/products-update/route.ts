// POST /api/webhooks/products-update — the back_in_stock + price_drop signal.
// Verify HMAC, reconcile every saved copy of this product, and enqueue the
// candidate through the sender gate (the only place that sends).
import { NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/shopify/oauth';
import { getShopByDomain } from '@/lib/store.supabase';
import { supabaseAdmin } from '@/lib/supabase';
import { sendHaunt } from '@/lib/sender';
import { senderDeps } from '@/lib/deps';
import { evalBackInStock, evalPriceDrop } from '@/lib/triggers';
import type { Subscriber, WishlistItem } from '@/lib/types';

interface WebhookVariant {
  id: number;
  price: string;
  inventory_quantity?: number;
  inventory_policy?: string;
}
interface WebhookProduct {
  id: number;
  variants: WebhookVariant[];
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookHmac(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'bad hmac' }, { status: 401 });
  }
  const shopDomain = req.headers.get('x-shopify-shop-domain');
  if (!shopDomain) return NextResponse.json({ ok: true });
  const shop = await getShopByDomain(shopDomain);
  if (!shop || shop.uninstalled_at) return NextResponse.json({ ok: true });

  const product = JSON.parse(raw) as WebhookProduct;
  const productGid = `gid://shopify/Product/${product.id}`;

  // Live state per variant: cheapest available price + any-variant availability.
  const anyInStock = product.variants.some(
    (v) => (v.inventory_quantity ?? 0) > 0 || v.inventory_policy === 'continue',
  );
  const minPriceCents = Math.min(
    ...product.variants.map((v) => Math.round(parseFloat(v.price) * 100)).filter((n) => Number.isFinite(n)),
  );

  const admin = supabaseAdmin();
  const { data } = await admin
    .from('wishlist_items')
    .select('*, subscriber:subscribers!inner(*)')
    .eq('shop_id', shop.id)
    .eq('product_id', productGid)
    .is('released_at', null)
    .is('subscriber.revoked_at', null);

  const rows = (data as Array<WishlistItem & { subscriber: Subscriber }> | null) ?? [];
  const deps = senderDeps();
  const enabled = shop.triggers;

  for (const row of rows) {
    const { subscriber, ...item } = row;
    const wi = item as WishlistItem;

    const drop = evalPriceDrop(wi, minPriceCents);
    const restock = evalBackInStock(wi, anyInStock);

    // Reconcile stored state so future comparisons are correct.
    await admin
      .from('wishlist_items')
      .update({ in_stock: anyInStock })
      .eq('id', wi.id);

    let candidate: { trigger: 'price_drop' | 'back_in_stock'; context: string } | null = null;
    if (enabled.back_in_stock && restock.fires) candidate = { trigger: 'back_in_stock', context: restock.context };
    else if (enabled.price_drop && drop.fires) candidate = { trigger: 'price_drop', context: drop.context };

    if (candidate) {
      await sendHaunt({ item: wi, subscriber, ...candidate }, shop, deps);
    }
  }

  return NextResponse.json({ ok: true });
}
