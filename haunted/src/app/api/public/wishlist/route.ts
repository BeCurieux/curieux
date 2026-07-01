// The storefront wishlist endpoint (app-proxy signed). GET lists a subscriber's
// items; POST saves one; DELETE releases one ("Go in peace, little one"). shop_id
// is always derived from the verified signature — the client's shop is ignored.
import { NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/shopify/appProxy';
import {
  getShopByDomain,
  insertWishlistItem,
  listWishlist,
  releaseItem,
} from '@/lib/store.supabase';
import { supabaseAdmin } from '@/lib/supabase';

async function shopAndSub(req: Request) {
  const url = new URL(req.url);
  const verified = verifyAppProxySignature(url);
  if (!verified) return null;
  const shop = await getShopByDomain(verified.shop);
  if (!shop) return null;
  return { shop, subscriberId: url.searchParams.get('subscriber_id') };
}

export async function GET(req: Request) {
  const ctx = await shopAndSub(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!ctx.subscriberId) return NextResponse.json({ items: [] });
  const items = await listWishlist(ctx.shop.id, ctx.subscriberId);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const ctx = await shopAndSub(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    subscriber_id?: string;
    product_id?: string;
    variant_id?: string | null;
    title?: string;
    image_url?: string | null;
    price_cents?: number;
    in_stock?: boolean;
  };
  const subscriberId = body.subscriber_id ?? ctx.subscriberId;
  if (!subscriberId || !body.product_id || !body.title || typeof body.price_cents !== 'number') {
    return NextResponse.json({ error: 'invalid item' }, { status: 400 });
  }

  // Guard: the subscriber must belong to this shop (defense in depth over RLS).
  const { data: sub } = await supabaseAdmin()
    .from('subscribers')
    .select('id')
    .eq('id', subscriberId)
    .eq('shop_id', ctx.shop.id)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: 'unknown subscriber' }, { status: 400 });

  const item = await insertWishlistItem({
    shop_id: ctx.shop.id,
    subscriber_id: subscriberId,
    product_id: body.product_id,
    variant_id: body.variant_id ?? null,
    title: body.title,
    image_url: body.image_url ?? null,
    price_cents: body.price_cents,
    in_stock: body.in_stock ?? true,
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  const ctx = await shopAndSub(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  await releaseItem(ctx.shop.id, id);
  return NextResponse.json({ ok: true });
}
