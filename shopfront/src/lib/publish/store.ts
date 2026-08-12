/**
 * The persistence seam.
 *
 * Two implementations: `supabase.ts` is production, `local.ts` is a directory
 * of JSON files. The local one is not a stub — the whole pipeline has to be
 * runnable and testable without a database, and the kill-test generates thirty
 * shops from public storefront data before there is any account to attach them
 * to.
 *
 * Nothing above this interface knows which one it has. That is what makes the
 * Supabase adapter replaceable if the fixed stack ever changes, and it is why
 * `publish.ts` contains no SQL and no file paths.
 */

import type {
  PublishedShop,
  PublishedShopSummary,
  ShopRecord,
  ShopVersionRecord,
  StoreRecord,
  StoreRecordInput,
  Plan,
} from "./types";

export interface ShopStore {
  readonly name: string;

  /**
   * One row per storefront, upserted on `storeUrl`.
   *
   * Re-ingesting replaces the catalogue for every shop built from it at once,
   * which is the mechanism behind "constantly live": a sell-out reaches twenty
   * published shops without any of them being regenerated.
   */
  upsertStore(input: StoreRecordInput): Promise<StoreRecord>;

  findStoreByUrl(storeUrl: string): Promise<StoreRecord | null>;

  slugTaken(slug: string): Promise<boolean>;

  createShop(input: { storeId: string; slug: string; plan: Plan }): Promise<ShopRecord>;

  findShopBySlug(slug: string): Promise<ShopRecord | null>;

  /**
   * Append a version and make it current.
   *
   * Append rather than overwrite, so a regenerated shop does not orphan the
   * funnel events step 6 will key to the version that served them.
   */
  addVersion(input: {
    shopId: string;
    config: unknown;
    prompt: string;
    audience: string | null;
  }): Promise<ShopVersionRecord>;

  /**
   * Everything a public URL needs, in one round trip.
   *
   * Deliberately never returns the Genome, even though the store row holds it.
   * "Genome fields stay internal" is kept by the type not having the field
   * rather than by everyone remembering.
   */
  loadBySlug(slug: string): Promise<PublishedShop | null>;

  listPublished(limit?: number): Promise<PublishedShopSummary[]>;
}

/** Which adapter the app builds when nothing is passed. */
export function storeNameFromEnv(): "supabase" | "local" {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}
