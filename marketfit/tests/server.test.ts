/**
 * The app's HTTP surface against a fake Shopify: the token endpoint and the
 * Admin API answered from memory, every request recorded. No network.
 */

import { describe, expect, it } from "vitest";
import { readConfig } from "@/server/config.js";
import { handleSession, handleSync, handleWebhook } from "@/server/handlers.js";
import { RETRY_HEADER, accessTokenFor, type Deps } from "@/server/session.js";
import { createMemoryStore } from "@/server/store.js";
import type { ShopifyProduct } from "@/shopify/admin/products.js";
import { signBody } from "@/shopify/hmac.js";
import { signIdToken } from "@/shopify/idToken.js";

const SHOP = "vita-north.myshopify.com";
const CLIENT_ID = "client-id-123";
const SECRET = "shpss_secret";
const START = new Date("2026-10-08T09:00:00Z");

function node(n: number, overrides: Partial<ShopifyProduct> = {}) {
  return {
    id: `gid://shopify/Product/${n}`,
    title: `Product ${n}`,
    handle: `product-${n}`,
    status: "ACTIVE",
    productType: "",
    vendor: "Vita North",
    tags: [] as string[],
    description: "",
    updatedAt: "2026-10-08T08:00:00Z",
    variants: { nodes: [{ id: `gid://shopify/ProductVariant/${n}`, sku: `SKU-${n}`, title: "Default", barcode: null }] },
    ...overrides,
  };
}

class FakeShopify {
  products = [
    node(1, { title: "Magnesium Glycinate Capsules", productType: "Supplements" }),
    node(2, { title: "Vitamin C Brightening Serum", productType: "Skincare" }),
    node(3, { title: "Daily Multivitamin" }),
  ];
  exchangeStatus = 200;
  adminFails = false;
  tokenRequests: URLSearchParams[] = [];
  pageSizes: number[] = [];
  private issued = 0;

  transport = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    if (url === `https://${SHOP}/admin/oauth/access_token`) {
      const form = new URLSearchParams(init.body);
      this.tokenRequests.push(form);
      if (this.exchangeStatus !== 200) return new Response("{}", { status: this.exchangeStatus });
      this.issued += 1;
      return Response.json({
        access_token: `shpat_${this.issued}`,
        expires_in: 3600,
        refresh_token: `shprt_${this.issued}`,
        refresh_token_expires_in: 7776000,
        scope: "read_products",
      });
    }
    if (url.startsWith(`https://${SHOP}/admin/api/`)) {
      if (this.adminFails) return new Response("down", { status: 503 });
      const { variables } = JSON.parse(init.body) as { variables: { first: number; after: string | null } };
      this.pageSizes.push(variables.first);
      const start = variables.after ? Number(variables.after) : 0;
      const nodes = this.products.slice(start, start + variables.first);
      const end = start + nodes.length;
      return Response.json({
        data: { products: { nodes, pageInfo: { hasNextPage: end < this.products.length, endCursor: String(end) } } },
      });
    }
    throw new Error(`unexpected request to ${url}`);
  };
}

