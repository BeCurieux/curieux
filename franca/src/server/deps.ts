/**
 * The real dependencies, built once per server process.
 *
 * Production is refused until stage 3: with the memory store, every
 * serverless invocation would start with no installations and no scans, and
 * the app would look like it worked in a demo and forget every merchant.
 */

import { readConfig } from "./config.js";
import { createMemoryStore } from "./store.js";
import type { Deps } from "./session.js";

let cached: Deps | undefined;

export function getDeps(): Deps {
  if (cached) return cached;
  const config = readConfig();
  if (config.production) {
    throw new Error("Stage 3 (storage) is not built; Franca's Shopify app must not run in production yet. See SHOPIFY-APP.md.");
  }
  cached = {
    config,
    store: createMemoryStore(),
    transport: (url, init) => fetch(url, init),
    now: () => new Date(),
  };
  return cached;
}
