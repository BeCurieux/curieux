/**
 * Stage 3's storage, below the handlers: token sealing, and what the Supabase
 * store actually sends.
 */

import { describe, expect, it } from "vitest";
import { openToken, parseTokenKey, sealToken } from "@/server/crypto.js";
import { createSupabaseStore, SupabaseError } from "@/server/supabaseStore.js";
import { readConfig } from "@/server/config.js";
import { handleCronPrune } from "@/server/handlers.js";
import { createMemoryStore } from "@/server/store.js";
import type { Installation } from "@/server/store.js";
import { fakeSupabase } from "./fixtures/fakeSupabase.js";

const KEY = Buffer.alloc(32, 1);
const OLD = Buffer.alloc(32, 2);
const SHOP = "aurelia-skin.myshopify.com";

describe("token sealing", () => {
  it("round-trips, and never produces the same ciphertext twice", () => {
    const a = sealToken("shpat_abc", SHOP, { current: KEY });
    const b = sealToken("shpat_abc", SHOP, { current: KEY });
    expect(a).not.toBe(b);
    expect(a).not.toContain("shpat_abc");
    expect(openToken(a, SHOP, { current: KEY })).toBe("shpat_abc");
  });

  it("refuses to open under another shop, so a copied token fails rather than working for the wrong store", () => {
    const sealed = sealToken("shpat_abc", SHOP, { current: KEY });
    expect(() => openToken(sealed, "other.myshopify.com", { current: KEY })).toThrow();
  });

  it("refuses a tampered token and a wrong key", () => {
    const sealed = sealToken("shpat_abc", SHOP, { current: KEY });
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => openToken(tampered, SHOP, { current: KEY })).toThrow();
    expect(() => openToken(sealed, SHOP, { current: OLD })).toThrow();
  });

  it("opens under the previous key during a rotation", () => {
    const sealed = sealToken("shpat_abc", SHOP, { current: OLD });
    expect(openToken(sealed, SHOP, { current: KEY, previous: OLD })).toBe("shpat_abc");
  });

  it("insists on a 32-byte key and says how to make one", () => {
    expect(() => parseTokenKey(Buffer.alloc(16).toString("base64"))).toThrow(/openssl rand -base64 32/);
    expect(parseTokenKey(KEY.toString("base64"))).toHaveLength(32);
  });
});