function setup() {
  const shopify = new FakeShopify();
  let now = START;
  const deps: Deps = {
    config: readConfig({ SHOPIFY_API_KEY: CLIENT_ID, SHOPIFY_API_SECRET: SECRET }),
    store: createMemoryStore(() => now),
    transport: shopify.transport,
    now: () => now,
  };
  return { shopify, deps, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

function idToken(at = START, shop = SHOP): string {
  const t = Math.floor(at.getTime() / 1000);
  return signIdToken(
    { iss: `https://${shop}/admin`, dest: `https://${shop}`, aud: CLIENT_ID, exp: t + 60, nbf: t - 5, iat: t, sub: "1" },
    SECRET,
  );
}

function appRequest(path: string, token: string | null = idToken()): Request {
  return new Request(`https://app.example${path}`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function webhook(topic: string, payload: unknown, id = `wh-${Math.random()}`, secret = SECRET): Request {
  const body = JSON.stringify(payload);
  return new Request("https://app.example/api/shopify/webhooks", {
    method: "POST",
    headers: {
      "x-shopify-hmac-sha256": signBody(body, secret),
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": SHOP,
      "x-shopify-webhook-id": id,
      "x-shopify-api-version": "2026-07",
    },
    body,
  });
}

describe("session", () => {
  it("refuses a request without a valid ID token, with the retry header", async () => {
    const { deps } = setup();
    for (const token of [null, "garbage", signIdToken({ iss: `https://${SHOP}/admin`, dest: `https://${SHOP}`, aud: CLIENT_ID, exp: 0, nbf: 0 }, SECRET)]) {
      const response = await handleSession(appRequest("/api/shopify/session", token), deps);
      expect(response.status).toBe(401);
      expect(response.headers.get(RETRY_HEADER)).toBe("1");
    }
  });

  it("installs on first contact by exchanging the ID token for an expiring offline token", async () => {
    const { shopify, deps } = setup();
    const response = await handleSession(appRequest("/api/shopify/session"), deps);
    expect(response.status).toBe(200);
    const form = shopify.tokenRequests[0]!;
    expect(Object.fromEntries(form)).toMatchObject({
      client_id: CLIENT_ID,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: "1",
    });
    const merchant = await deps.store.getMerchant(SHOP);
    expect(merchant).toMatchObject({ state: "active", token: { accessToken: "shpat_1" } });
    const body = (await response.json()) as { shop: string; disclaimer: string };
    expect(body.shop).toBe(SHOP);
    expect(body.disclaimer).toMatch(/not legal advice/);
    expect(body.disclaimer.toLowerCase()).not.toMatch(/\bcompliant\b/);
  });

  it("reuses a live token, and refreshes one near expiry", async () => {
    const { shopify, deps, advance } = setup();
    await handleSession(appRequest("/api/shopify/session"), deps);
    await handleSession(appRequest("/api/shopify/session"), deps);
    expect(shopify.tokenRequests).toHaveLength(1);
    const later = advance(58 * 60_000);
    await handleSession(appRequest("/api/shopify/session", idToken(later)), deps);
    expect(shopify.tokenRequests[1]?.get("grant_type")).toBe("refresh_token");
    expect((await deps.store.getMerchant(SHOP))?.token?.accessToken).toBe("shpat_2");
  });

  it("asks App Bridge for a fresh ID token when Shopify rejects the exchange", async () => {
    const { shopify, deps } = setup();
    shopify.exchangeStatus = 400;
    const response = await handleSession(appRequest("/api/shopify/session"), deps);
    expect(response.status).toBe(401);
    expect(response.headers.get(RETRY_HEADER)).toBe("1");
    shopify.exchangeStatus = 500;
    expect((await handleSession(appRequest("/api/shopify/session"), deps)).status).toBe(502);
  });

  it("background work cannot re-acquire a dead installation", async () => {
    const { deps, advance } = setup();
    await handleSession(appRequest("/api/shopify/session"), deps);
    advance(91 * 24 * 60 * 60_000);
    const merchant = (await deps.store.getMerchant(SHOP))!;
    expect(await accessTokenFor(merchant, deps)).toBeNull();
    expect((await deps.store.getMerchant(SHOP))?.state).toBe("needs_reauth");
  });
});

describe("sync", () => {
  it("reads every page, stores every product and detects supplements", async () => {
    const { shopify, deps } = setup();
    shopify.products.push(...Array.from({ length: 150 }, (_, i) => node(100 + i, { title: `Gift card ${i}` })));
    const response = await handleSync(appRequest("/api/shopify/sync"), deps);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      written: number;
      truncated: boolean;
      catalogue: { total: number; supplements: number; products: { title: string; category: string | null; categoryReason: string }[] };
    };
    expect(shopify.pageSizes).toEqual([100, 100]);
    expect(body).toMatchObject({ written: 153, truncated: false, catalogue: { total: 153, supplements: 2 } });
    const serum = body.catalogue.products.find((p) => p.title.includes("Serum"));
    expect(serum).toMatchObject({ category: null, categoryReason: 'title says "serum"' });
  });

  it("removes products that are gone from the shop on the next full sync", async () => {
    const { shopify, deps } = setup();
    await handleSync(appRequest("/api/shopify/sync"), deps);
    shopify.products = shopify.products.slice(1);
    const body = (await (await handleSync(appRequest("/api/shopify/sync"), deps)).json()) as { removed: number };
    expect(body.removed).toBe(1);
  });

  it("says so when Shopify is unavailable", async () => {
    const { shopify, deps } = setup();
    await handleSession(appRequest("/api/shopify/session"), deps);
    shopify.adminFails = true;
    const response = await handleSync(appRequest("/api/shopify/sync"), deps);
    expect(response.status).toBe(502);
  });
});

describe("webhooks", () => {
  async function installed() {
    const ctx = setup();
    await handleSync(appRequest("/api/shopify/sync"), ctx.deps);
    const merchant = (await ctx.deps.store.getMerchant(SHOP))!;
    return { ...ctx, merchant, list: () => ctx.deps.store.listProducts(merchant.id) };
  }

  it("refuses a bad signature with 401 and a malformed envelope with 400", async () => {
    const { deps } = setup();
    expect((await handleWebhook(webhook("products/update", {}, "w", "wrong-secret"), deps)).status).toBe(401);
    const body = "{}";
    const noTopic = new Request("https://app.example/", { method: "POST", headers: { "x-shopify-hmac-sha256": signBody(body, SECRET) }, body });
    expect((await handleWebhook(noTopic, deps)).status).toBe(400);
  });

  it("products/update replaces the product, and a late older payload does not undo it", async () => {
    const { deps, list } = await installed();
    const payload = (title: string, updated: string) => ({
      id: 1,
      admin_graphql_api_id: "gid://shopify/Product/1",
      title,
      product_type: "",
      tags: "supplements, sleep",
      body_html: "<p>Take two</p>",
      updated_at: updated,
      variants: [],
    });
    expect((await handleWebhook(webhook("products/update", payload("Magnesium Sleep", "2026-10-08T10:00:00Z")), deps)).status).toBe(200);
    expect((await handleWebhook(webhook("products/update", payload("Old title", "2026-10-08T09:30:00Z")), deps)).status).toBe(200);
    const product = (await list()).find((p) => p.shopifyProductId === "gid://shopify/Product/1");
    expect(product).toMatchObject({ title: "Magnesium Sleep", category: "supplements", categoryReason: 'tag says "supplements"' });
  });

  it("a retried delivery is acted on once", async () => {
    const { deps, list } = await installed();
    const create = { id: 9, title: "Iron Tablets", product_type: "Vitamins & Supplements", updated_at: "2026-10-08T10:00:00Z" };
    await handleWebhook(webhook("products/create", create, "same-id"), deps);
    await deps.store.removeProduct((await deps.store.getMerchant(SHOP))!.id, "gid://shopify/Product/9");
    await handleWebhook(webhook("products/create", create, "same-id"), deps);
    expect((await list()).some((p) => p.title === "Iron Tablets")).toBe(false);
  });

  it("products/delete removes the product", async () => {
    const { deps, list } = await installed();
    await handleWebhook(webhook("products/delete", { id: 2 }), deps);
    expect((await list()).map((p) => p.shopifyProductId)).not.toContain("gid://shopify/Product/2");
  });

  it("app/uninstalled drops the token; shop/redact removes everything", async () => {
    const { deps, list } = await installed();
    await handleWebhook(webhook("app/uninstalled", { id: 1 }), deps);
    expect(await deps.store.getMerchant(SHOP)).toMatchObject({ state: "uninstalled", token: null });
    expect((await list()).length).toBe(3);
    // A product webhook after uninstall is not acted on.
    await handleWebhook(webhook("products/create", { id: 77, title: "Zinc Capsules", updated_at: "2026-10-09T00:00:00Z" }), deps);
    expect((await list()).length).toBe(3);
    await handleWebhook(webhook("shop/redact", { shop_domain: SHOP }), deps);
    expect(await deps.store.getMerchant(SHOP)).toBeNull();
  });

  it("acknowledges the customer compliance topics and unknown topics", async () => {
    const { deps } = setup();
    for (const topic of ["customers/data_request", "customers/redact", "app/scopes_update", "orders/create"]) {
      expect((await handleWebhook(webhook(topic, { shop_domain: SHOP }), deps)).status).toBe(200);
    }
  });

  it("answers 500 so Shopify retries when the work fails, and the retry is not suppressed", async () => {
    const { deps } = await installed();
    const putProducts = deps.store.putProducts;
    deps.store.putProducts = async () => {
      throw new Error("database down");
    };
    const payload = { id: 5, title: "Zinc Capsules", updated_at: "2026-10-09T00:00:00Z" };
    expect((await handleWebhook(webhook("products/create", payload, "retry-me"), deps)).status).toBe(500);
    deps.store.putProducts = putProducts;
    expect((await handleWebhook(webhook("products/create", payload, "retry-me"), deps)).status).toBe(200);
  });
});

describe("config", () => {
  it("requires the client ID and secret", () => {
    expect(() => readConfig({})).toThrow(/SHOPIFY_API_KEY/);
  });

  it("refuses partial storage configuration, and memory in production", () => {
    const base = { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s" };
    expect(() => readConfig({ ...base, SUPABASE_URL: "https://x.supabase.co" })).toThrow(/go together/);
    expect(() => readConfig({ ...base, NODE_ENV: "production" })).toThrow(/memory storage/);
    const key = Buffer.alloc(32, 1).toString("base64");
    const config = readConfig({
      ...base,
      SHOPIFY_API_SECRET_PREVIOUS: "old",
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret",
      MARKETFIT_TOKEN_KEY: key,
      MARKETFIT_TOKEN_KEY_PREVIOUS: key,
      NODE_ENV: "production",
    });
    expect(config.secrets).toEqual(["s", "old"]);
    expect(config.storage?.tokenKeys.previous).toBeDefined();
  });
});
