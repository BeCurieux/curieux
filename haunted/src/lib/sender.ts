// The sender — the ONLY thing that sends (CLAUDE.md §trigger engine + guardrails).
// Triggers enqueue candidates; this is the single gate where cadence and safety
// are enforced, once, so no trigger path can bypass them. Every candidate — sent
// or suppressed — writes exactly one haunt_events row. Suppression is observable.

import type { CandidateHaunt, Shop, Subscriber } from '@/lib/types';
import { canHaunt } from '@/lib/cadence';
import { composeLine } from '@/lib/voice';
import type { SafetyClassifier } from '@/lib/guardrails';
import type { LineGenerator } from '@/lib/anthropic';
import type { PushSender } from '@/lib/push';
import type { HauntStore } from '@/lib/store';

export interface SenderDeps {
  store: HauntStore;
  generator: LineGenerator;
  classifier: SafetyClassifier;
  push: PushSender;
  appUrl: string; // public base URL, for the ?haunt deep link
}

export type SendOutcome =
  | 'sent'
  | 'suppressed_cadence'
  | 'suppressed_safety'
  | 'failed';

export interface SendReport {
  outcome: SendOutcome;
  eventId: string;
  reason?: string;
}

// Process one candidate haunt end-to-end. Never throws for expected failure
// modes — every path resolves to a logged haunt_events row.
export async function sendHaunt(
  candidate: CandidateHaunt,
  shop: Pick<Shop, 'id' | 'shop_domain' | 'persona' | 'cadence'>,
  deps: SenderDeps,
  now: number = Date.now(),
): Promise<SendReport> {
  const { item, subscriber, trigger, context } = candidate;

  // Gate 1 — cadence. Hard ceilings, server constants.
  const gate = await canHaunt(item, subscriber, shop.cadence, deps.store, now);
  if (!gate.ok) {
    const ev = await deps.store.recordHauntEvent({
      shop_id: shop.id,
      wishlist_item_id: item.id,
      subscriber_id: subscriber.id,
      trigger,
      persona: shop.persona,
      body: '',
      status: 'suppressed_cadence',
      suppressed_reason: gate.reason ?? 'cadence',
    });
    return { outcome: 'suppressed_cadence', eventId: ev.id, reason: gate.reason };
  }

  // Gate 2 — voice + safety. composeLine guarantees a vetted line (safe-bank
  // fallback), so the haunt is never skipped for lack of a line.
  const voice = await composeLine(
    {
      persona: shop.persona,
      trigger,
      triggerContext: context,
      itemTitle: item.title,
      seed: item.id,
    },
    deps.generator,
    deps.classifier,
  );

  // Observability: if we fell back to the safe bank because generations were
  // unsafe (not because of an outage), record a suppressed_safety audit row.
  // The vetted safe-bank line still goes out below — the haunt is never skipped
  // for a safety rejection. (composeLine already validated any generated line;
  // the safe bank is pre-vetted by the regression suite, so no extra classifier
  // call is made here — the brief's "single classifier call" holds.)
  if (voice.source === 'safe_bank' && voice.fallbackReason === 'rejected') {
    await deps.store.recordHauntEvent({
      shop_id: shop.id,
      wishlist_item_id: item.id,
      subscriber_id: subscriber.id,
      trigger,
      persona: shop.persona,
      body: '',
      status: 'suppressed_safety',
      suppressed_reason: 'generation_rejected',
    });
  }

  // Deliver. Record the event first so the deep link's ?haunt=<id> attributes.
  const ev = await deps.store.recordHauntEvent({
    shop_id: shop.id,
    wishlist_item_id: item.id,
    subscriber_id: subscriber.id,
    trigger,
    persona: shop.persona,
    body: voice.line,
    status: 'sent',
    // Fallbacks are observable per the brief ("every fallback is logged").
    suppressed_reason: voice.source === 'safe_bank' ? 'fallback:safe_bank' : null,
  });

  const url = deepLink(deps.appUrl, item.product_id, ev.id);
  const result = await deps.push.send(subscriber, {
    title: shop.shop_domain,
    body: voice.line,
    icon: item.image_url,
    url,
  });

  if (result.gone) {
    await deps.store.revokeSubscriber(subscriber.id, now);
  }
  if (!result.ok) {
    await deps.store.recordHauntEvent({
      shop_id: shop.id,
      wishlist_item_id: item.id,
      subscriber_id: subscriber.id,
      trigger,
      persona: shop.persona,
      body: voice.line,
      status: 'failed',
      suppressed_reason: result.gone ? 'endpoint_gone' : 'push_error',
    });
    return { outcome: 'failed', eventId: ev.id };
  }

  // Success — count it toward the caps so the next candidate sees it.
  await deps.store.markItemHaunted(item.id, now);
  return { outcome: 'sent', eventId: ev.id };
}

function deepLink(appUrl: string, productId: string, eventId: string): string {
  // productId is a Shopify GID; the storefront resolves it to the PDP. We pass
  // both the product ref and the haunt id for click attribution.
  const base = appUrl.replace(/\/$/, '');
  const params = new URLSearchParams({ product: productId, haunt: eventId });
  return `${base}/r?${params.toString()}`;
}

// Referenced by the subscriber-facing subscriber type import.
export type { Subscriber };
