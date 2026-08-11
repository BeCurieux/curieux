/**
 * The filesystem adapter.
 *
 * Everything under `.cache/published/`, in the same shape the Supabase tables
 * hold. It exists so the pipeline runs end to end with no database — which is
 * not a convenience: the kill-test in the brief generates thirty shops from
 * public storefront data before any of those merchants has an account, and
 * standing up Postgres to do that would be building step 5's infrastructure to
 * run a test designed to decide whether step 5 is worth building.
 *
 * It is single-process and last-write-wins. That is fine for a CLI and a dev
 * server and is exactly why it is not the production adapter.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ShopStore } from "./store";
import type {
  Plan,
  PublishedShop,
  PublishedShopSummary,
  ShopRecord,
  ShopVersionRecord,
  StoreRecord,
  StoreRecordInput,
} from "./types";
import type { ShopConfig } from "@/lib/schema";

interface Db {
  stores: StoreRecord[];
  shops: ShopRecord[];
  versions: ShopVersionRecord[];
}

const EMPTY: Db = { stores: [], shops: [], versions: [] };

export interface LocalStoreOptions {
  dir?: string;
  now?: () => Date;
  /** Injected so tests are not at the mercy of a real UUID. */
  id?: () => string;
}

export function createLocalStore(options: LocalStoreOptions = {}): ShopStore {
  const dir = options.dir ?? path.join(process.cwd(), ".cache", "published");
  const file = path.join(dir, "db.json");
  const now = options.now ?? (() => new Date());
  const id = options.id ?? (() => randomUUID());

  async function read(): Promise<Db> {
    try {
      return { ...EMPTY, ...(JSON.parse(await readFile(file, "utf8")) as Db) };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  async function write(db: Db): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(db, null, 2));
  }

  function assemble(db: Db, shop: ShopRecord): PublishedShop | null {
    const version = db.versions.find((v) => v.id === shop.currentVersionId);
    const store = db.stores.find((s) => s.id === shop.storeId);
    if (!version || !store) return null;

    return {
      slug: shop.slug,
      plan: shop.plan,
      version: version.version,
      versionId: version.id,
      config: version.config,
      catalogue: store.catalogue,
      ingestedAt: store.ingestedAt,
      publishedAt: version.createdAt,
      // store.genome is deliberately not spread in. The type has no field for
      // it, and this is the line where that is enforced.
    };
  }

  return {
    name: "local",

    async upsertStore(input: StoreRecordInput): Promise<StoreRecord> {
      const db = await read();
      const stamp = now().toISOString();
      const existing = db.stores.find((s) => s.storeUrl === input.storeUrl);

      const record: StoreRecord = existing
        ? {
            ...existing,
            catalogue: input.catalogue,
            // An upsert without a Genome keeps the one already stored: step 2
            // is a separate, more expensive pass, and re-ingesting prices must
            // not silently throw its read away.
            genome: input.genome === undefined ? existing.genome : input.genome,
            ingestedAt: input.ingestedAt,
            updatedAt: stamp,
          }
        : {
            id: id(),
            storeUrl: input.storeUrl,
            catalogue: input.catalogue,
            genome: input.genome ?? null,
            ingestedAt: input.ingestedAt,
            updatedAt: stamp,
          };

      db.stores = [...db.stores.filter((s) => s.id !== record.id), record];
      await write(db);
      return record;
    },

    async findStoreByUrl(storeUrl: string): Promise<StoreRecord | null> {
      return (await read()).stores.find((s) => s.storeUrl === storeUrl) ?? null;
    },

    async slugTaken(slug: string): Promise<boolean> {
      return (await read()).shops.some((s) => s.slug === slug);
    },

    async createShop({ storeId, slug, plan }: { storeId: string; slug: string; plan: Plan }): Promise<ShopRecord> {
      const db = await read();
      if (db.shops.some((s) => s.slug === slug)) throw new Error(`The URL "${slug}" is already taken.`);

      const record: ShopRecord = {
        id: id(),
        storeId,
        slug,
        plan,
        createdAt: now().toISOString(),
        currentVersionId: null,
      };
      db.shops.push(record);
      await write(db);
      return record;
    },

    async findShopBySlug(slug: string): Promise<ShopRecord | null> {
      return (await read()).shops.find((s) => s.slug === slug) ?? null;
    },

    async addVersion({
      shopId,
      config,
      prompt,
      audience,
    }: {
      shopId: string;
      config: unknown;
      prompt: string;
      audience: string | null;
    }): Promise<ShopVersionRecord> {
      const db = await read();
      const shop = db.shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`No shop with id ${shopId}.`);

      const previous = db.versions.filter((v) => v.shopId === shopId).length;
      const record: ShopVersionRecord = {
        id: id(),
        shopId,
        version: previous + 1,
        config: config as ShopConfig,
        prompt,
        audience,
        createdAt: now().toISOString(),
      };

      db.versions.push(record);
      shop.currentVersionId = record.id;
      await write(db);
      return record;
    },

    async loadBySlug(slug: string): Promise<PublishedShop | null> {
      const db = await read();
      const shop = db.shops.find((s) => s.slug === slug);
      return shop ? assemble(db, shop) : null;
    },

    async listPublished(limit = 50): Promise<PublishedShopSummary[]> {
      const db = await read();
      return db.shops
        .map((shop) => {
          const published = assemble(db, shop);
          if (!published) return null;
          return {
            slug: shop.slug,
            plan: shop.plan,
            version: published.version,
            name: published.config.brand.name,
            prompt: published.config.meta.prompt,
            publishedAt: published.publishedAt,
          };
        })
        .filter((s): s is PublishedShopSummary => s !== null)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, limit);
    },
  };
}

/** Where the local adapter keeps its files, for a CLI that wants to say so. */
export function localStorePath(dir?: string): string {
  return path.join(dir ?? path.join(process.cwd(), ".cache", "published"), "db.json");
}
