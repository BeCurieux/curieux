/**
 * What the app server keeps, behind an interface: Supabase in production
 * (`supabaseStore.ts`), memory in development and in every test here.
 */

import type { DeliveryLog } from "../shopify/idempotency.js";
import { createMemoryDeliveryLog } from "../shopify/idempotency.js";
import type { ShopifyProduct } from "../shopify/admin/products.js";
import type { TokenSet } from "../shopify/token.js";

export type InstallState = "active" | "needs_reauth" | "uninstalled";

export type Merchant = {
  id: string;
  shop: string;
  /** Plain in memory; sealed by the Supabase store before it leaves the process. */
  token: TokenSet | null;
  state: InstallState;
  plan: string | null;
  originMarket: string | null;
  installedAt: string;
  uninstalledAt: string | null;
};

export type ProductRow = {
  shopifyProductId: string;
  title: string;
  category: string | null;
  categoryReason: string;
  raw: ShopifyProduct;
  shopifyUpdatedAt: string | null;
};

export type ProductSummary = Omit<ProductRow, "raw"> & { id: string; syncedAt: string };

export interface AppStore {
  getMerchant(shop: string): Promise<Merchant | null>;
  putMerchant(merchant: Omit<Merchant, "id"> & { id?: string }): Promise<Merchant>;
  /** Upsert; never overwrites newer data. `full` removes products not listed. */
  putProducts(merchantId: string, products: ProductRow[], full: boolean): Promise<{ written: number; removed: number }>;
  listProducts(merchantId: string): Promise<ProductSummary[]>;
  removeProduct(merchantId: string, shopifyProductId: string): Promise<void>;
  /** shop/redact: the merchant and everything under it. */
  redactShop(shop: string): Promise<void>;
  deliveries: DeliveryLog;
}

export function createMemoryStore(now: () => Date = () => new Date()): AppStore {
  const merchants = new Map<string, Merchant>();
  const products = new Map<string, Map<string, ProductSummary>>();
  let seq = 0;

  return {
    async getMerchant(shop) {
      return merchants.get(shop) ?? null;
    },
    async putMerchant(merchant) {
      const existing = merchants.get(merchant.shop);
      const next: Merchant = { ...merchant, id: existing?.id ?? merchant.id ?? `m-${++seq}` };
      merchants.set(merchant.shop, next);
      return next;
    },
    async putProducts(merchantId, rows, full) {
      const held = products.get(merchantId) ?? new Map<string, ProductSummary>();
      let written = 0;
      for (const row of rows) {
        const existing = held.get(row.shopifyProductId);
        if (existing?.shopifyUpdatedAt && row.shopifyUpdatedAt && row.shopifyUpdatedAt < existing.shopifyUpdatedAt) continue;
        const { raw: _raw, ...summary } = row;
        held.set(row.shopifyProductId, { ...summary, id: existing?.id ?? `p-${++seq}`, syncedAt: now().toISOString() });
        written += 1;
      }
      let removed = 0;
      if (full) {
        const keep = new Set(rows.map((r) => r.shopifyProductId));
        for (const key of [...held.keys()]) if (!keep.has(key)) (held.delete(key), (removed += 1));
      }
      products.set(merchantId, held);
      return { written, removed };
    },
    async listProducts(merchantId) {
      return [...(products.get(merchantId)?.values() ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    },
    async removeProduct(merchantId, shopifyProductId) {
      products.get(merchantId)?.delete(shopifyProductId);
    },
    async redactShop(shop) {
      const merchant = merchants.get(shop);
      if (merchant) products.delete(merchant.id);
      merchants.delete(shop);
    },
    deliveries: createMemoryDeliveryLog(),
  };
}
