/**
 * The real dependencies, built once per server process. Supabase when it is
 * configured, memory when it is not; config.ts refuses memory in production.
 */

import type { AdminTransport } from "../shopify/admin/client.js";
import { readConfig } from "./config.js";
import type { Deps } from "./session.js";
import { createMemoryStore } from "./store.js";
import { createSupabaseStore } from "./supabaseStore.js";

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
