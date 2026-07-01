// Shared domain types. Mirror the SQL data model in supabase/migrations.

export type Trigger =
  | 'price_drop'
  | 'back_in_stock'
  | 'been_a_while'
  | 'low_stock'
  | 'abandoned_saved';

export type PersonaKey = 'clingy_ex' | 'poet' | 'deadpan';

export type Cadence = 'gentle' | 'normal' | 'persistent';

export type HauntStatus =
  | 'sent'
  | 'suppressed_cadence'
  | 'suppressed_safety'
  | 'failed'
  | 'clicked';

export interface Shop {
  id: string;
  shop_domain: string;
  access_token: string; // encrypted at rest
  persona: PersonaKey;
  cadence: Cadence;
  triggers: Record<Trigger, boolean>;
  plan: string;
  installed_at: string;
  uninstalled_at: string | null;
}

export interface Subscriber {
  id: string;
  shop_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  customer_id: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface WishlistItem {
  id: string;
  shop_id: string;
  subscriber_id: string;
  product_id: string;
  variant_id: string | null;
  title: string;
  image_url: string | null;
  price_cents: number;
  in_stock: boolean;
  saved_at: string;
  released_at: string | null;
  last_haunted_at: string | null;
  haunt_count: number;
}

export interface HauntEvent {
  id: string;
  shop_id: string;
  wishlist_item_id: string;
  subscriber_id: string;
  trigger: Trigger;
  persona: PersonaKey;
  body: string;
  status: HauntStatus;
  suppressed_reason: string | null;
  created_at: string;
}

// A candidate haunt is what a trigger enqueues. It is NOT a send — the sender is
// the only thing that sends, and it is the single gate (CLAUDE.md §trigger engine).
export interface CandidateHaunt {
  item: WishlistItem;
  subscriber: Subscriber;
  trigger: Trigger;
  // Human context for the voice model, e.g. "price just dropped to $118".
  context: string;
}

export const ALL_TRIGGERS: Trigger[] = [
  'price_drop',
  'back_in_stock',
  'been_a_while',
  'low_stock',
  'abandoned_saved',
];
