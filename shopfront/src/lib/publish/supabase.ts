/**
 * The Supabase adapter.
 *
 * Writes go through the service role, which only ever exists on the server.
 * The one public read is `get_published_shop`, a `security definer` function
 * whose return columns are the allowlist — `stores.genome` is not among them,
 * so an anon key physically cannot reach the Genome even if a bug asked it to.
 * See `schema.sql`; the reasoning for that shape is written there.
 *
 * Unverified against a live project. This environment's proxy refuses
 * supabase.com and no credentials are configured, so this file has been
 * typechecked against the real client and exercised against nothing. The
 * interface it implements is covered by tests through `local.ts`; what is not
 * covered is whether these queries are right, and that is the first thing to
 * check when a project exists.
 *
 * Narrowed since that was written. `tests/publish-supabase-contract.test.ts`
 * parses `schema.sql` and cross-checks every table, column, `onConflict`,
 * foreign-key hint, function name and rpc argument named below, including the
 * columns read back off an rpc result. Those are strings, `tsc` has never read
 * the `.sql` file, and a rename on one side of the pair is otherwise invisible
 * until a real project answers the query.
 *
 * What is still unproven is behaviour rather than naming: whether `upsert`
 * with `onConflict` does what this expects, what `maybeSingle` returns against
 * two rows, and whether the embedded-resource select shape below comes back
 * nested the way `listPublished` unwraps it. Those need PostgREST, not a
 * parser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ShopStore } from "./store";
import type {
  Plan,
  PublishedShop,
  PublishedShopSummary,
  RefreshPolicy,
  ShopRecord,
  ShopVersionRecord,
  StoreRecord,
  StoreRecordInput,
} from "./types";
import type { Creator } from "@/lib/creator";
import type { ShopConfig } from "@/lib/schema";
import type { Catalogue } from "@/lib/ingest/types";
import type { CatalogueGenome } from "@/lib/genome/types";

export interface SupabaseStoreOptions {
  client?: SupabaseClient;
  url?: string;
  /** Service role for writes. Never expose this to a browser. */
  serviceRoleKey?: string;
}

