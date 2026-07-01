// GET /api/auth?shop=… → redirect the merchant to Shopify's consent screen.
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { installUrl, validShop, isConfigured } from '@/lib/shopify/oauth';

export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Shopify app not configured' }, { status: 503 });
  }
  const shop = new URL(req.url).searchParams.get('shop') ?? '';
  if (!validShop(shop)) {
    return NextResponse.json({ error: 'invalid shop' }, { status: 400 });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(installUrl(shop, state));
  // CSRF: echo the state back on the callback and compare.
  res.cookies.set('haunt_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
