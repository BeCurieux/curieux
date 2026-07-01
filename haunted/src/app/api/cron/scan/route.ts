// POST /api/cron/scan — the scheduled been_a_while pass (Vercel Cron / Supabase
// scheduled function). Auth: Bearer CRON_SECRET. For every installed shop with
// the been_a_while trigger on, enqueue a candidate per eligible item; the sender
// gate decides what actually goes out. price_drop / back_in_stock are driven by
// the products/update webhook, not here.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { activeItemsForShop } from '@/lib/store.supabase';
import { evalBeenAWhile } from '@/lib/triggers';
import { sendHaunt } from '@/lib/sender';
import { senderDeps } from '@/lib/deps';
import type { Shop } from '@/lib/types';

const BEEN_A_WHILE_DAYS = 14;

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: shops } = await supabaseAdmin()
    .from('shops')
    .select('*')
    .is('uninstalled_at', null);

  const deps = senderDeps();
  let considered = 0;
  let attempted = 0;

  for (const shop of (shops as Shop[]) ?? []) {
    if (!shop.triggers.been_a_while) continue;
    const pairs = await activeItemsForShop(shop.id);
    for (const { item, subscriber } of pairs) {
      considered++;
      const res = evalBeenAWhile(item, BEEN_A_WHILE_DAYS);
      if (!res.fires) continue;
      attempted++;
      // The sender's cadence gate handles "hasn't been haunted recently".
      await sendHaunt({ item, subscriber, trigger: 'been_a_while', context: res.context }, shop, deps);
    }
  }

  return NextResponse.json({ ok: true, considered, attempted });
}
