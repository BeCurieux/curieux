/**
 * Where funnel events go, and how they come back as an answer.
 *
 * Two adapters, same as publishing. The summary shape is the interesting part:
 * `record` is trivial and `summarise` is the whole reason the table exists — a
 * merchant does not want rows, they want to know whether this beat sending
 * everyone to their homepage.
 */

import { mkdir, appendFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelEvent, FunnelEventInput, FunnelSummary, TrafficSource } from "./types";

export interface EventStore {
  readonly name: string;
  record(events: (FunnelEventInput & { shopId: string })[]): Promise<void>;
  summarise(slug: string): Promise<FunnelSummary | null>;
}

/**
 * Append-only NDJSON.
 *
 * A line per event, appended rather than rewritten, because the failure that
 * matters for a local event log is a crash mid-write taking the whole file with
 * it. One bad line loses one event.
 */
export function createLocalEventStore(options: { dir?: string; now?: () => Date } = {}): EventStore {
  const dir = options.dir ?? path.join(process.cwd(), ".cache", "funnel");
  const file = path.join(dir, "events.ndjson");
  const now = options.now ?? (() => new Date());

  async function readAll(): Promise<FunnelEvent[]> {
    try {
      const raw = await readFile(file, "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as FunnelEvent];
          } catch {
            // A truncated last line from an interrupted write. Skipping it is
            // the correct read of an append-only log.
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  return {
    name: "local",

    async record(events): Promise<void> {
      await mkdir(dir, { recursive: true });
      const stamp = now().toISOString();
      const lines = events
        .map((event) => JSON.stringify({ ...event, id: randomUUID(), createdAt: stamp }))
        .join("\n");
      await appendFile(file, `${lines}\n`);
    },

    async summarise(slug: string): Promise<FunnelSummary | null> {
      const events = (await readAll()).filter((event) => event.slug === slug);
      if (events.length === 0) return null;
      return summarise(slug, events, new Map());
    },
  };
}

export function createSupabaseEventStore(client: SupabaseClient): EventStore {
  return {
    name: "supabase",

    async record(events): Promise<void> {
      const { error } = await client.from("shop_events").insert(
        events.map((event) => ({
          shop_id: event.shopId,
          version_id: event.versionId,
          session_id: event.sessionId,
          type: event.type,
          handle: event.handle ?? null,
          variant_id: event.variantId ?? null,
          source: event.source ?? null,
          campaign: event.campaign ?? null,
        })),
      );
      if (error) throw new Error(`Recording funnel events failed: ${error.message}`);
    },

    async summarise(slug: string): Promise<FunnelSummary | null> {
      const { data, error } = await client.rpc("shop_funnel", { want_slug: slug });
      if (error) throw new Error(`Reading the funnel failed: ${error.message}`);

      const rows = (Array.isArray(data) ? data : []) as Record<string, any>[];
      if (rows.length === 0) return null;

      const versions = new Map<string, number>(rows.map((r) => [r.version_id as string, r.version as number]));
      const events = rows.map(
        (r): FunnelEvent => ({
          id: r.id as string,
          shopId: r.shop_id as string,
          slug,
          versionId: r.version_id as string,
          sessionId: r.session_id as string,
          type: r.type,
          ...(r.handle ? { handle: r.handle as string } : {}),
          ...(r.variant_id ? { variantId: r.variant_id as string } : {}),
          ...(r.source ? { source: r.source as TrafficSource } : {}),
          ...(r.campaign ? { campaign: r.campaign as string } : {}),
          createdAt: r.created_at as string,
        }),
      );
      return summarise(slug, events, versions);
    },
  };
}

/**
 * Rows into the answer.
 *
 * Shared by both adapters on purpose: the arithmetic that decides whether a
 * merchant renews should not be able to differ between the database and the
 * file, and a rate computed two ways is a rate computed wrong once.
 */
export function summarise(
  slug: string,
  events: FunnelEvent[],
  versionNumbers: Map<string, number>,
): FunnelSummary {
  const of = (type: FunnelEvent["type"]) => events.filter((event) => event.type === type);

  const views = of("view");
  const clicks = of("product_click");
  const checkouts = of("checkout_start");
  const sessions = new Set(events.map((event) => event.sessionId));

  // Rates are per session, not per event. A shopper who taps four products has
  // converted once on the question the merchant is asking, and counting it four
  // times is how a funnel flatters itself.
  const viewSessions = new Set(views.map((event) => event.sessionId));
  const clickSessions = new Set(clicks.map((event) => event.sessionId));
  const checkoutSessions = new Set(checkouts.map((event) => event.sessionId));
  const denominator = viewSessions.size || sessions.size;

  const bySource = group(events, (event) => event.source ?? "direct").map(([source, rows]) => ({
    source: source as TrafficSource,
    sessions: new Set(rows.map((r) => r.sessionId)).size,
    checkoutStarts: rows.filter((r) => r.type === "checkout_start").length,
  }));

  const byProduct = group(
    events.filter((event) => event.handle && event.type !== "view"),
    (event) => event.handle!,
  )
    .map(([handle, rows]) => ({
      handle,
      clicks: rows.filter((r) => r.type === "product_click").length,
      checkoutStarts: rows.filter((r) => r.type === "checkout_start").length,
    }))
    .sort((a, b) => b.clicks + b.checkoutStarts - (a.clicks + a.checkoutStarts));

  const byVersion = group(events, (event) => event.versionId).map(([versionId, rows]) => ({
    versionId,
    version: versionNumbers.get(versionId) ?? 0,
    views: rows.filter((r) => r.type === "view").length,
    checkoutStarts: rows.filter((r) => r.type === "checkout_start").length,
  }));

  return {
    slug,
    views: views.length,
    productClicks: clicks.length,
    checkoutStarts: checkouts.length,
    sessions: sessions.size,
    clickRate: rate(clickSessions.size, denominator),
    checkoutRate: rate(checkoutSessions.size, denominator),
    bySource: bySource.sort((a, b) => b.sessions - a.sessions),
    byProduct,
    byVersion: byVersion.sort((a, b) => b.version - a.version),
  };
}

function group<T>(rows: T[], key: (row: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, [...(map.get(k) ?? []), row]);
  }
  return [...map.entries()];
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000;
}