export function createSupabaseStore(options: SupabaseStoreOptions = {}): ShopStore {
  const client = options.client ?? defaultClient(options);

  const fail = (what: string, error: { message: string } | null): never => {
    throw new Error(`Supabase ${what} failed: ${error?.message ?? "unknown error"}`);
  };

  return {
    name: "supabase",

    async upsertStore(input: StoreRecordInput): Promise<StoreRecord> {
      // `genome` is only written when the caller passed one. Re-ingesting
      // prices must not blank a Genome that cost a model pass to produce, and
      // an upsert that always wrote the column would do exactly that.
      const row: Record<string, unknown> = {
        store_url: input.storeUrl,
        catalogue: input.catalogue,
        ingested_at: input.ingestedAt,
        updated_at: new Date().toISOString(),
      };
      if (input.genome !== undefined) row.genome = input.genome;

      const { data, error } = await client
        .from("stores")
        .upsert(row, { onConflict: "store_url" })
        .select()
        .single();

      if (error || !data) return fail("store upsert", error);
      return toStore(data);
    },

    async findStoreByUrl(storeUrl: string): Promise<StoreRecord | null> {
      const { data, error } = await client.from("stores").select().eq("store_url", storeUrl).maybeSingle();
      if (error) return fail("store lookup", error);
      return data ? toStore(data) : null;
    },

    async slugTaken(slug: string): Promise<boolean> {
      const { data, error } = await client.from("shops").select("slug").eq("slug", slug).maybeSingle();
      if (error) return fail("slug check", error);
      return data !== null;
    },

    async createShop({
      storeId,
      slug,
      plan,
      creator = null,
      refresh = "pinned",
    }: {
      storeId: string;
      slug: string;
      plan: Plan;
      creator?: Creator | null;
      refresh?: RefreshPolicy;
    }): Promise<ShopRecord> {
      const { data, error } = await client
        .from("shops")
        .insert({ store_id: storeId, slug, plan, creator, refresh })
        .select()
        .single();

      // The unique index on slug is the real arbiter, not `slugTaken` — two
      // concurrent publishes can both find a slug free. Turning 23505 into the
      // same message the pre-check gives lets the caller retry the same way.
      if (error?.code === "23505") throw new Error(`The URL "${slug}" is already taken.`);
      if (error || !data) return fail("shop insert", error);
      return toShop(data);
    },

    async findShopBySlug(slug: string): Promise<ShopRecord | null> {
      const { data, error } = await client.from("shops").select().eq("slug", slug).maybeSingle();
      if (error) return fail("shop lookup", error);
      return data ? toShop(data) : null;
    },

    async updateShop(
      shopId: string,
      patch: { creator?: Creator | null; refresh?: RefreshPolicy },
    ): Promise<ShopRecord> {
      // Only the keys that were passed, so an empty patch is an empty update
      // rather than a row of nulls. A republish that did not repeat the
      // attribution must not strip a creator's name off their own shop.
      const row: Record<string, unknown> = {};
      if (patch.creator !== undefined) row.creator = patch.creator;
      if (patch.refresh !== undefined) row.refresh = patch.refresh;

      if (Object.keys(row).length === 0) {
        const { data, error } = await client.from("shops").select().eq("id", shopId).single();
        if (error || !data) return fail("shop lookup", error);
        return toShop(data);
      }

      const { data, error } = await client.from("shops").update(row).eq("id", shopId).select().single();
      if (error || !data) return fail("shop update", error);
      return toShop(data);
    },

    async addVersion({
      shopId,
      config,
      prompt,
      audience,
      model = null,
      promptVersion = null,
      genomeVersion = null,
    }: {
      shopId: string;
      config: unknown;
      prompt: string;
      audience: string | null;
      model?: string | null;
      promptVersion?: string | null;
      genomeVersion?: string | null;
    }): Promise<ShopVersionRecord> {
      const { count, error: countError } = await client
        .from("shop_versions")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId);
      if (countError) return fail("version count", countError);

      const { data, error } = await client
        .from("shop_versions")
        .insert({
          shop_id: shopId,
          version: (count ?? 0) + 1,
          config,
          prompt,
          audience,
          model,
          prompt_version: promptVersion,
          genome_version: genomeVersion,
        })
        .select()
        .single();
      if (error || !data) return fail("version insert", error);

      const { error: pointerError } = await client
        .from("shops")
        .update({ current_version_id: data.id })
        .eq("id", shopId);
      if (pointerError) return fail("current version update", pointerError);

      return toVersion(data);
    },

    async loadBySlug(slug: string): Promise<PublishedShop | null> {
      const { data, error } = await client.rpc("get_published_shop", { want_slug: slug });
      if (error) return fail("published shop read", error);

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      return {
        slug: row.slug as string,
        plan: row.plan as Plan,
        version: row.version as number,
        versionId: row.version_id as string,
        config: row.config as ShopConfig,
        catalogue: row.catalogue as Catalogue,
        creator: (row.creator ?? null) as Creator | null,
        refresh: (row.refresh ?? "pinned") as RefreshPolicy,
        ingestedAt: row.ingested_at as string,
        publishedAt: row.published_at as string,
      };
    },

    async listPublished(limit = 50): Promise<PublishedShopSummary[]> {
      const { data, error } = await client
        .from("shops")
        .select(
          "slug, plan, creator, refresh, shop_versions!shops_current_version_id_fkey(version, config, prompt, created_at)",
        )
        .not("current_version_id", "is", null)
        .limit(limit);

      if (error) return fail("published list", error);

      return (data ?? []).flatMap((row: Record<string, any>) => {
        const version = Array.isArray(row.shop_versions) ? row.shop_versions[0] : row.shop_versions;
        if (!version) return [];
        return [
          {
            slug: row.slug as string,
            plan: row.plan as Plan,
            version: version.version as number,
            name: (version.config as ShopConfig).brand.name,
            prompt: version.prompt as string,
            creator: (row.creator ?? null) as Creator | null,
            refresh: (row.refresh ?? "pinned") as RefreshPolicy,
            publishedAt: version.created_at as string,
          },
        ];
      });
    },
  };
}

/**
 * The service-role client.
 *
 * Exported so the funnel can share it rather than mint a second one: same key,
 * same pool, and exactly one place in the codebase that reads the secret.
 */
export function serviceRoleClient(options: SupabaseStoreOptions = {}): SupabaseClient {
  return defaultClient(options);
}

function defaultClient(options: SupabaseStoreOptions): SupabaseClient {
  const url = options.url ?? process.env.SUPABASE_URL;
  const key = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. Set both, or leave them unset to use the local store.",
    );
  }
  // No session to persist and no tokens to refresh: this runs on a server with
  // a service role, and auto-refresh would keep a timer alive in a CLI.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function toStore(row: Record<string, any>): StoreRecord {
  return {
    id: row.id as string,
    storeUrl: row.store_url as string,
    catalogue: row.catalogue as Catalogue,
    genome: (row.genome ?? null) as CatalogueGenome | null,
    ingestedAt: row.ingested_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toShop(row: Record<string, any>): ShopRecord {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    slug: row.slug as string,
    plan: row.plan as Plan,
    creator: (row.creator ?? null) as Creator | null,
    refresh: (row.refresh ?? "pinned") as RefreshPolicy,
    createdAt: row.created_at as string,
    currentVersionId: (row.current_version_id ?? null) as string | null,
  };
}

function toVersion(row: Record<string, any>): ShopVersionRecord {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    version: row.version as number,
    config: row.config as ShopConfig,
    prompt: row.prompt as string,
    audience: (row.audience ?? null) as string | null,
    model: (row.model ?? null) as string | null,
    promptVersion: (row.prompt_version ?? null) as string | null,
    genomeVersion: (row.genome_version ?? null) as string | null,
    createdAt: row.created_at as string,
  };
}
