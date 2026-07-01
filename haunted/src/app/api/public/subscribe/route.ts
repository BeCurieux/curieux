// POST /api/public/subscribe — store a browser's push subscription for this shop.
// App-proxy signed; shop_id is derived from the verified signature, never trusted
// from the body (CLAUDE.md §data model). Returns the subscriber id so the block
// can attach saved items to it.
import { NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/shopify/appProxy';
import { getShopByDomain, upsertSubscriber } from '@/lib/store.supabase';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const verified = verifyAppProxySignature(url);
  if (!verified) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  const shop = await getShopByDomain(verified.shop);
  if (!shop) return NextResponse.json({ error: 'not installed' }, { status: 404 });

  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    customer_id?: string | null;
  };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  }

  const sub = await upsertSubscriber({
    shop_id: shop.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    // logged_in_customer_id is injected by the App Proxy when the shopper is
    // authenticated; fall back to the client hint only for the anon case.
    customer_id: url.searchParams.get('logged_in_customer_id') || body.customer_id || null,
  });
  return NextResponse.json({ subscriber_id: sub.id });
}
