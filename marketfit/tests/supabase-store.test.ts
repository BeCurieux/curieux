/**
 * What the Supabase store sends. The SQL functions it calls are tested against
 * a real Postgres by `pnpm db:check`; this checks the other half of the wire,
 * and that no request ever carries a usable Shopify token.
 */

import { describe, expect, it } from "vitest";
import { createSupabaseStore } from "@/server/supabaseStore.js";

const KEY = Buffer.alloc(32, 9);

function fake() {
  const calls: { fn: string; args: Record<string, unknown>; headers: Record<string, string> }[] = [];
  let merchant: Record<string, unknown> | null = null;
  const transport = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    const fn = url.split("/rpc/")[1]!;
    const args = JSON.parse(init.body) as Record<string, unknown>;
    calls.push({ fn, args, headers: init.headers });
    switch (fn) {
      case "marketfit_put_merchant": {
        const p = args["p"] as Record<string, unknown>;
        merchant = { id: "m-1", ...p, uninstalled_at: p["uninstalled_at"] ?? null };
        return Response.json(merchant);
      }
      case "marketfit_get_merchant":
        return Response.json(merchant);
      case "marketfit_claim_delivery":
        return Response.json("in-flight");
      case "marketfit_list_products":
        return Response.json([{ id: "p1", shopify_product_id: "gid://shopify/Product/1", title: "A", category: null, category_reason: null, shopify_updated_at: null, synced_at: "2026-10-08T00:00:00Z" }]);
      case "marketfit_put_products":
        return Response.json({ written: 1, removed: 0 });
      case "fail":
        return new Response("nope", { status: 500 });
      default:
        return new Response(null, { status: 204 });
    }
  };
  const store = createSupabaseStore({ url: "https://x.supabase.co/", secretKey: "sb_secret", tokenKeys: { current: KEY }, transport });
  return { store, calls };
}

describe("supabase store", () => {
  it("seals the token and round-trips a merchant", async () => {
    const { store, calls } = fake();
    const token = {
      accessToken: "shpat_plain",
      refreshToken: "shprt_plain",
      accessExpiresAt: new Date("2026-10-08T10:00:00Z"),
      refreshExpiresAt: new Date("2027-01-01T00:00:00Z"),
      scopes: ["read_products"],
    };
    await store.putMerchant({ shop: "a.myshopify.com", token, state: "active", plan: null, originMarket: null, installedAt: "2026-10-08T09:00:00Z", uninstalledAt: null });
    const back = await store.getMerchant("a.myshopify.com");
    expect(back?.token).toEqual(token);
    for (const call of calls) {
      expect(JSON.stringify(call.args)).not.toContain("shpat_plain");
      expect(JSON.stringify(call.args)).not.toContain("shprt_plain");
      expect(call.headers["apikey"]).toBe("sb_secret");
      expect(call.headers["authorization"]).toBeUndefined();
    }
    expect((calls[0]!.args["p"] as Record<string, unknown>)["token_meta"]).toMatchObject({ scopes: ["read_products"] });
  });

  it("maps every other operation to its function", async () => {
    const { store, calls } = fake();
    expect(await store.deliveries.claim("w1", new Date("2026-10-08T00:00:00Z"), "a.myshopify.com")).toEqual({ claimed: false, reason: "in-flight" });
    await store.deliveries.settle("w1", "done", new Date());
    expect(await store.putProducts("m-1", [], true)).toEqual({ written: 1, removed: 0 });
    expect((await store.listProducts("m-1"))[0]).toMatchObject({ shopifyProductId: "gid://shopify/Product/1", categoryReason: "" });
    await store.removeProduct("m-1", "gid://shopify/Product/1");
    await store.redactShop("a.myshopify.com");
    expect(calls.map((c) => c.fn)).toEqual([
      "marketfit_claim_delivery",
      "marketfit_settle_delivery",
      "marketfit_put_products",
      "marketfit_list_products",
      "marketfit_remove_product",
      "marketfit_redact_shop",
    ]);
    expect(calls[0]!.args["p_abandoned_after"]).toBe("300 seconds");
  });

  it("throws with the status when Supabase refuses", async () => {
    const store = createSupabaseStore({
      url: "https://x.supabase.co",
      secretKey: "k",
      tokenKeys: { current: KEY },
      transport: async () => new Response("bad", { status: 500 }),
    });
    await expect(store.getMerchant("a.myshopify.com")).rejects.toThrow(/answered 500/);
  });
});
