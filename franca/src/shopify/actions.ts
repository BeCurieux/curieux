/**
 * What a verified webhook delivery makes Franca do. A pure decision; the route
 * that carries it out is the only part that touches storage.
 *
 * Signature, headers and duplicate suppression happen before this runs
 * (hmac.ts, webhook.ts, idempotency.ts). By the time a delivery gets here it
 * is genuine, new, and for a topic we subscribed to.
 *
 * The three compliance topics are answered even though Franca holds no
 * customer data — the app reads products and nothing else — because Shopify
 * rejects an App Store submission that does not respond to them
 * (https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).
 * `shop/redact` is the one with work in it: every scan and score for the shop
 * is deleted.
 */

import type { SubscribedTopic } from "./webhook.js";

export type WebhookAction =
  /** Read the product again and rescan it. Its badge follows the new score. */
  | { kind: "rescan-product"; gid: string; updatedAt: string | null }
  /** The product is gone: drop its scan, which withdraws its badge. */
  | { kind: "forget-product"; gid: string }
  /**
   * Stop serving the shop's badges now; keep its scans until `shop/redact`.
   * A badge is live-linked (§5) and an uninstalled app is a cancelled one.
   */
  | { kind: "uninstall" }
  /** Re-read the granted scopes before the next Admin API call. */
  | { kind: "refresh-scopes" }
  /** Delete everything held for the shop. */
  | { kind: "redact-shop" }
  /** Nothing is held about customers, so there is nothing to return or delete. */
  | { kind: "acknowledge"; note: string }
  /** The payload did not say which product; acknowledged, logged, not acted on. */
  | { kind: "unreadable"; note: string };

export function webhookAction(topic: SubscribedTopic, payload: unknown): WebhookAction {
  switch (topic) {
    case "products/create":
    case "products/update": {
      const gid = productGid(payload);
      if (!gid) return { kind: "unreadable", note: `${topic} without a product id` };
      return { kind: "rescan-product", gid, updatedAt: stringField(payload, "updated_at") };
    }
    case "products/delete": {
      const gid = productGid(payload);
      if (!gid) return { kind: "unreadable", note: `${topic} without a product id` };
      return { kind: "forget-product", gid };
    }
    case "app/uninstalled":
      return { kind: "uninstall" };
    case "app/scopes_update":
      return { kind: "refresh-scopes" };
    case "shop/redact":
      return { kind: "redact-shop" };
    case "customers/data_request":
    case "customers/redact":
      return { kind: "acknowledge", note: "Franca reads products only and holds no customer data." };
  }
}

/**
 * The product's gid from a REST-shaped webhook payload.
 *
 * `admin_graphql_api_id` when present; built from the numeric `id` otherwise,
 * which is what a `products/delete` payload carries.
 */
export function productGid(payload: unknown): string | null {
  const given = stringField(payload, "admin_graphql_api_id");
  if (given?.startsWith("gid://shopify/Product/")) return given;
  const id = isObject(payload) ? payload["id"] : undefined;
  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) return `gid://shopify/Product/${id}`;
  if (typeof id === "string" && /^\d+$/.test(id)) return `gid://shopify/Product/${id}`;
  return null;
}

function stringField(payload: unknown, key: string): string | null {
  if (!isObject(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
