// GET/POST the merchant's persona / cadence / trigger settings. Auth is by
// session token — the shop is derived from the verified token, never the body.
import { NextResponse } from 'next/server';
import { shopFromRequest } from '@/lib/shopify/session';
import { getShopByDomain, upsertShop } from '@/lib/store.supabase';
import { PERSONA_KEYS } from '@/config/personas';
import { ALL_TRIGGERS } from '@/lib/types';
import type { Cadence, PersonaKey, Trigger } from '@/lib/types';

const CADENCES: Cadence[] = ['gentle', 'normal', 'persistent'];

export async function GET(req: Request) {
  const shop = shopFromRequest(req);
  if (!shop) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const row = await getShopByDomain(shop);
  if (!row) return NextResponse.json({ error: 'not installed' }, { status: 404 });
  return NextResponse.json({ persona: row.persona, cadence: row.cadence, triggers: row.triggers });
}

export async function POST(req: Request) {
  const shop = shopFromRequest(req);
  if (!shop) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    persona?: string;
    cadence?: string;
    triggers?: Record<string, unknown>;
  };

  // Validate against server-known values. Cadence LIMITS themselves are server
  // constants (cadence.ts); here we only accept a known cadence *key*.
  const persona = PERSONA_KEYS.includes(body.persona as PersonaKey)
    ? (body.persona as PersonaKey)
    : undefined;
  const cadence = CADENCES.includes(body.cadence as Cadence)
    ? (body.cadence as Cadence)
    : undefined;

  let triggers: Record<Trigger, boolean> | undefined;
  if (body.triggers) {
    triggers = {} as Record<Trigger, boolean>;
    for (const t of ALL_TRIGGERS) triggers[t] = Boolean(body.triggers[t]);
  }

  const updated = await upsertShop({
    shop_domain: shop,
    ...(persona ? { persona } : {}),
    ...(cadence ? { cadence } : {}),
    ...(triggers ? { triggers } : {}),
  });
  return NextResponse.json({
    persona: updated.persona,
    cadence: updated.cadence,
    triggers: updated.triggers,
  });
}
