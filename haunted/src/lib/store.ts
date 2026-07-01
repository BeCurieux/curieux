// The persistence boundary the sender + trigger engine depend on. The Supabase
// implementation lives in store.supabase.ts; the cadence simulation suite uses
// an in-memory fake. Keeping this an interface means the send-path logic is
// tested against the SAME code that runs in prod, with no network.

import type { CadenceReads } from '@/lib/cadence';
import type {
  HauntEvent,
  HauntStatus,
  Subscriber,
  Trigger,
  PersonaKey,
} from '@/lib/types';

export interface RecordHauntInput {
  shop_id: string;
  wishlist_item_id: string;
  subscriber_id: string;
  trigger: Trigger;
  persona: PersonaKey;
  body: string;
  status: HauntStatus;
  suppressed_reason?: string | null;
}

export interface HauntStore extends CadenceReads {
  // Append one audit row per candidate. Suppression is observable, never silent.
  recordHauntEvent(input: RecordHauntInput): Promise<HauntEvent>;
  // On a successful send: bump haunt_count and stamp last_haunted_at.
  markItemHaunted(itemId: string, at: number): Promise<void>;
  // On 404/410: stop sending to this endpoint (dead-subscription pruning).
  revokeSubscriber(subscriberId: string, at: number): Promise<void>;
  // Attribute a click back to a haunt_events row (status -> 'clicked').
  markClicked(hauntEventId: string): Promise<void>;
  // For the sender to hydrate a subscriber's push keys when needed.
  getSubscriber(subscriberId: string): Promise<Subscriber | null>;
}
