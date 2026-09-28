/**
 * The app's storage in Supabase, one database function per operation.
 *
 * Every call is `POST /rest/v1/rpc/<function>` with the project's secret key in
 * the `apikey` header — the secret key maps to `service_role`, the only role
 * the migration lets execute these functions. No `Authorization` header: the
 * new-style keys are not JWTs, and Supabase rejects one sent as a bearer token
 * unless it repeats the `apikey` exactly
 * (https://supabase.com/docs/guides/getting-started/api-keys).
 *
 * Plain fetch with the transport injected, like every other network edge in
 * this codebase, rather than supabase-js: eleven RPC calls do not need a
 * client library, and the tests can see exactly what is sent.
 *
 * Tokens are sealed here, on the way in, and opened here, on the way out
 * (crypto.ts). Nothing above this file ever handles a sealed token, and
 * nothing below it ever sees a plain one.
 */

import type { Jurisdiction } from "../engine/types.js";
import type { AdminTransport } from "../shopify/admin/client.js";
import { summarise, type CatalogueScan, type ProductScan } from "../shopify/catalogue.js";
import { ABANDONED_AFTER_MS, type ClaimResult, type DeliveryLog } from "../shopify/idempotency.js";
import { isPlanHandle } from "../shopify/plans.js";
import { openToken, sealToken, type TokenKeys } from "./crypto.js";
import type { AppStore, Installation, InstallationState } from "./store.js";

export interface SupabaseStoreOptions {
  /** `https://<ref>.supabase.co` */
  url: string;
  /** An `sb_secret_…` key. Server only; never sent anywhere else. */
  secretKey: string;
  tokenKeys: TokenKeys;
  transport: AdminTransport;
}

export class SupabaseError extends Error {
  constructor(
    readonly fn: string,
    readonly status: number,
    detail: string,
  ) {
    // The response body can carry a Postgres message; it never carries the key.
    super(`Supabase ${fn} failed with ${status}: ${detail.slice(0, 300)}`);
    this.name = "SupabaseError";
  }
}

type InstallationRow = {
  shop: string;
  state: InstallationState;
  access_token_enc: string;
  refresh_token_enc: string | null;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  scopes: string[];
  markets: string[] | null;
  last_known_plan: string | null;
  installed_at: string;
  updated_at: string;
};

type CatalogueRow = {
  scannedAt: string;
  jurisdictions: Jurisdiction[];
  packVersions: Record<string, string>;
  truncated: boolean;
  products: ProductScan[];
};

export function createSupabaseStore(options: SupabaseStoreOptions): AppStore {
  const base = options.url.replace(/\/+$/, "");

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const response = await options.transport(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: options.secretKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(args),
    });
    const text = await response.text();
    if (!response.ok) throw new SupabaseError(fn, response.status, text);
    // A function returning void answers with an empty body.
    return (text.length === 0 ? null : JSON.parse(text)) as T;
  }

  const deliveries: DeliveryLog = {
    async claim(webhookId, now, shop): Promise<ClaimResult> {
      const answer = await rpc<string>("franca_claim_delivery", {
        p_webhook_id: webhookId,
        p_shop: shop ?? null,
        p_now: now.toISOString(),
        p_abandoned_after: `${Math.round(ABANDONED_AFTER_MS / 1000)} seconds`,
      });
      if (answer === "claimed") return { claimed: true };
      if (answer === "already-processed") return { claimed: false, reason: "already-processed" };
      return { claimed: false, reason: "in-flight" };
    },
    async settle(webhookId, status) {
      await rpc("franca_settle_delivery", { p_webhook_id: webhookId, p_status: status });
    },
  };

  return {
    async getInstallation(shop) {
      const row = await rpc<InstallationRow | null>("franca_get_installation", { p_shop: shop });
      return row ? fromRow(row, options.tokenKeys) : null;
    },
    async putInstallation(installation) {
      await rpc("franca_put_installation", { p_row: toRow(installation, options.tokenKeys) });
    },

    async getCatalogue(shop) {
      const row = await rpc<CatalogueRow | null>("franca_get_catalogue", { p_shop: shop });
      if (!row) return null;
      return {
        scannedAt: row.scannedAt,
        jurisdictions: row.jurisdictions,
        packVersions: row.packVersions,
        truncated: row.truncated,
        products: row.products,
        // Recomputed on every read, so it can never disagree with the rows.
        summary: summarise(row.products),
      };
    },
    async putCatalogue(shop, catalogue: CatalogueScan) {
      await rpc("franca_replace_catalogue", {
        p_shop: shop,
        p_scanned_at: catalogue.scannedAt,
        p_jurisdictions: catalogue.jurisdictions,
        p_pack_versions: catalogue.packVersions,
        p_truncated: catalogue.truncated ?? false,
        p_products: catalogue.products.map((scan) => ({
          gid: scan.product.gid,
          productUpdatedAt: scan.product.updatedAt,
          scan,
        })),
      });
    },
    async putProduct(shop, scan) {
      return rpc<boolean>("franca_put_product_scan", {
        p_shop: shop,
        p_gid: scan.product.gid,
        p_product_updated_at: scan.product.updatedAt,
        p_scan: scan,
      });
    },
    async markStale(shop, gid) {
      await rpc("franca_mark_product_stale", { p_shop: shop, p_gid: gid });
    },
    async removeProduct(shop, gid) {
      await rpc("franca_remove_product_scan", { p_shop: shop, p_gid: gid });
    },

    deliveries,
    async redactShop(shop) {
      await rpc("franca_redact_shop", { p_shop: shop });
    },
  };
}

function toRow(installation: Installation, keys: TokenKeys): InstallationRow {
  const { shop, token } = installation;
  return {
    shop,
    state: installation.state,
    access_token_enc: sealToken(token.accessToken, shop, keys),
    refresh_token_enc: token.refreshToken ? sealToken(token.refreshToken, shop, keys) : null,
    access_expires_at: token.accessExpiresAt?.toISOString() ?? null,
    refresh_expires_at: token.refreshExpiresAt?.toISOString() ?? null,
    scopes: token.scopes,
    markets: installation.markets,
    last_known_plan: installation.lastKnownPlan,
    installed_at: installation.installedAt,
    updated_at: installation.updatedAt,
  };
}

function fromRow(row: InstallationRow, keys: TokenKeys): Installation {
  return {
    shop: row.shop,
    state: row.state,
    token: {
      accessToken: openToken(row.access_token_enc, row.shop, keys),
      refreshToken: row.refresh_token_enc ? openToken(row.refresh_token_enc, row.shop, keys) : null,
      accessExpiresAt: row.access_expires_at ? new Date(row.access_expires_at) : null,
      refreshExpiresAt: row.refresh_expires_at ? new Date(row.refresh_expires_at) : null,
      scopes: row.scopes,
    },
    markets: row.markets as Jurisdiction[] | null,
    lastKnownPlan: isPlanHandle(row.last_known_plan) ? row.last_known_plan : null,
    installedAt: new Date(row.installed_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
