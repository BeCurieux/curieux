// GET /api/auth/callback — verify HMAC + state, exchange code → offline token,
// store it encrypted, register webhooks, then bounce into the embedded admin.
import { NextResponse } from 'next/server';
import {
  verifyCallbackHmac,
  exchangeToken,
  registerWebhooks,
  validShop,
} from '@/lib/shopify/oauth';
import { encrypt } from '@/lib/crypto';
import { upsertShop } from '@/lib/store.supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const shop = query.shop ?? '';
  const code = query.code ?? '';

  if (!validShop(shop) || !code) {
    return NextResponse.json({ error: 'invalid callback' }, { status: 400 });
  }
  if (!verifyCallbackHmac(query)) {
    return NextResponse.json({ error: 'bad hmac' }, { status: 401 });
  }
  const state = req.headers.get('cookie')?.match(/haunt_oauth_state=([a-f0-9]+)/)?.[1];
  if (!state || state !== query.state) {
    return NextResponse.json({ error: 'bad state' }, { status: 401 });
  }

  const token = await exchangeToken(shop, code);
  await upsertShop({ shop_domain: shop, access_token: encrypt(token) });
  await registerWebhooks(shop, token);

  // Land inside Shopify admin (App Bridge takes over from there).
  const apiKey = process.env.SHOPIFY_API_KEY ?? '';
  return NextResponse.redirect(`https://${shop}/admin/apps/${apiKey}`);
}
