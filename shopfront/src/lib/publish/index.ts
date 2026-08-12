/**
 * Publishing: a `ShopConfig` becomes a URL somebody can put in their bio.
 *
 * Step 5. Deliberately small — the interesting decisions are in `slug.ts`
 * (the string is public forever) and `schema.sql` (the Genome must be
 * unreachable from a public key). This file only sequences them.
 *
 * Republishing an existing slug appends a version rather than replacing one.
 * That costs a row and buys two things: a merchant who regenerates and prefers
 * the old shop has not lost it, and step 6's funnel events stay attributable to
 * the version that actually served them.
 */

import { createLocalStore } from "./local";
import { createSupabaseStore } from "./supabase";
import { allocateSlug, checkSlug, slugify } from "./slug";
import { storeNameFromEnv, type ShopStore } from "./store";
import type { Plan, PublishedShop } from "./types";
import type { CatalogueGenome } from "@/lib/genome/types";
import type { IngestResult } from "@/lib/ingest/types";
import type { ShopConfig } from "@/lib/schema";

export interface PublishInput {
  config: ShopConfig;
  ingest: IngestResult;
  /** Stored on the store row for the merchandiser. Never served to a page. */
  genome?: CatalogueGenome | null;
  /** A URL the merchant asked for. Rejected rather than mangled if unusable. */
  slug?: string;
  plan?: Plan;
}

export interface PublishResult {
  shop: PublishedShop;
  url: string;
  /** True when this slug had no versions before. */
  created: boolean;
}

export interface PublishOptions {
  store?: ShopStore;
  /** Origin for the returned URL. Falls back to the env, then to a relative path. */
  origin?: string;
}

export class PublishError extends Error {
  constructor(
    readonly code: "bad-slug" | "slug-taken" | "not-found",
    message: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export async function publishShop(input: PublishInput, options: PublishOptions = {}): Promise<PublishResult> {
  const store = options.store ?? defaultStore();
  const plan = input.plan ?? "free";

  const storeRecord = await store.upsertStore({
    storeUrl: input.ingest.store.storeUrl,
    catalogue: input.ingest.catalogue,
    ...(input.genome !== undefined ? { genome: input.genome } : {}),
    ingestedAt: input.ingest.store.ingestedAt,
  });

  // A merchant's chosen URL is checked and refused, never silently corrected.
  // Publishing "Summer Edit!" to `summer-edit` without saying so is how a link
  // ends up in a bio pointing at something the merchant never agreed to.
  if (input.slug !== undefined) {
    const check = checkSlug(input.slug);
    if (check.ok !== true) throw new PublishError("bad-slug", check.reason);
  }

  const existing = input.slug ? await store.findShopBySlug(input.slug) : null;

  let shopId: string;
  let slug: string;
  let created: boolean;

  if (existing) {
    // Republishing over a slug this store already owns is the normal case.
    // Over one belonging to a different store it is somebody taking a URL that
    // is not theirs, which has to be refused rather than resolved.
    if (existing.storeId !== storeRecord.id) {
      throw new PublishError("slug-taken", `The URL "${input.slug}" belongs to another store.`);
    }
    shopId = existing.id;
    slug = existing.slug;
    created = false;
  } else {
    slug = input.slug ?? (await allocateSlug(slugify(input.config.brand.name), { isTaken: (s) => store.slugTaken(s) }));
    if (input.slug && (await store.slugTaken(slug))) {
      throw new PublishError("slug-taken", `The URL "${slug}" is already taken.`);
    }
    const shop = await store.createShop({ storeId: storeRecord.id, slug, plan });
    shopId = shop.id;
    created = true;
  }

  await store.addVersion({
    shopId,
    config: input.config,
    prompt: input.config.meta.prompt,
    audience: input.config.meta.audience ?? null,
  });

  const published = await store.loadBySlug(slug);
  if (!published) throw new PublishError("not-found", `Published "${slug}" but could not read it back.`);

  return { shop: published, url: shopUrl(slug, options.origin), created };
}

export function shopUrl(slug: string, origin?: string): string {
  const base = origin ?? process.env.PUBLIC_ORIGIN ?? process.env.NEXT_PUBLIC_ORIGIN;
  return base ? `${base.replace(/\/+$/, "")}/${slug}` : `/${slug}`;
}

/**
 * Supabase when it is configured, the filesystem when it is not.
 *
 * Falling back rather than failing is right for exactly one reason: the
 * kill-test generates thirty shops before any of those merchants has an
 * account, and requiring a database to do that would be building step 5's
 * infrastructure in order to run the test that decides whether step 5 is worth
 * building. `store.name` is reported by every CLI so it is never a mystery
 * which one ran.
 */
export function defaultStore(): ShopStore {
  return storeNameFromEnv() === "supabase" ? createSupabaseStore() : createLocalStore();
}

export { createLocalStore, localStorePath } from "./local";
export { createSupabaseStore } from "./supabase";
export { allocateSlug, checkSlug, slugify, RESERVED_SLUGS, SLUG_MAX, SLUG_MIN } from "./slug";
export { storeNameFromEnv } from "./store";
export type { ShopStore } from "./store";
export type * from "./types";
