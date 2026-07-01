// The trigger engine (CLAUDE.md §trigger engine). Triggers DO NOT send. They
// evaluate state and enqueue candidate haunts. The sender is the only thing that
// sends and the only gate. Each helper here is pure: given state, it decides
// whether a trigger fires and builds the human context string for the voice.

import type { CandidateHaunt, Subscriber, Trigger, WishlistItem } from '@/lib/types';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

// price_drop — fires on a DECREASE only (live price < price at save time).
export function evalPriceDrop(
  item: WishlistItem,
  livePriceCents: number,
): { fires: boolean; context: string } {
  const fires = item.released_at == null && livePriceCents < item.price_cents;
  return {
    fires,
    context: `price just dropped to ${dollars(livePriceCents)} (was ${dollars(item.price_cents)})`,
  };
}

// back_in_stock — item flips false -> true (driven by products/update webhook).
export function evalBackInStock(
  item: WishlistItem,
  liveInStock: boolean,
): { fires: boolean; context: string } {
  const fires = item.released_at == null && item.in_stock === false && liveInStock === true;
  return { fires, context: 'back in stock' };
}

// been_a_while — cron. Saved >= N days ago, never reunited, not haunted recently.
// The "not recently" part is the sender's cadence gate; here we only gate on the
// coarse age so we don't enqueue freshly-saved items.
export function evalBeenAWhile(
  item: WishlistItem,
  minAgeDays: number,
  now: number = Date.now(),
): { fires: boolean; context: string } {
  const ageDays = (now - new Date(item.saved_at).getTime()) / (24 * 3600 * 1000);
  const fires = item.released_at == null && ageDays >= minAgeDays;
  return { fires, context: `saved ${Math.floor(ageDays)} days ago` };
}

export interface LiveVariantState {
  priceCents: number;
  inStock: boolean;
}

// Build the candidate list for one item given its live state and the shop's
// enabled triggers. Multiple triggers can qualify; we enqueue at most one
// candidate per item per pass, preferring the most compelling reason.
export function candidatesForItem(
  item: WishlistItem,
  subscriber: Subscriber,
  live: LiveVariantState,
  enabled: Record<Trigger, boolean>,
  opts: { beenAWhileDays: number; now?: number } = { beenAWhileDays: 14 },
): CandidateHaunt[] {
  const now = opts.now ?? Date.now();
  const order: Array<{ trigger: Trigger; res: { fires: boolean; context: string } }> = [
    { trigger: 'price_drop', res: evalPriceDrop(item, live.priceCents) },
    { trigger: 'back_in_stock', res: evalBackInStock(item, live.inStock) },
    { trigger: 'been_a_while', res: evalBeenAWhile(item, opts.beenAWhileDays, now) },
  ];

  for (const { trigger, res } of order) {
    if (enabled[trigger] && res.fires) {
      return [{ item, subscriber, trigger, context: res.context }];
    }
  }
  return [];
}
