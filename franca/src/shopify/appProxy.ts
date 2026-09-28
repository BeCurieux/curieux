/**
 * Requests Shopify forwards from a merchant's storefront through the app
 * proxy (`/apps/franca/...` on the shop's own domain), verified.
 *
 * The algorithm is Shopify's, from "Authenticate app proxies"
 * (https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies):
 * drop `signature`, render every other parameter as `key=value` with repeated
 * values joined by commas, sort, concatenate with no separator, HMAC-SHA256
 * under the client secret, hex. The tests reproduce both of that page's worked
 * examples byte for byte, which is the only evidence available here that this
 * matches what Shopify sends.
 *
 * Not the webhook scheme: different parameter, hex rather than base64, and
 * the message is the query rather than the body.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { ShopDomain } from "./webhook.js";

export type AppProxyResult =
  | { ok: true; shop: string; params: URLSearchParams }
  | { ok: false; reason: "unsigned" | "signature" | "not-a-shop" };

export function appProxyMessage(params: URLSearchParams): string {
  const keys = [...new Set([...params.keys()])].filter((key) => key !== "signature");
  return keys
    .map((key) => `${key}=${params.getAll(key).join(",")}`)
    .sort()
    .join("");
}

export function signAppProxy(params: URLSearchParams, secret: string): string {
  return createHmac("sha256", secret).update(appProxyMessage(params)).digest("hex");
}

export function verifyAppProxy(params: URLSearchParams, secrets: string | readonly string[]): AppProxyResult {
  const signature = params.get("signature");
  if (!signature) return { ok: false, reason: "unsigned" };

  const presented = Buffer.from(signature, "utf8");
  let matched = false;
  for (const secret of (typeof secrets === "string" ? [secrets] : secrets).filter((s) => s.length > 0)) {
    const expected = Buffer.from(signAppProxy(params, secret), "utf8");
    // No early exit, as in hmac.ts: the time taken does not say which secret matched.
    if (expected.length === presented.length && timingSafeEqual(expected, presented)) matched = true;
  }
  if (!matched) return { ok: false, reason: "signature" };

  const shop = params.get("shop") ?? "";
  if (!ShopDomain.safeParse(shop).success) return { ok: false, reason: "not-a-shop" };
  return { ok: true, shop, params };
}
