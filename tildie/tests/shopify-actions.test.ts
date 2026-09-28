/**
 * What each webhook topic makes Tildie do.
 */

import { describe, expect, it } from "vitest";
import { productGid, webhookAction } from "@/shopify/actions.js";
import { SUBSCRIBED_TOPICS } from "@/shopify/webhook.js";

describe("webhookAction", () => {
  it("rescans a created or updated product", () => {
    const payload = { id: 632910392, admin_graphql_api_id: "gid://shopify/Product/632910392", updated_at: "2026-09-28T01:00:00Z" };
    expect(webhookAction("products/update", payload)).toEqual({
      kind: "rescan-product",
      gid: "gid://shopify/Product/632910392",
      updatedAt: "2026-09-28T01:00:00Z",
    });
    expect(webhookAction("products/create", payload).kind).toBe("rescan-product");
  });

  it("forgets a deleted product, whose payload carries only the numeric id", () => {
    expect(webhookAction("products/delete", { id: 632910392 })).toEqual({
      kind: "forget-product",
      gid: "gid://shopify/Product/632910392",
    });
  });

  it("does not act on a product payload it cannot read", () => {
    expect(webhookAction("products/update", { title: "x" }).kind).toBe("unreadable");
    expect(webhookAction("products/delete", null).kind).toBe("unreadable");
  });

  it("redacts the whole shop on shop/redact and acknowledges the customer topics", () => {
    expect(webhookAction("shop/redact", {})).toEqual({ kind: "redact-shop" });
    expect(webhookAction("customers/redact", {}).kind).toBe("acknowledge");
    expect(webhookAction("customers/data_request", {}).kind).toBe("acknowledge");
  });

  it("has an answer for every subscribed topic", () => {
    for (const topic of SUBSCRIBED_TOPICS) expect(webhookAction(topic, { id: 1 })).toBeDefined();
  });
});

describe("productGid", () => {
  it("prefers the gid, falls back to the id, and refuses anything else", () => {
    expect(productGid({ admin_graphql_api_id: "gid://shopify/Product/7", id: 8 })).toBe("gid://shopify/Product/7");
    expect(productGid({ id: "9" })).toBe("gid://shopify/Product/9");
    expect(productGid({ admin_graphql_api_id: "gid://shopify/Order/7" })).toBeNull();
    expect(productGid({ id: -1 })).toBeNull();
  });
});
