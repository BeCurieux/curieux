/**
 * Recording the funnel.
 *
 * The one rule that shapes this file: a client may say what happened, never
 * where to file it. A browser sends a slug and a session id; the server resolves
 * the slug to the shop and to the version it is currently serving, and stamps
 * the time itself. Anything else and the events table is writable by anyone with
 * the URL.
 *
 * A rejected event is dropped silently as far as the shopper is concerned. The
 * endpoint always answers 204: a shop that broke because analytics were down
 * would be the tail wagging the dog, and there is nothing a shopper could do
 * about it anyway.
 */

import { createSupabaseStore, serviceRoleClient } from "@/lib/publish/supabase";
import { createLocalStore } from "@/lib/publish/local";
import { storeNameFromEnv } from "@/lib/publish/store";
import { createLocalEventStore, createSupabaseEventStore, type EventStore } from "./store";
import type { FunnelEventBody } from "./event";
import type { FunnelSummary } from "./types";
import type { ShopStore } from "@/lib/publish/store";

export interface RecordOptions {
  events?: EventStore;
  shops?: ShopStore;
}

export interface RecordOutcome {
  recorded: number;
  /** Why anything was dropped. For the CLI and the server log, never the client. */
  dropped: string[];
}

export async function recordEvents(bodies: FunnelEventBody[], options: RecordOptions = {}): Promise<RecordOutcome> {
  const shops = options.shops ?? defaultShopStore();
  const events = options.events ?? defaultEventStore();

  const dropped: string[] = [];
  const resolved: Parameters<EventStore["record"]>[0] = [];

  // One lookup per distinct slug, not per event: a batch is nearly always one
  // page's worth.
  const cache = new Map<string, { shopId: string; versionId: string } | null>();

  for (const body of bodies) {
    if (!cache.has(body.slug)) {
      const shop = await shops.findShopBySlug(body.slug).catch(() => null);
      cache.set(
        body.slug,
        shop?.currentVersionId ? { shopId: shop.id, versionId: shop.currentVersionId } : null,
      );
    }

    const target = cache.get(body.slug) ?? null;
    if (!target) {
      dropped.push(`no published shop at "${body.slug}"`);
      continue;
    }

    resolved.push({
      ...body,
      shopId: target.shopId,
      // The server's answer, not the client's. An event attributed to a version
      // the client named would make the numbers editable by whoever is reading.
      versionId: target.versionId,
    });
  }

  if (resolved.length > 0) await events.record(resolved);
  return { recorded: resolved.length, dropped };
}

export async function readFunnel(slug: string, options: RecordOptions = {}): Promise<FunnelSummary | null> {
  return (options.events ?? defaultEventStore()).summarise(slug);
}

export function defaultEventStore(): EventStore {
  // Same service role as publishing, from the one place that reads the secret.
  return storeNameFromEnv() === "supabase"
    ? createSupabaseEventStore(serviceRoleClient())
    : createLocalEventStore();
}

function defaultShopStore(): ShopStore {
  return storeNameFromEnv() === "supabase" ? createSupabaseStore() : createLocalStore();
}

export { createLocalEventStore, createSupabaseEventStore, summarise } from "./store";
export type { EventStore } from "./store";
export { FunnelEventBody, FunnelEventBatch, newSessionId } from "./event";
export { readSource, isTrafficSource } from "./source";
export type * from "./types";
