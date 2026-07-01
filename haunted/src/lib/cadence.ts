// Guardrail 1 — cadence caps (CLAUDE.md). One function stands between every
// candidate haunt and the push service. Triggers can fire all day; nothing goes
// out unless this returns ok. Limits are SERVER CONSTANTS — never read from
// anything client-supplied.

import type { Cadence, WishlistItem, Subscriber } from '@/lib/types';

// Windows are deliberately conservative. These are ceilings, not targets.
export const LIMITS: Record<
  Cadence,
  {
    minGapHours: number; // min hours between haunts for the SAME item
    perItemWindow: number; // max haunts per item per rolling 30 days
    perSubscriberDaily: number; // max haunts across ALL items per subscriber per day
    perItemLifetime: number; // hard lifetime cap per item, all cadences
  }
> = {
  gentle: { minGapHours: 168, perItemWindow: 2, perSubscriberDaily: 1, perItemLifetime: 5 },
  normal: { minGapHours: 72, perItemWindow: 4, perSubscriberDaily: 2, perItemLifetime: 8 },
  persistent: { minGapHours: 36, perItemWindow: 6, perSubscriberDaily: 3, perItemLifetime: 10 },
};

export type SuppressionReason =
  | 'lifetime_cap'
  | 'min_gap'
  | 'item_window'
  | 'subscriber_daily';

export interface CadenceDecision {
  ok: boolean;
  reason?: SuppressionReason;
}

// Rolling-window counts the gate needs. Backed by haunt_events in prod, by an
// in-memory fake in the cadence simulation suite. Both count only status='sent'.
export interface CadenceReads {
  // haunts for THIS item within the last `sinceMs` milliseconds
  itemHauntsSince(itemId: string, sinceMs: number, now: number): Promise<number>;
  // haunts for THIS subscriber (across all items) within the last `sinceMs`
  subscriberHauntsSince(subscriberId: string, sinceMs: number, now: number): Promise<number>;
}

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function hoursSince(iso: string | null, now: number): number {
  if (!iso) return Infinity;
  return (now - new Date(iso).getTime()) / HOUR;
}

// The gate. Order matters only for which reason we report; all caps are hard.
export async function canHaunt(
  item: Pick<WishlistItem, 'id' | 'haunt_count' | 'last_haunted_at'>,
  subscriber: Pick<Subscriber, 'id'>,
  cadence: Cadence,
  reads: CadenceReads,
  now: number = Date.now(),
): Promise<CadenceDecision> {
  const L = LIMITS[cadence];

  // Absolute lifetime cap — even Persistent cannot exceed it.
  if (item.haunt_count >= L.perItemLifetime) {
    return { ok: false, reason: 'lifetime_cap' };
  }
  // Per-item minimum gap.
  if (hoursSince(item.last_haunted_at, now) < L.minGapHours) {
    return { ok: false, reason: 'min_gap' };
  }
  // Per-item rolling 30-day window.
  if ((await reads.itemHauntsSince(item.id, 30 * DAY, now)) >= L.perItemWindow) {
    return { ok: false, reason: 'item_window' };
  }
  // Per-subscriber daily cap across ALL items.
  if ((await reads.subscriberHauntsSince(subscriber.id, DAY, now)) >= L.perSubscriberDaily) {
    return { ok: false, reason: 'subscriber_daily' };
  }
  return { ok: true };
}
