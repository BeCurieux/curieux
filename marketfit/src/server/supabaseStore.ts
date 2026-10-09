/**
 * The store on Supabase: one PostgREST RPC call per operation, over plain
 * fetch with the transport injected, using the secret (service-role) key.
 * Every function it calls is in `supabase/migrations/` and is exercised by
 * `pnpm db:check`; the tests here check the requests this file sends.
 *
 * The Shopify token set is sealed (AES-256-GCM, bound to the shop) before it
 * is sent, so the database never holds a usable token. Expiry times go in
 * `token_meta` in the clear, because they are not secret and are useful to
 * look at.
 */

import { ABANDONED_AFTER_MS, type ClaimResult, type DeliveryLog } from "../shopify/idempotency.js";
import type { AdminTransport } from "../shopify/admin/client.js";
import type { TokenSet } from "../shopify/token.js";
import { openToken, sealToken, type TokenKeys } from "./crypto.js";
import type { AppStore, Merchant, ProductSummary } from "./store.js";

export type SupabaseStoreOptions = { url: string; secretKey: string; tokenKeys: TokenKeys; transport: AdminTransport };

type MerchantRow = {
  id: string;
  shop_domain: string;
  access_token: string | null;
  install_state: Merchant["state"];
  plan: string | null;
  origin_market: string | null;
  installed_at: string;
  uninstalled_at: string | null;
};

export function createSupabaseStore(options: SupabaseStoreOptions): AppStore {
  const { url, secretKey, tokenKeys, transport } = options;

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const response = await transport(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: secretKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(args),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${fn} answered ${response.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  function fromRow(row: MerchantRow): Merchant {
    return {
      id: row.id,
      shop: row.shop_domain,
      token: row.access_token ? reviveToken(JSON.parse(openToken(row.access_token, row.shop_domain, tokenKeys))) : null,
      state: row.install_state,
      plan: row.plan,
      originMarket: row.origin_market,
      installedAt: row.installed_at,
      uninstalledAt: row.uninstalled_at,
    };
  }

  const deliveries: DeliveryLog = {
    async claim(webhookId, now, shop) {
      const result = await rpc<string>("marketfit_claim_delivery", {
        p_webhook_id: webhookId,
        p_shop: shop ?? "",
        p_now: now.toISOString(),
        p_abandoned_after: `${ABANDONED_AFTER_MS / 1000} seconds`,
      });
      return (result === "claimed" ? { claimed: true } : { claimed: false, reason: result }) as ClaimResult;
    },
    async settle(webhookId, status) {
      await rpc("marketfit_settle_delivery", { p_webhook_id: webhookId, p_status: status });
    },
  };

  return {
    async getMerchant(shop) {
      const row = await rpc<MerchantRow | null>("marketfit_get_merchant", { p_shop: shop });
      return row ? fromRow(row) : null;
    },
    async putMerchant(merchant) {
      const row = await rpc<MerchantRow>("marketfit_put_merchant", {
        p: {
          shop_domain: merchant.shop,
          access_token: merchant.token ? sealToken(JSON.stringify(merchant.token), merchant.shop, tokenKeys) : null,
          token_meta: merchant.token
            ? {
                access_expires_at: merchant.token.accessExpiresAt?.toISOString() ?? null,
                refresh_expires_at: merchant.token.refreshExpiresAt?.toISOString() ?? null,
                scopes: merchant.token.scopes,
              }
            : {},
          install_state: merchant.state,
          plan: merchant.plan,
          origin_market: merchant.originMarket,
          installed_at: merchant.installedAt,
          uninstalled_at: merchant.uninstalledAt,
        },
      });
      return fromRow(row);
    },
    async putProducts(merchantId, products, full) {
      return rpc("marketfit_put_products", {
        p_merchant: merchantId,
        p_full: full,
        p_products: products.map((p) => ({
          shopify_product_id: p.shopifyProductId,
          title: p.title,
          category: p.category,
          category_reason: p.categoryReason,
          raw_json: p.raw,
          shopify_updated_at: p.shopifyUpdatedAt,
        })),
      });
    },
    async listProducts(merchantId) {
      const rows = await rpc<Record<string, string | null>[]>("marketfit_list_products", { p_merchant: merchantId });
      return rows.map(
        (r): ProductSummary => ({
          id: r["id"] as string,
          shopifyProductId: r["shopify_product_id"] as string,
          title: r["title"] as string,
          category: r["category"] ?? null,
          categoryReason: r["category_reason"] ?? "",
          shopifyUpdatedAt: r["shopify_updated_at"] ?? null,
          syncedAt: r["synced_at"] as string,
        }),
      );
    },
    async removeProduct(merchantId, shopifyProductId) {
      await rpc("marketfit_remove_product", { p_merchant: merchantId, p_shopify_product_id: shopifyProductId });
    },
    async redactShop(shop) {
      await rpc("marketfit_redact_shop", { p_shop: shop });
    },
    deliveries,
  };
}

/** JSON turns the token set's dates into strings; turn them back. */
function reviveToken(value: Record<string, unknown>): TokenSet {
  const date = (v: unknown) => (typeof v === "string" ? new Date(v) : null);
  return {
    accessToken: String(value["accessToken"]),
    refreshToken: typeof value["refreshToken"] === "string" ? value["refreshToken"] : null,
    accessExpiresAt: date(value["accessExpiresAt"]),
    refreshExpiresAt: date(value["refreshExpiresAt"]),
    scopes: Array.isArray(value["scopes"]) ? (value["scopes"] as string[]) : [],
  };
}
