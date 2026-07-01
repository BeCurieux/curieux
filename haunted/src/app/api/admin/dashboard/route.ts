// GET dashboard metrics for the merchant: items haunted, open rate, reunions,
// recovered revenue, recent reunions feed. Derived from haunt_events +
// wishlist_items. Shop is derived from the verified session token.
import { NextResponse } from 'next/server';
import { shopFromRequest } from '@/lib/shopify/session';
import { getShopByDomain } from '@/lib/store.supabase';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const shop = shopFromRequest(req);
  if (!shop) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const row = await getShopByDomain(shop);
  if (!row) return NextResponse.json({ error: 'not installed' }, { status: 404 });

  const admin = supabaseAdmin();
  const countBy = async (status: string) => {
    const { count } = await admin
      .from('haunt_events')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', row.id)
      .eq('status', status);
    return count ?? 0;
  };

  const [sent, clicked] = await Promise.all([countBy('sent'), countBy('clicked')]);
  // A 'clicked' row started as 'sent', so total delivered = sent + clicked.
  const delivered = sent + clicked;
  const openedPct = delivered > 0 ? Math.round((clicked / delivered) * 100) : 0;

  // Reunions = released items that had at least one haunt (came home). For v1 we
  // approximate recovered revenue as sum of price_cents of reunited items.
  const { data: reunited } = await admin
    .from('wishlist_items')
    .select('title, price_cents, released_at')
    .eq('shop_id', row.id)
    .gt('haunt_count', 0)
    .not('released_at', 'is', null)
    .order('released_at', { ascending: false })
    .limit(10);

  const reunions = reunited?.length ?? 0;
  const recoveredCents = (reunited ?? []).reduce(
    (sum, r) => sum + ((r.price_cents as number) ?? 0),
    0,
  );

  return NextResponse.json({
    haunted: delivered,
    openedPct,
    reunions,
    recoveredCents,
    recentReunions: (reunited ?? []).map((r) => ({
      title: r.title as string,
      at: r.released_at as string,
    })),
  });
}
