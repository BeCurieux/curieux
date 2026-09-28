/**
 * The app's HTTP surface against a fake Shopify.
 *
 * The fake answers three hosts' worth of requests — the token endpoint, the
 * Admin API and the Partner API — from memory, and records what it was sent,
 * so the tests can check both what the app did and exactly what it asked
 * Shopify for. Nothing here touches a network.
 *
 * Every behaviour runs twice: once on the memory store and once on the
 * Supabase store talking to a fake of Supabase's RPC endpoint that keeps the
 * migration's rules. A difference between the two is a bug in one of them.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { readConfig } from "@/server/config.js";
import { EMPTY_SVG, handleBadge, handleMarkets, handleResults, handleScan, handleSession, handleWebhook } from "@/server/handlers.js";
import { signAppProxy } from "@/shopify/appProxy.js";
import { RETRY_HEADER, type Deps } from "@/server/session.js";
import { createMemoryStore, type AppStore } from "@/server/store.js";
import { createSupabaseStore } from "@/server/supabaseStore.js";
import { fakeSupabase } from "./fixtures/fakeSupabase.js";
import type { CatalogueView } from "@/server/view.js";
import { signBody } from "@/shopify/hmac.js";
import { signIdToken } from "@/shopify/idToken.js";

const SHOP = "aurelia-skin.myshopify.com";
const CLIENT_ID = "client-id-123";
const SECRET = "shpss_secret";
const START = new Date("2026-09-28T09:00:00Z");

type RawProduct = {
  id: string;
  legacyResourceId: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  status: string;
  onlineStoreUrl: string | null;
  updatedAt: string;
  seo: { title: string | null; description: string | null };
};

function product(n: number, description: string, updatedAt = "2026-09-28T08:00:00Z"): RawProduct {
  return {
    id: `gid://shopify/Product/${n}`,
    legacyResourceId: String(n),
    handle: `product-${n}`,
    title: `Product ${n}`,
    descriptionHtml: `<p>${description}</p>`,
    status: "ACTIVE",
    onlineStoreUrl: `https://aurelia.example/products/product-${n}`,
    updatedAt,
    seo: { title: null, description: null },
  };
}

const CLEAN = "A gentle cleanser for everyday use.";
const LOUD = "Clinically proven to clear acne in 7 days.";

class FakeShopify {
  products: RawProduct[] = [product(1, CLEAN), product(2, LOUD)];
  plan: string | null = "growth";
  partnerFails = false;
  adminFails = false;
  exchangeStatus = 200;
  tokenRequests: URLSearchParams[] = [];
  adminCalls = 0;
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
    if (url.startsWith("https://partners.shopify.com/")) {
      if (this.partnerFails) return new Response("busy", { status: 503 });
      return Response.json({
        data: { activeSubscription: this.plan ? { billingPeriod: "MONTHLY", items: [{ handle: this.plan }] } : null },
      });
    }
    if (url.startsWith(`https://${SHOP}/admin/api/`)) {
      this.adminCalls += 1;
      if (this.adminFails) return new Response("down", { status: 503 });
      const { query, variables } = JSON.parse(init.body) as { query: string; variables?: Record<string, unknown> };
      if (query.includes("TildieShopId")) return Response.json({ data: { shop: { id: "gid://shopify/Shop/1" } } });
      if (query.includes("TildieOneProduct")) {
        return Response.json({ data: { product: this.products.find((p) => p.id === variables?.["id"]) ?? null } });
      }
      const first = Number(variables?.["first"]);
      const start = variables?.["after"] ? Number(variables["after"]) : 0;
      const nodes = this.products.slice(start, start + first);
      const end = start + nodes.length;
      return Response.json({
        data: { products: { nodes, pageInfo: { hasNextPage: end < this.products.length, endCursor: String(end) } } },
      });
    }
    throw new Error(`unexpected request to ${url}`);
  };
}

const TOKEN_KEY = Buffer.alloc(32, 7);

const STORES: Array<[string, () => AppStore]> = [
  ["memory", () => createMemoryStore()],
  [
    "supabase",
    () => {
      const supabase = fakeSupabase("sb_secret_test");
      return createSupabaseStore({
        url: "https://project.supabase.co",
        secretKey: "sb_secret_test",
        tokenKeys: { current: TOKEN_KEY },
        transport: supabase.transport,
      });
    },
  ],
];

let shopify: FakeShopify;
let clock: Date;
let deps: Deps;
let makeStore: () => AppStore = STORES[0]![1];

beforeEach(() => {
  shopify = new FakeShopify();
  clock = START;
  deps = {
    config: readConfig({
      SHOPIFY_API_KEY: CLIENT_ID,
      SHOPIFY_API_SECRET: SECRET,
      SHOPIFY_PARTNER_ORG_ID: "1234",
      SHOPIFY_PARTNER_API_TOKEN: "prtapi_x",
      SHOPIFY_APP_GID: "gid://shopify/App/1",
    }),
    store: makeStore(),
    transport: shopify.transport,
    now: () => clock,
  };
});

function idToken(shop = SHOP): string {
  const now = Math.floor(clock.getTime() / 1000);
  return signIdToken(
    { iss: `https://${shop}/admin`, dest: `https://${shop}`, aud: CLIENT_ID, exp: now + 60, nbf: now - 1 },
    SECRET,
  );
}

function request(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const token = init.token === undefined ? idToken() : init.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://app.example${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

let deliveryCounter = 0;
function webhook(topic: string, payload: unknown, options: { secret?: string; id?: string } = {}): Request {
  const body = JSON.stringify(payload);
  deliveryCounter += 1;
  return new Request("https://app.example/api/shopify/webhooks", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-shopify-hmac-sha256": signBody(body, options.secret ?? SECRET),
      "x-shopify-webhook-id": options.id ?? `wh-${deliveryCounter}`,
      "x-shopify-event-id": `ev-${deliveryCounter}`,
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": SHOP,
      "x-shopify-api-version": "2026-07",
      "x-shopify-triggered-at": clock.toISOString(),
    },
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function installAndScan(markets = ["AU", "US"]): Promise<CatalogueView> {
  await handleSession(request("/api/shopify/session"), deps);
  await handleMarkets(request("/api/shopify/markets", { body: { markets } }), deps);
  return json<CatalogueView>(await handleScan(request("/api/shopify/scan"), deps));
}

describe.each(STORES)("on the %s store", (_name, factory) => {
  beforeEach(() => {
    makeStore = factory;
    deps.store = factory();
  });

  // ------------------------------------------------------------------ session

  describe("session", () => {
    it("refuses a request with no ID token, asking App Bridge to retry with a fresh one", async () => {
      const response = await handleSession(request("/api/shopify/session", { token: null }), deps);
      expect(response.status).toBe(401);
      expect(response.headers.get(RETRY_HEADER)).toBe("1");
    });

    it("refuses a token signed with another secret", async () => {
      const now = Math.floor(clock.getTime() / 1000);
      const forged = signIdToken(
        { iss: `https://${SHOP}/admin`, dest: `https://${SHOP}`, aud: CLIENT_ID, exp: now + 60, nbf: now - 1 },
        "not-the-secret",
      );
      expect((await handleSession(request("/api/shopify/session", { token: forged }), deps)).status).toBe(401);
    });

    it("exchanges the ID token for an expiring offline token on first contact, exactly as documented", async () => {
      const response = await handleSession(request("/api/shopify/session"), deps);
      expect(response.status).toBe(200);
      const form = shopify.tokenRequests[0];
      expect(Object.fromEntries(form ?? [])).toMatchObject({
        client_id: CLIENT_ID,
        client_secret: SECRET,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
        expiring: "1",
      });
      const installation = await deps.store.getInstallation(SHOP);
      expect(installation?.state).toBe("active");
      expect(installation?.token.refreshToken).toBe("shprt_1");
    });

    it("reuses the stored token and refreshes it when it nears expiry", async () => {
      await handleSession(request("/api/shopify/session"), deps);
      await handleSession(request("/api/shopify/session"), deps);
      expect(shopify.tokenRequests).toHaveLength(1);

      clock = new Date(START.getTime() + 58 * 60_000);
      await handleSession(request("/api/shopify/session"), deps);
      expect(shopify.tokenRequests).toHaveLength(2);
      expect(shopify.tokenRequests[1]?.get("grant_type")).toBe("refresh_token");
      expect(shopify.tokenRequests[1]?.get("refresh_token")).toBe("shprt_1");
      expect((await deps.store.getInstallation(SHOP))?.token.accessToken).toBe("shpat_2");
    });

    it("turns a rejected exchange into a retry, not a server error", async () => {
      shopify.exchangeStatus = 400;
      const response = await handleSession(request("/api/shopify/session"), deps);
      expect(response.status).toBe(401);
      expect(response.headers.get(RETRY_HEADER)).toBe("1");
    });

    it("reports the plan, the plan page and the markets on offer", async () => {
      const body = await json<Record<string, unknown>>(await handleSession(request("/api/shopify/session"), deps));
      expect(body).toMatchObject({
        shop: SHOP,
        access: "granted",
        plan: { handle: "growth", maxProducts: 250, maxMarkets: 3 },
        planUrl: "https://admin.shopify.com/store/aurelia-skin/charges/tildie/pricing_plans",
        markets: null,
        availableMarkets: ["AU", "US", "EU"],
        catalogue: null,
      });
    });

    it("sends a shop with no subscription to choose a plan", async () => {
      shopify.plan = null;
      const body = await json<{ access: string }>(await handleSession(request("/api/shopify/session"), deps));
      expect(body.access).toBe("choose-plan");
    });

    it("keeps a paying shop in when the Partner API fails, on the last plan it confirmed", async () => {
      await handleSession(request("/api/shopify/session"), deps);
      shopify.partnerFails = true;
      const body = await json<{ access: string; plan: { handle: string } }>(
        await handleSession(request("/api/shopify/session"), deps),
      );
      expect(body.access).toBe("granted");
      expect(body.plan.handle).toBe("growth");
    });

    it("says retry, not choose a plan, when the lookup fails and nothing was ever confirmed", async () => {
      shopify.partnerFails = true;
      const body = await json<{ access: string }>(await handleSession(request("/api/shopify/session"), deps));
      expect(body.access).toBe("retry");
    });
  });

  // ------------------------------------------------------------------ markets and scan

  describe("markets", () => {
    it("saves markets within the plan and refuses more than it covers", async () => {
      await handleSession(request("/api/shopify/session"), deps);
      const ok = await handleMarkets(request("/api/shopify/markets", { body: { markets: ["au", "EU"] } }), deps);
      expect(await json(ok)).toEqual({ markets: ["AU", "EU"] });

      shopify.plan = "starter";
      const over = await handleMarkets(request("/api/shopify/markets", { body: { markets: ["AU", "EU"] } }), deps);
      expect(over.status).toBe(422);
    });

    it("refuses a market with no rules (law 3)", async () => {
      await handleSession(request("/api/shopify/session"), deps);
      const response = await handleMarkets(request("/api/shopify/markets", { body: { markets: ["GB"] } }), deps);
      expect(response.status).toBe(422);
    });
  });

  describe("scan", () => {
    it("will not scan before markets are chosen", async () => {
      await handleSession(request("/api/shopify/session"), deps);
      expect((await handleScan(request("/api/shopify/scan"), deps)).status).toBe(409);
    });

    it("will not scan without a plan, and points at the plan page", async () => {
      shopify.plan = null;
      const response = await handleScan(request("/api/shopify/scan"), deps);
      expect(response.status).toBe(402);
      expect(await json(response)).toMatchObject({ error: "choose-plan" });
    });

    it("reads every product, scores each, leads with the weakest, and carries the disclaimer", async () => {
      const view = await installAndScan();
      expect(view.products.map((p) => p.handle)).toEqual(["product-2", "product-1"]);
      expect(view.summary.weakest?.handle).toBe("product-2");
      expect(view.products[0]?.badge).toBe(false);
      expect(view.products[1]?.badge).toBe(true);
      expect(view.products[0]?.top?.phrase.toLowerCase()).toContain("clinically proven");
      expect(view.disclaimer).toMatch(/not legal advice/);
      expect(view.markets).toEqual(["AU", "US"]);
    });

    it("stops at the plan's allowance and says so", async () => {
      shopify.plan = "starter";
      shopify.products = Array.from({ length: 60 }, (_, i) => product(i + 1, CLEAN));
      const view = await installAndScan(["AU"]);
      expect(view.summary.products).toBe(50);
      expect(view.truncated).toBe(true);
    });

    it("asks for markets again when a downgraded plan covers fewer than were chosen", async () => {
      await installAndScan(["AU", "US"]);
      shopify.plan = "starter";
      expect((await handleScan(request("/api/shopify/scan"), deps)).status).toBe(409);
    });

    it("answers 502 when Shopify cannot be read, and keeps the last scan", async () => {
      await installAndScan();
      shopify.adminFails = true;
      expect((await handleScan(request("/api/shopify/scan"), deps)).status).toBe(502);
      shopify.adminFails = false;
      const last = await json<CatalogueView>(await handleResults(request("/api/shopify/results", { method: "GET" }), deps));
      expect(last.summary.products).toBe(2);
    });
  });

  // ------------------------------------------------------------------ webhooks

  describe("webhooks", () => {
    it("answers a bad signature with 401, as the App Store compliance check requires", async () => {
      const response = await handleWebhook(webhook("customers/redact", {}, { secret: "wrong" }), deps);
      expect(response.status).toBe(401);
    });

    it("acknowledges the customer compliance topics", async () => {
      expect((await handleWebhook(webhook("customers/data_request", { shop_domain: SHOP }), deps)).status).toBe(200);
      expect((await handleWebhook(webhook("customers/redact", { shop_domain: SHOP }), deps)).status).toBe(200);
    });

    it("rescans a product when it changes, and its badge follows the new words", async () => {
      await installAndScan();
      shopify.products[1] = product(2, CLEAN, "2026-09-28T10:00:00Z");
      const response = await handleWebhook(
        webhook("products/update", { id: 2, admin_graphql_api_id: "gid://shopify/Product/2", updated_at: "2026-09-28T10:00:00Z" }),
        deps,
      );
      expect(response.status).toBe(200);
      const catalogue = await deps.store.getCatalogue(SHOP);
      const rescanned = catalogue?.products.find((p) => p.product.gid === "gid://shopify/Product/2");
      expect(rescanned?.badge).toBe(true);
      expect(catalogue?.summary.byBand.rework).toBe(0);
    });

    it("ignores an update older than the copy it already holds", async () => {
      await installAndScan();
      const calls = shopify.adminCalls;
      await handleWebhook(
        webhook("products/update", { id: 2, admin_graphql_api_id: "gid://shopify/Product/2", updated_at: "2026-09-28T07:00:00Z" }),
        deps,
      );
      expect(shopify.adminCalls).toBe(calls);
    });

    it("withdraws the badge when a changed product cannot be reread, and asks Shopify to retry", async () => {
      await installAndScan();
      shopify.adminFails = true;
      const response = await handleWebhook(
        webhook("products/update", { id: 1, admin_graphql_api_id: "gid://shopify/Product/1", updated_at: "2026-09-28T10:00:00Z" }),
        deps,
      );
      expect(response.status).toBe(500);
      const held = (await deps.store.getCatalogue(SHOP))?.products.find((p) => p.product.gid === "gid://shopify/Product/1");
      expect(held?.badge).toBe(false);
      expect(held?.stale).toBe(true);
    });

    it("lets Shopify's retry of a failed delivery through, and ignores a duplicate of a done one", async () => {
      await installAndScan();
      shopify.adminFails = true;
      const payload = { id: 1, admin_graphql_api_id: "gid://shopify/Product/1", updated_at: "2026-09-28T10:00:00Z" };
      expect((await handleWebhook(webhook("products/update", payload, { id: "same" }), deps)).status).toBe(500);
      shopify.adminFails = false;
      shopify.products[0] = product(1, CLEAN, "2026-09-28T10:00:00Z");
      expect((await handleWebhook(webhook("products/update", payload, { id: "same" }), deps)).status).toBe(200);
      const held = (await deps.store.getCatalogue(SHOP))?.products.find((p) => p.product.gid === "gid://shopify/Product/1");
      expect(held?.badge).toBe(true);
      expect(held?.stale).toBeUndefined();

      const calls = shopify.adminCalls;
      expect((await handleWebhook(webhook("products/update", payload, { id: "same" }), deps)).status).toBe(200);
      expect(shopify.adminCalls).toBe(calls);
    });

    it("drops a deleted product", async () => {
      await installAndScan();
      await handleWebhook(webhook("products/delete", { id: 2 }), deps);
      expect((await deps.store.getCatalogue(SHOP))?.summary.products).toBe(1);
    });

    it("marks the shop uninstalled, and deletes everything on shop/redact", async () => {
      await installAndScan();
      await handleWebhook(webhook("app/uninstalled", { id: 1 }), deps);
      expect((await deps.store.getInstallation(SHOP))?.state).toBe("uninstalled");

      await handleWebhook(webhook("shop/redact", { shop_domain: SHOP }), deps);
      expect(await deps.store.getInstallation(SHOP)).toBeNull();
      expect(await deps.store.getCatalogue(SHOP)).toBeNull();
    });

    it("does not rescan for an uninstalled shop", async () => {
      await installAndScan();
      await handleWebhook(webhook("app/uninstalled", { id: 1 }), deps);
      const calls = shopify.adminCalls;
      await handleWebhook(
        webhook("products/update", { id: 1, admin_graphql_api_id: "gid://shopify/Product/1", updated_at: "2026-09-28T11:00:00Z" }),
        deps,
      );
      expect(shopify.adminCalls).toBe(calls);
    });
  });

  describe("the badge on the storefront", () => {
    function proxied(product: string, extra: Record<string, string> = {}, secret = SECRET): Request {
      const params = new URLSearchParams({
        product,
        ...extra,
        shop: SHOP,
        logged_in_customer_id: "",
        path_prefix: "/apps/tildie",
        timestamp: String(Math.floor(clock.getTime() / 1000)),
      });
      params.set("signature", signAppProxy(params, secret));
      return new Request(`https://app.example/api/proxy/badge?${params}`);
    }

    it("refuses a request that did not come through Shopify's proxy", async () => {
      expect((await handleBadge(proxied("1", {}, "not-the-secret"), deps)).status).toBe(401);
      expect((await handleBadge(new Request("https://app.example/api/proxy/badge?product=1&shop=" + SHOP), deps)).status).toBe(401);
    });

    it("serves the mark for a product that earned it, safely", async () => {
      await installAndScan();
      const response = await handleBadge(proxied("1"), deps);
      expect(response.headers.get("content-type")).toContain("image/svg+xml");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
      const svg = await response.text();
      expect(svg).toContain("Claims Verified");
      expect(svg).not.toContain("<script");
      expect(svg).not.toMatch(/Lapsed/);
    });

    it("serves nothing for a product the rules flag, an unknown product or a bad id", async () => {
      await installAndScan();
      expect(await (await handleBadge(proxied("2"), deps)).text()).toBe(EMPTY_SVG);
      expect(await (await handleBadge(proxied("999"), deps)).text()).toBe(EMPTY_SVG);
      expect(await (await handleBadge(proxied("1 OR 1=1"), deps)).text()).toBe(EMPTY_SVG);
    });

    it("withdraws the mark the moment the copy changes and cannot be reread", async () => {
      await installAndScan();
      shopify.adminFails = true;
      await handleWebhook(
        webhook("products/update", { id: 1, admin_graphql_api_id: "gid://shopify/Product/1", updated_at: "2026-09-28T10:00:00Z" }),
        deps,
      );
      expect(await (await handleBadge(proxied("1"), deps)).text()).toBe(EMPTY_SVG);
    });

    it("greys the mark to Lapsed when the shop has no plan, rather than keeping it live", async () => {
      await installAndScan();
      shopify.plan = null;
      await handleSession(request("/api/shopify/session"), deps);
      const svg = await (await handleBadge(proxied("1"), deps)).text();
      expect(svg).toContain("Lapsed");
    });

    it("serves nothing once the app is uninstalled", async () => {
      await installAndScan();
      await handleWebhook(webhook("app/uninstalled", { id: 1 }), deps);
      expect(await (await handleBadge(proxied("1"), deps)).text()).toBe(EMPTY_SVG);
    });

    it("dates the mark from the product's own last reading", async () => {
      await installAndScan();
      clock = new Date("2026-11-15T09:00:00Z");
      shopify.products[0] = product(1, "A gentle cleanser for daily use.", "2026-11-15T08:00:00Z");
      await handleWebhook(
        webhook("products/update", { id: 1, admin_graphql_api_id: "gid://shopify/Product/1", updated_at: "2026-11-15T08:00:00Z" }),
        deps,
      );
      expect(await (await handleBadge(proxied("1"), deps)).text()).toContain("November 2026");
    });
  });
});

describe("configuration", () => {
  it("refuses to start without the client secret, and names what is missing", () => {
    expect(() => readConfig({ SHOPIFY_API_KEY: CLIENT_ID })).toThrow(/SHOPIFY_API_SECRET/);
  });

  it("refuses the development plan override in production", () => {
    expect(() =>
      readConfig({ SHOPIFY_API_KEY: "a", SHOPIFY_API_SECRET: "b", TILDIE_DEV_PLAN: "studio", NODE_ENV: "production" }),
    ).toThrow(/free plan/);
  });
});
