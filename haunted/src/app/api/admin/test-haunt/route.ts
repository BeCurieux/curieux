// POST /api/admin/test-haunt — send one real haunt to the merchant's most recent
// subscriber so they can see it land on their own lock screen (build order §3:
// "Get one real notification onto your own lock screen"). Goes through the SAME
// sender gate as production — cadence + safety are enforced here too.
import { NextResponse } from 'next/server';
import { shopFromRequest } from '@/lib/shopify/session';
import { getShopByDomain } from '@/lib/store.supabase';
import { supabaseAdmin } from '@/lib/supabase';
import { sendHaunt } from '@/lib/sender';
import { senderDeps } from '@/lib/deps';
import type { Subscriber, WishlistItem } from '@/lib/types';

export async function POST(req: Request) {
  const shop = shopFromRequest(req);
  if (!shop) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const row = await getShopByDomain(shop);
  if (!row) return NextResponse.json({ error: 'not installed' }, { status: 404 });

  const admin = supabaseAdmin();
  // Pick the newest saved item that still has a live (non-revoked) subscriber.
  const { data } = await admin
    .from('wishlist_items')
    .select('*, subscriber:subscribers!inner(*)')
    .eq('shop_id', row.id)
    .is('released_at', null)
    .is('subscriber.revoked_at', null)
    .order('saved_at', { ascending: false })
    .limit(1);

  const first = (data as Array<WishlistItem & { subscriber: Subscriber }> | null)?.[0];
  if (!first) {
    return NextResponse.json({ error: 'no subscriber yet' }, { status: 404 });
  }
  const { subscriber, ...item } = first;

  const report = await sendHaunt(
    { item: item as WishlistItem, subscriber, trigger: 'been_a_while', context: 'a friendly hello' },
    row,
    senderDeps(),
  );
  return NextResponse.json(report);
}
