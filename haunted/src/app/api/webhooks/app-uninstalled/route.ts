// POST /api/webhooks/app-uninstalled — Shopify fires this on uninstall. Verify
// the body HMAC, then stamp uninstalled_at so the send job stops touching this
// shop. We keep the row (and its history) rather than hard-deleting.
import { NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/shopify/oauth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookHmac(raw, req.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'bad hmac' }, { status: 401 });
  }
  const shop = req.headers.get('x-shopify-shop-domain');
  if (shop) {
    await supabaseAdmin()
      .from('shops')
      .update({ uninstalled_at: new Date().toISOString(), access_token: null })
      .eq('shop_domain', shop);
  }
  return NextResponse.json({ ok: true });
}