describe("the Supabase store", () => {
  const installation: Installation = {
    shop: SHOP,
    state: "active",
    token: {
      accessToken: "shpat_plain_access",
      refreshToken: "shprt_plain_refresh",
      accessExpiresAt: new Date("2026-09-28T10:00:00Z"),
      refreshExpiresAt: new Date("2026-12-27T09:00:00Z"),
      scopes: ["read_products"],
    },
    markets: ["AU", "US"],
    lastKnownPlan: "growth",
    installedAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-09-28T09:00:00.000Z",
  };

  function setup() {
    const supabase = fakeSupabase("sb_secret_test");
    const store = createSupabaseStore({
      url: "https://project.supabase.co/",
      secretKey: "sb_secret_test",
      tokenKeys: { current: KEY },
      transport: supabase.transport,
    });
    return { supabase, store };
  }

  it("round-trips an installation", async () => {
    const { store } = setup();
    await store.putInstallation(installation);
    expect(await store.getInstallation(SHOP)).toEqual(installation);
  });

  it("never sends a plain token, and stores only sealed ones", async () => {
    const { supabase, store } = setup();
    await store.putInstallation(installation);
    await store.getInstallation(SHOP);
    for (const request of supabase.requests) {
      expect(request.body).not.toContain("shpat_plain_access");
      expect(request.body).not.toContain("shprt_plain_refresh");
    }
    const row = supabase.installations.get(SHOP);
    expect(String(row?.["access_token_enc"])).toMatch(/^v1\./);
  });

  it("authenticates with the secret key in apikey and sends no bearer token", async () => {
    const { supabase, store } = setup();
    await store.getInstallation(SHOP);
    const headers = supabase.requests[0]?.headers ?? {};
    expect(headers["apikey"]).toBe("sb_secret_test");
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  it("calls the function the migration defines, at the RPC path", async () => {
    const { supabase, store } = setup();
    await store.deliveries.claim("wh-1", new Date("2026-09-28T09:00:00Z"), SHOP);
    expect(supabase.requests[0]?.fn).toBe("franca_claim_delivery");
    expect(JSON.parse(supabase.requests[0]?.body ?? "{}")).toMatchObject({ p_shop: SHOP, p_abandoned_after: "300 seconds" });
  });

  it("surfaces a failed call as an error naming the function, not as missing data", async () => {
    const supabase = fakeSupabase("sb_secret_test");
    const store = createSupabaseStore({
      url: "https://project.supabase.co",
      secretKey: "wrong",
      tokenKeys: { current: KEY },
      transport: supabase.transport,
    });
    await expect(store.getInstallation(SHOP)).rejects.toBeInstanceOf(SupabaseError);
    await expect(store.getInstallation(SHOP)).rejects.toThrow(/franca_get_installation/);
  });

  it("deletes the shop's delivery records on redaction", async () => {
    const { supabase, store } = setup();
    await store.putInstallation(installation);
    await store.deliveries.claim("wh-1", new Date(), SHOP);
    await store.redactShop(SHOP);
    expect(supabase.deliveries.size).toBe(0);
    expect(await store.getInstallation(SHOP)).toBeNull();
  });
});

describe("storage configuration", () => {
  const base = { SHOPIFY_API_KEY: "a", SHOPIFY_API_SECRET: "b" };
  const storage = {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_x",
    FRANCA_TOKEN_KEY: KEY.toString("base64"),
  };

  it("uses Supabase when all three are set", () => {
    expect(readConfig({ ...base, ...storage }).storage?.url).toBe("https://project.supabase.co");
  });

  it("refuses a partial storage configuration rather than silently using memory", () => {
    expect(() => readConfig({ ...base, SUPABASE_URL: storage.SUPABASE_URL })).toThrow(/go together/);
  });

  it("refuses production without storage", () => {
    expect(() => readConfig({ ...base, NODE_ENV: "production" })).toThrow(/forgets every merchant/);
    expect(readConfig({ ...base, ...storage, NODE_ENV: "production" }).production).toBe(true);
  });
});

describe("the daily prune", () => {
  function deps(cronSecret: string | null, store = createMemoryStore()) {
    const config = readConfig({ SHOPIFY_API_KEY: "a", SHOPIFY_API_SECRET: "b" });
    return {
      config: { ...config, cronSecret },
      store,
      transport: async () => new Response(null, { status: 500 }),
      now: () => new Date("2026-10-10T04:17:00Z"),
    };
  }
  const call = (auth?: string) =>
    new Request("https://app.example/api/cron/prune", { headers: auth ? { authorization: auth } : {} });

  it("refuses everyone when no cron secret is configured", async () => {
    expect((await handleCronPrune(call("Bearer anything"), deps(null))).status).toBe(401);
  });

  it("refuses a wrong or missing secret", async () => {
    expect((await handleCronPrune(call("Bearer wrong"), deps("right"))).status).toBe(401);
    expect((await handleCronPrune(call(), deps("right"))).status).toBe(401);
  });

  it("deletes delivery records older than seven days, and only those", async () => {
    const supabase = fakeSupabase("sb_secret_test");
    const store = createSupabaseStore({
      url: "https://project.supabase.co",
      secretKey: "sb_secret_test",
      tokenKeys: { current: KEY },
      transport: supabase.transport,
    });
    await store.deliveries.claim("old", new Date("2026-10-01T00:00:00Z"), SHOP);
    await store.deliveries.claim("recent", new Date("2026-10-09T00:00:00Z"), SHOP);
    const response = await handleCronPrune(call("Bearer right"), deps("right", store));
    expect(await response.json()).toEqual({ pruned: 1 });
    expect([...supabase.deliveries.keys()]).toEqual(["recent"]);
  });
});
