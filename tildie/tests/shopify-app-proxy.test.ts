/**
 * App proxy signatures, against Shopify's own worked examples.
 *
 * Both vectors are from "Authenticate app proxies" on shopify.dev: secret
 * "hush", the same query with and without a logged-in customer. The docs index
 * this was read through showed the shop as a placeholder; the signatures
 * reproduce exactly with `shop-name.myshopify.com`, which is therefore what the
 * page uses.
 */

import { describe, expect, it } from "vitest";
import { appProxyMessage, signAppProxy, verifyAppProxy } from "@/shopify/appProxy.js";

const SECRET = "hush";
const ANONYMOUS =
  "extra=1&extra=2&shop=shop-name.myshopify.com&logged_in_customer_id=&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=e072b6d7e6622d85912a5214b860d3100dc1e73d9bc29f43796ac8c9ff8093cb";
const LOGGED_IN =
  "extra=1&extra=2&shop=shop-name.myshopify.com&logged_in_customer_id=1&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=4c68c8624d737112c91818c11017d24d334b524cb5c2b8ba08daa056f7395ddb";

describe("app proxy signatures", () => {
  it("builds the message exactly as Shopify's example shows it", () => {
    expect(appProxyMessage(new URLSearchParams(ANONYMOUS))).toBe(
      "extra=1,2logged_in_customer_id=path_prefix=/apps/awesome_reviewsshop=shop-name.myshopify.comtimestamp=1317327555",
    );
  });

  it("verifies both of Shopify's worked examples", () => {
    expect(verifyAppProxy(new URLSearchParams(ANONYMOUS), SECRET)).toMatchObject({ ok: true, shop: "shop-name.myshopify.com" });
    expect(verifyAppProxy(new URLSearchParams(LOGGED_IN), SECRET).ok).toBe(true);
  });

  it("accepts the previous secret during a rotation", () => {
    expect(verifyAppProxy(new URLSearchParams(ANONYMOUS), ["new-secret", SECRET]).ok).toBe(true);
  });

  it("rejects a tampered parameter, a wrong secret and a missing signature", () => {
    const tampered = new URLSearchParams(ANONYMOUS);
    tampered.set("extra", "3");
    expect(verifyAppProxy(tampered, SECRET)).toEqual({ ok: false, reason: "signature" });
    expect(verifyAppProxy(new URLSearchParams(ANONYMOUS), "wrong")).toEqual({ ok: false, reason: "signature" });
    const unsigned = new URLSearchParams(ANONYMOUS);
    unsigned.delete("signature");
    expect(verifyAppProxy(unsigned, SECRET)).toEqual({ ok: false, reason: "unsigned" });
  });

  it("refuses an empty secret list rather than accepting everything", () => {
    expect(verifyAppProxy(new URLSearchParams(ANONYMOUS), []).ok).toBe(false);
  });

  it("refuses a correctly signed request whose shop is not a myshopify domain", () => {
    const params = new URLSearchParams({ shop: "evil.example.com", timestamp: "1" });
    params.set("signature", signAppProxy(params, SECRET));
    expect(verifyAppProxy(params, SECRET)).toEqual({ ok: false, reason: "not-a-shop" });
  });
});
