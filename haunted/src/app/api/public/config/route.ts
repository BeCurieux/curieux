// GET /api/public/config — the storefront app block fetches the VAPID public key
// to subscribe the browser to push. Public, but still app-proxy signed so we know
// the requesting shop is installed.
import { NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/shopify/appProxy';
import { getShopByDomain } from '@/lib/store.supabase';

export async function GET(req: Request) {
  const verified = verifyAppProxySignature(new URL(req.url));
  if (!verified) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  const shop = await getShopByDomain(verified.shop);
  if (!shop) return NextResponse.json({ error: 'not installed' }, { status: 404 });
  return NextResponse.json({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC ?? process.env.VAPID_PUBLIC ?? '',
    persona: shop.persona,
  });
}
