/**
 * What the app keeps about a shop, behind an interface.
 *
 * Stage 2 ships an in-memory implementation, which is right for tests and for
 * `pnpm dev` and wrong everywhere else: a serverless deployment would forget
 * every installation between requests. Stage 3 puts Supabase behind the same
 * interface (SHOPIFY-APP.md), and `deps.ts` refuses to start in production
 * until it exists.
 *
 * Tokens live on the installation. In Postgres they are encrypted at rest and
 * no row-level-security policy exposes them; here they are a field on an object.
 */

import type { Jurisdiction } from "../engine/types.js";
import type { CatalogueScan } from "../shopify/catalogue.js";
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
  /**
   * Whole-catalogue writes. A webhook's read-modify-write can race another
   * for the same shop; the memory store cannot, and stage 3 adds a version
   * column and compare-and-set, as shopfront's design does (§3.1 there).
   */
  putCatalogue(shop: string, catalogue: CatalogueScan): Promise<void>;
  deliveries: DeliveryLog;
  /** `shop/redact`: everything held for the shop, gone. */
  redactShop(shop: string): Promise<void>;
}

export function createMemoryStore(): AppStore {
  const installations = new Map<string, Installation>();
  const catalogues = new Map<string, CatalogueScan>();
  return {
    async getInstallation(shop) {
      return installations.get(shop) ?? null;
    },
    async putInstallation(installation) {
      installations.set(installation.shop, installation);
    },
    async getCatalogue(shop) {
      return catalogues.get(shop) ?? null;
    },
    async putCatalogue(shop, catalogue) {
      catalogues.set(shop, catalogue);
    },
    deliveries: createMemoryDeliveryLog(),
    async redactShop(shop) {
      installations.delete(shop);
      catalogues.delete(shop);
    },
  };
}
