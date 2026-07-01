// GET /r?product=<gid>&haunt=<event_id> — the deep link every notification opens.
// Attribute the click (haunt_events -> 'clicked'), then redirect to the PDP. The
// service worker also fires this via fetch on notificationclick; either path
// attributes exactly once (markClicked only promotes a 'sent' row).
import { NextResponse } from 'next/server';
import { supabaseStore } from '@/lib/store.supabase';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const haunt = url.searchParams.get('haunt');
  const productGid = url.searchParams.get('product');

  let pdp = '/';
  if (haunt) {
    try {
      await supabaseStore.markClicked(haunt);
      // Resolve the shop + product to an absolute storefront PDP URL.
      const { data } = await supabaseAdmin()
        .from('haunt_events')
        .select('shop_id, wishlist_item:wishlist_items!inner(product_id), shops!inner(shop_domain)')
        .eq('id', haunt)
        .maybeSingle();
      const domain = (data as { shops?: { shop_domain?: string } } | null)?.shops?.shop_domain;
      const numericId = (productGid ?? '').split('/').pop();
      if (domain && numericId) {
        pdp = `https://${domain}/products/${numericId}`;
      }
    } catch {
      // Attribution is best-effort; never block the redirect.
    }
  }
  return NextResponse.redirect(pdp);
}
