/**
 * What the app keeps about a shop, behind an interface with two
 * implementations: Supabase (`supabaseStore.ts`, stage 3) for anything
 * deployed, and memory for tests and `pnpm dev` without a database.
 *
 * The operations mirror the database functions in
 * supabase/migrations/…_shopify_app_storage.sql one for one, and the memory
 * store keeps the same rules — a product write older than what is held is
 * refused, a product write before any full scan is refused — so a test that
 * passes on memory is testing the behaviour the database has.
 */

import type { Jurisdiction } from "../engine/types.js";
import { summarise, type CatalogueScan, type ProductScan } from "../shopify/catalogue.js";
import { createMemoryDeliveryLog, type DeliveryLog } from "../shopify/idempotency.js";
import type { PlanHandle } from "../shopify/plans.js";
import type { TokenSet } from "../shopify/token.js";

export type InstallationState = "active" | "needs_reauth" | "uninstalled";

export type Installation = {
  shop: string;
  token: TokenSet;
  state: InstallationState;
  /** Null until the merchant chooses; a scan refuses to run without them. */
  markets: Jurisdiction[] | null;
  /** The last plan the Partner API confirmed — the fallback when it cannot answer. */
  lastKnownPlan: PlanHandle | null;
  installedAt: string;
  updatedAt: string;
};

export interface AppStore {
  getInstallation(shop: string): Promise<Installation | null>;
  putInstallation(installation: Installation): Promise<void>;

  getCatalogue(shop: string): Promise<CatalogueScan | null>;
  /** A full scan: replaces every product for the shop, atomically. */
  putCatalogue(shop: string, catalogue: CatalogueScan): Promise<void>;
  /**
   * One product's new scan. Refused — returns false — when its copy is older
   * than the copy already held, or when the shop has no catalogue yet.
   */
  putProduct(shop: string, scan: ProductScan): Promise<boolean>;
  /** The copy changed and could not be reread: keep the score, drop the mark. */
  markStale(shop: string, gid: string): Promise<void>;
  removeProduct(shop: string, gid: string): Promise<void>;

  deliveries: DeliveryLog;
  /** `shop/redact`: everything held for the shop, gone. */
  redactShop(shop: string): Promise<void>;
}

export function createMemoryStore(): AppStore {
  const installations = new Map<string, Installation>();
  const catalogues = new Map<string, Omit<CatalogueScan, "products" | "summary">>();
  const products = new Map<string, Map<string, ProductScan>>();

  const productsOf = (shop: string) => [...(products.get(shop)?.values() ?? [])];

  return {
    async getInstallation(shop) {
      return installations.get(shop) ?? null;
    },
    async putInstallation(installation) {
      installations.set(installation.shop, installation);
    },

    async getCatalogue(shop) {
      const meta = catalogues.get(shop);
      if (!meta) return null;
      const scans = productsOf(shop).sort((a, b) => a.product.gid.localeCompare(b.product.gid));
      return { ...meta, products: scans, summary: summarise(scans) };
    },
    async putCatalogue(shop, catalogue) {
      const { products: scans, summary: _summary, ...meta } = catalogue;
      catalogues.set(shop, meta);
      products.set(shop, new Map(scans.map((s) => [s.product.gid, s])));
    },
    async putProduct(shop, scan) {
      const held = products.get(shop);
      if (!catalogues.has(shop) || !held) return false;
      const current = held.get(scan.product.gid);
      if (current && isOlder(scan.product.updatedAt, current.product.updatedAt)) return false;
      held.set(scan.product.gid, scan);
      return true;
    },
    async markStale(shop, gid) {
      const held = products.get(shop);
      const current = held?.get(gid);
      if (held && current) held.set(gid, { ...current, badge: false, stale: true });
    },
    async removeProduct(shop, gid) {
      products.get(shop)?.delete(gid);
    },

    deliveries: createMemoryDeliveryLog(),
    async redactShop(shop) {
      installations.delete(shop);
      catalogues.delete(shop);
      products.delete(shop);
    },
  };
}

/** The database's rule: refuse only when both are dated and incoming is older. */
export function isOlder(incoming: string | null, held: string | null): boolean {
  if (!incoming || !held) return false;
  const a = Date.parse(incoming);
  const b = Date.parse(held);
  return Number.isFinite(a) && Number.isFinite(b) && a < b;
}
