// In-memory doubles for the send-path suites. The FakeStore implements the SAME
// HauntStore interface the Supabase store implements, so the cadence simulation
// exercises the real gate logic with zero network.

import type { HauntStore, RecordHauntInput } from '@/lib/store';
import type { HauntEvent, Subscriber, WishlistItem } from '@/lib/types';
import type { LineGenerator } from '@/lib/anthropic';
import type { SafetyClassifier } from '@/lib/guardrails';
import type { PushSender } from '@/lib/push';

interface Row {
  id: string;
  itemId: string;
  subId: string;
  status: string;
  at: number;
}

export class FakeStore implements HauntStore {
  now = 0; // sim clock; set before each sendHaunt so created_at matches
  rows: Row[] = [];
  items = new Map<string, WishlistItem>();
  subscribers = new Map<string, Subscriber>();
  private seq = 0;

  async recordHauntEvent(input: RecordHauntInput): Promise<HauntEvent> {
    const id = `ev_${++this.seq}`;
    this.rows.push({
      id,
      itemId: input.wishlist_item_id,
      subId: input.subscriber_id,
      status: input.status,
      at: this.now,
    });
    return {
      id,
      shop_id: input.shop_id,
      wishlist_item_id: input.wishlist_item_id,
      subscriber_id: input.subscriber_id,
      trigger: input.trigger,
      persona: input.persona,
      body: input.body,
      status: input.status,
      suppressed_reason: input.suppressed_reason ?? null,
      created_at: new Date(this.now).toISOString(),
    };
  }

  async itemHauntsSince(itemId: string, sinceMs: number, now: number): Promise<number> {
    return this.rows.filter(
      (r) => r.itemId === itemId && r.status === 'sent' && r.at > now - sinceMs,
    ).length;
  }

  async subscriberHauntsSince(subscriberId: string, sinceMs: number, now: number): Promise<number> {
    return this.rows.filter(
      (r) => r.subId === subscriberId && r.status === 'sent' && r.at > now - sinceMs,
    ).length;
  }

  async markItemHaunted(itemId: string, at: number): Promise<void> {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`no such item ${itemId}`);
    item.haunt_count += 1;
    item.last_haunted_at = new Date(at).toISOString();
  }

  async revokeSubscriber(subscriberId: string, at: number): Promise<void> {
    const s = this.subscribers.get(subscriberId);
    if (s) s.revoked_at = new Date(at).toISOString();
  }

  async markClicked(hauntEventId: string): Promise<void> {
    const r = this.rows.find((x) => x.id === hauntEventId);
    if (r) r.status = 'clicked';
  }

  async getSubscriber(subscriberId: string): Promise<Subscriber | null> {
    return this.subscribers.get(subscriberId) ?? null;
  }

  // Test helpers.
  sentRowsForItem(itemId: string): Row[] {
    return this.rows.filter((r) => r.itemId === itemId && r.status === 'sent');
  }
  sentRowsForSub(subId: string): Row[] {
    return this.rows.filter((r) => r.subId === subId && r.status === 'sent');
  }
}

// A generator that always returns a cozy, valid line — isolates the cadence
// suite from the voice engine.
export const cozyGenerator: LineGenerator = {
  async generate() {
    return 'Still here, still fond of you.';
  },
};

export const alwaysCozyClassifier: SafetyClassifier = {
  async classify() {
    return 'COZY';
  },
};

export const alwaysDeliversPush: PushSender = {
  async send() {
    return { ok: true };
  },
};
