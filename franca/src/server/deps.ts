/**
 * The real dependencies, built once per server process.
 *
 * Storage is Supabase when it is configured and memory when it is not; the
 * configuration refuses memory in production (config.ts), because a
 * serverless deployment with memory storage looks like it works in a demo and
 * forgets every merchant between requests.
 */

import { readConfig } from "./config.js";
import { createMemoryStore } from "./store.js";
import { createSupabaseStore } from "./supabaseStore.js";
import type { Deps } from "./session.js";
import type { AdminTransport } from "../shopify/admin/client.js";

let cached: Deps | undefined;

export function getDeps(): Deps {
  if (cached) return cached;
  const config = readConfig();
  const transport: AdminTransport = (url, init) => fetch(url, init);
  cached = {
    config,
    store: config.storage ? createSupabaseStore({ ...config.storage, transport }) : createMemoryStore(),
    transport,
    now: () => new Date(),
  };
  return cached;
}
