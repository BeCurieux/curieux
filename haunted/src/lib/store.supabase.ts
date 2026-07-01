// Supabase-backed HauntStore + the repo helpers the app + trigger engine use.
// This is the production implementation of the interface the cadence simulation
// exercises with an in-memory fake — same contract, real Postgres.

import { supabaseAdmin } from '@/lib/supabase';
import type { HauntStore, RecordHauntInput } from '@/lib/store';
import type {
  HauntEvent,
  Shop,
  Subscriber,
  Trigger,
  WishlistItem,
} from '@/lib/types';

export const supabaseStore: HauntStore = {
  async recordHauntEvent(input: RecordHauntInput): Promise<HauntEvent> {
    const { data, error } = await supabaseAdmin()
      .from('haunt_events')
      .insert({
        shop_id: input.shop_id,
        wishlist_item_id: input.wishlist_item_id,
        subscriber_id: input.subscriber_id,
        trigger: input.trigger,
        persona: input.persona,
        body: input.body,
        status: input.status,
        suppressed_reason: input.suppressed_reason ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as HauntEvent;
  },

  async itemHauntsSince(itemId, sinceMs, now) {
    const since = new Date(now - sinceMs).toISOString();
    const { count, error } = await supabaseAdmin()
      .from('haunt_events')
      .select('id', { count: 'exact', head: true })
      .eq('wishlist_item_id', itemId)
      .eq('status', 'sent')
      .gt('created_at', since);
    if (error) throw error;
    return count ?? 0;
  },

  async subscriberHauntsSince(subscriberId, sinceMs, now) {
    const since = new Date(now - sinceMs).toISOString();
    const { count, error } = await supabaseAdmin()
      .from('haunt_events')
      .select('id', { count: 'exact', head: true })
      .eq('subscriber_id', subscriberId)
      .eq('status', 'sent')
      .gt('created_at', since);
    if (error) throw error;
    return count ?? 0;
  },

  async markItemHaunted(itemId, at) {
    // Atomic-ish increment via RPC would be ideal; for v1 read-modify-write is
    // acceptable because the send job processes one candidate per item per pass.
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('wishlist_items')
      .select('haunt_count')
      .eq('id', itemId)
      .single();
    if (error) throw error;
    const next = ((data?.haunt_count as number) ?? 0) + 1;
    const { error: uErr } = await admin
      .from('wishlist_items')
      .update({ haunt_count: next, last_haunted_at: new Date(at).toISOString() })
      .eq('id', itemId);
    if (uErr) throw uErr;
  },

  async revokeSubscriber(subscriberId, at) {
    const { error } = await supabaseAdmin()
      .from('subscribers')
      .update({ revoked_at: new Date(at).toISOString() })
      .eq('id', subscriberId);
    if (error) throw error;
  },

  async markClicked(hauntEventId) {
    // Only promote a real send to 'clicked'; never resurrect a suppressed row.
    const { error } = await supabaseAdmin()
      .from('haunt_events')
      .update({ status: 'clicked' })
      .eq('id', hauntEventId)
      .eq('status', 'sent');
    if (error) throw error;
  },

  async getSubscriber(subscriberId): Promise<Subscriber | null> {
    const { data, error } = await supabaseAdmin()
      .from('subscribers')
      .select('*')
      .eq('id', subscriberId)
      .maybeSingle();
    if (error) throw error;
    return (data as Subscriber) ?? null;
  },
};

// --- Repo helpers used by routes / cron (not part of the HauntStore contract) --

export async function getShopByDomain(domain: string): Promise<Shop | null> {
  const { data, error } = await supabaseAdmin()
    .from('shops')
    .select('*')
    .eq('shop_domain', domain)
    .maybeSingle();
  if (error) throw error;
  return (data as Shop) ?? null;
}

export async function upsertShop(shop: Partial<Shop> & { shop_domain: string }): Promise<Shop> {
  const { data, error } = await supabaseAdmin()
    .from('shops')
    .upsert(shop, { onConflict: 'shop_domain' })
    .select()
    .single();
  if (error) throw error;
  return data as Shop;
}

export async function upsertSubscriber(
  sub: Omit<Subscriber, 'id' | 'created_at' | 'revoked_at'>,
): Promise<Subscriber> {
  const { data, error } = await supabaseAdmin()
    .from('subscribers')
    .upsert(
      { ...sub, revoked_at: null },
      { onConflict: 'shop_id,endpoint' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as Subscriber;
}

export async function insertWishlistItem(
  item: Omit<WishlistItem, 'id' | 'saved_at' | 'released_at' | 'last_haunted_at' | 'haunt_count'>,
): Promise<WishlistItem> {
  const { data, error } = await supabaseAdmin()
    .from('wishlist_items')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data as WishlistItem;
}

export async function listWishlist(
  shopId: string,
  subscriberId: string,
): Promise<WishlistItem[]> {
  const { data, error } = await supabaseAdmin()
    .from('wishlist_items')
    .select('*')
    .eq('shop_id', shopId)
    .eq('subscriber_id', subscriberId)
    .is('released_at', null)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data as WishlistItem[]) ?? [];
}

export async function releaseItem(shopId: string, itemId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('wishlist_items')
    .update({ released_at: new Date().toISOString() })
    .eq('shop_id', shopId)
    .eq('id', itemId);
  if (error) throw error;
}

// Candidate source for the trigger cron: active items for a shop, with their
// subscriber's push keys, that haven't been released.
export async function activeItemsForShop(shopId: string): Promise<
  Array<{ item: WishlistItem; subscriber: Subscriber }>
> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('wishlist_items')
    .select('*, subscriber:subscribers!inner(*)')
    .eq('shop_id', shopId)
    .is('released_at', null)
    .is('subscriber.revoked_at', null);
  if (error) throw error;
  type Row = WishlistItem & { subscriber: Subscriber };
  return ((data as Row[]) ?? []).map((row) => {
    const { subscriber, ...item } = row;
    return { item: item as WishlistItem, subscriber };
  });
}
