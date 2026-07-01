// Cadence simulation — a build-breaker (CLAUDE.md §Testing). Hammers the sender
// gate across a simulated 30 days at hourly resolution and asserts NO cadence
// ceiling is ever breached, for every cadence. A trigger fires on every tick;
// only the gate stands between it and a "send".

import { describe, it, expect } from 'vitest';
import { sendHaunt, type SenderDeps } from '@/lib/sender';
import { LIMITS } from '@/lib/cadence';
import type { Cadence, CandidateHaunt, Shop, Subscriber, WishlistItem } from '@/lib/types';
import { FakeStore, cozyGenerator, alwaysCozyClassifier, alwaysDeliversPush } from './fakes';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const START = 1_700_000_000_000; // fixed epoch so the sim is deterministic

function makeItem(id: string, store: FakeStore): WishlistItem {
  const item: WishlistItem = {
    id,
    shop_id: 'shop_1',
    subscriber_id: 'sub_1',
    product_id: `gid://shopify/Product/${id}`,
    variant_id: null,
    title: 'The Jacket',
    image_url: null,
    price_cents: 12000,
    in_stock: true,
    saved_at: new Date(START - 20 * DAY).toISOString(),
    released_at: null,
    last_haunted_at: null,
    haunt_count: 0,
  };
  store.items.set(id, item);
  return item;
}

function makeSubscriber(id: string, store: FakeStore): Subscriber {
  const sub: Subscriber = {
    id,
    shop_id: 'shop_1',
    endpoint: `https://push.example/${id}`,
    p256dh: 'k',
    auth: 'a',
    customer_id: null,
    created_at: new Date(START).toISOString(),
    revoked_at: null,
  };
  store.subscribers.set(id, sub);
  return sub;
}

async function runSim(cadence: Cadence, itemIds: string[]) {
  const store = new FakeStore();
  const shop: Pick<Shop, 'id' | 'shop_domain' | 'persona' | 'cadence'> = {
    id: 'shop_1',
    shop_domain: 'avoca.myshopify.com',
    persona: 'clingy_ex',
    cadence,
  };
  const sub = makeSubscriber('sub_1', store);
  itemIds.forEach((id) => makeItem(id, store));

  const deps: SenderDeps = {
    store,
    generator: cozyGenerator,
    classifier: alwaysCozyClassifier,
    push: alwaysDeliversPush,
    appUrl: 'https://haunted.example.com',
  };

  // 30 days, hourly. A been_a_while candidate is available for every item every
  // hour — the worst case the gate must survive.
  for (let t = START; t < START + 30 * DAY; t += HOUR) {
    store.now = t;
    for (const id of itemIds) {
      const item = store.items.get(id)!;
      const candidate: CandidateHaunt = {
        item,
        subscriber: sub,
        trigger: 'been_a_while',
        context: 'saved 20 days ago',
      };
      await sendHaunt(candidate, shop, deps, t);
    }
  }
  return store;
}

describe.each<Cadence>(['gentle', 'normal', 'persistent'])('cadence: %s', (cadence) => {
  const L = LIMITS[cadence];
  const itemIds = ['item_a', 'item_b', 'item_c'];

  it('never breaches any ceiling over 30 days', async () => {
    const store = await runSim(cadence, itemIds);

    for (const id of itemIds) {
      const sends = store.sentRowsForItem(id).sort((a, b) => a.at - b.at);

      // Lifetime cap — absolute, even Persistent obeys it.
      expect(sends.length, `${cadence}/${id} exceeded lifetime cap`).toBeLessThanOrEqual(
        L.perItemLifetime,
      );

      // Per-item 30-day window (the whole sim is 30 days, so total <= window).
      expect(sends.length, `${cadence}/${id} exceeded 30d window`).toBeLessThanOrEqual(
        L.perItemWindow,
      );

      // Minimum gap between consecutive sends for the same item.
      for (let i = 1; i < sends.length; i++) {
        const gapHours = (sends[i]!.at - sends[i - 1]!.at) / HOUR;
        expect(gapHours, `${cadence}/${id} gap too short`).toBeGreaterThanOrEqual(L.minGapHours);
      }
    }

    // Per-subscriber daily cap: no rolling 24h window exceeds the limit.
    const subSends = store.sentRowsForSub('sub_1').map((r) => r.at);
    for (const anchor of subSends) {
      const inWindow = subSends.filter((at) => at > anchor - DAY && at <= anchor).length;
      expect(inWindow, `${cadence} subscriber daily cap breached`).toBeLessThanOrEqual(
        L.perSubscriberDaily,
      );
    }
  });
});

describe('lifetime cap is absolute', () => {
  it('persistent still stops at its lifetime cap', async () => {
    const store = await runSim('persistent', ['solo']);
    expect(store.sentRowsForItem('solo').length).toBeLessThanOrEqual(LIMITS.persistent.perItemLifetime);
  });
});
