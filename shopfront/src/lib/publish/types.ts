/**
 * What persistence holds, and the shape of a published shop.
 *
 * Step 5. Three tables' worth of shapes, and the division between them is the
 * decision worth explaining.
 *
 * A **store** is a merchant's catalogue: ingested once, enriched once, and
 * shared by every shop built from it. A **shop** is a slug and a plan. A
 * **version** is one `ShopConfig` — a new one on every regeneration, never an
 * overwrite.
 *
 * Catalogue lives on the store rather than on the version, which is what makes
 * "constantly live" true: re-ingesting a merchant's prices updates every shop
 * they have published at once, rather than leaving twenty shops each holding
 * their own stale copy. What a version pins is the *merchandising* — which
 * products, in what order, with what copy — because that is the thing a funnel
 * event in step 6 needs to be attributable to.
 *
 * The Genome sits on the store and is deliberately absent from `PublishedShop`.
 * The rule that it never reaches a page is kept structural rather than
 * remembered: the type the renderer is handed has no field for it.
 */

import type { Catalogue } from "@/lib/ingest/types";
import type { CatalogueGenome } from "@/lib/genome/types";
import type { ShopConfig } from "@/lib/schema";

/** Free until billing exists. The badge is the difference. */
export type Plan = "free" | "pro";

export interface StoreRecord {
  id: string;
  /** Canonical, as the ingester settled it. One row per merchant storefront. */
  storeUrl: string;
  catalogue: Catalogue;
  /** Internal. Never returned by `loadBySlug`. */
  genome: CatalogueGenome | null;
  ingestedAt: string;
  updatedAt: string;
}

export interface StoreRecordInput {
  storeUrl: string;
  catalogue: Catalogue;
  genome?: CatalogueGenome | null;
  ingestedAt: string;
}

export interface ShopRecord {
  id: string;
  storeId: string;
  slug: string;
  plan: Plan;
  createdAt: string;
  /** Null only between creating a shop and adding its first version. */
  currentVersionId: string | null;
}

export interface ShopVersionRecord {
  id: string;
  shopId: string;
  /** 1, 2, 3… per shop. What a funnel event is keyed to in step 6. */
  version: number;
  config: ShopConfig;
  /**
   * Provenance, denormalised out of `config.meta`.
   *
   * The brief asks that every shop record its prompt and stated audience. Both
   * are already inside the config, and both are copied out here anyway: a
   * column can be queried across every shop ever published, and a JSON path
   * into a blob is the kind of thing that works until the day someone needs an
   * index on it.
   */
  prompt: string;
  audience: string | null;
  /**
   * What produced this version — the model that answered, the fingerprint of
   * the merchandiser's prompt, and which Genome fed it.
   *
   * Nullable because versions published before these columns existed have no
   * answer, and inventing one would be worse than an honest null. Everything
   * generated from here on carries all three.
   */
  model: string | null;
  promptVersion: string | null;
  genomeVersion: string | null;
  createdAt: string;
}

/**
 * What serving a public URL needs, and nothing more.
 *
 * Note what is not here: the Genome, and the store's id. A page cannot leak a
 * field it was never given.
 */
export interface PublishedShop {
  slug: string;
  plan: Plan;
  version: number;
  versionId: string;
  config: ShopConfig;
  catalogue: Catalogue;
  /** When the catalogue was read. Printed, because it is a snapshot. */
  ingestedAt: string;
  publishedAt: string;
}

export interface PublishedShopSummary {
  slug: string;
  plan: Plan;
  version: number;
  name: string;
  prompt: string;
  publishedAt: string;
}
