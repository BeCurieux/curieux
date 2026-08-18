#!/usr/bin/env tsx
/**
 * pnpm supabase:setup
 *
 * Apply the schema, prove the row-level security, and — the part nothing else
 * does — exercise the adapter against real PostgREST.
 *
 * `supabase.ts` has said of itself since it was written that it is
 * "typechecked against the real client and exercised against nothing", and
 * `tests/publish-supabase-contract.test.ts` closed half of that gap by
 * cross-checking every table and column name against `schema.sql`. The half it
 * cannot close is behaviour: whether `upsert` with `onConflict` does what the
 * code expects, what `maybeSingle` returns, whether the embedded-resource
 * select comes back nested the way `listPublished` unwraps it. Those need
 * PostgREST on the other end, which means a real project, which means this
 * script rather than a test.
 *
 * Safe against a project with merchants in it:
 *
 *   * `schema.sql` is `create table if not exists` throughout, and the two
 *     `drop policy` statements are there deliberately to clean up projects
 *     created before those policies were removed.
 *   * `rls-check.sql` runs inside a transaction it rolls back.
 *   * Every row this script writes is namespaced under a probe store URL and
 *     deleted in a `finally`, cascading to its shops and versions. It touches
 *     nothing it did not create.
 *
 * It is idempotent. Run it after creating the project, and again any time the
 * schema changes.
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createSupabaseStore, serviceRoleClient } from "../src/lib/publish/supabase";
import { createSupabaseEarlyAccessStore } from "../src/lib/earlyaccess/store";
import type { Catalogue } from "../src/lib/ingest/types";
import type { ShopConfig } from "../src/lib/schema";

const ok = (m: string) => process.stdout.write(`  ✓ ${m}\n`);
const bad = (m: string) => process.stderr.write(`  × ${m}\n`);
const step = (m: string) => process.stdout.write(`\n${m}\n`);

/**
 * Namespaced so a human reading the table knows what it is, and so cleanup can
 * be exact. `.invalid` is reserved by RFC 2606 and can never be a real store.
 */
const PROBE_STORE = "https://supabase-setup-probe.invalid";
const PROBE_SLUG = `setup-probe-${randomUUID().slice(0, 8)}`;
const PROBE_EMAIL = "probe@supabase-setup-probe.invalid";

/**
 * `--no-psql`: run step 3 alone, against a database whose SQL was applied by
 * hand.
 *
 * Steps 1 and 2 shell out to `psql`, which is not on a Windows machine unless
 * somebody installed PostgreSQL on it — and the person setting this project up
 * is on Windows. Installing a database server to apply two files that the
 * Supabase dashboard has a SQL editor for is a poor trade, and it was enough
 * friction to leave `/contact` answering 503 for a day.
 *
 * So this flag skips both, and the flag matters because **step 3 is the part
 * nothing else does**: `schema.sql` in the SQL editor proves the tables exist,
 * and proves nothing about whether `upsert` with `onConflict` behaves the way
 * `supabase.ts` assumes, or whether the embedded select comes back in the shape
 * `listPublished` unwraps. Those need PostgREST on the other end. Losing them
 * because psql was missing would be losing the reason the script exists.
 *
 * What it costs: the RLS proof in step 2 does not run, so `rls-check.sql` has
 * to be pasted into the editor too — it reports its own pass, and this prints
 * the reminder rather than assuming somebody remembered.
 */
const NO_PSQL = process.argv.includes("--no-psql");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    bad(`${name} is not set.`);
    process.exit(1);
  }
  return value;
}

/**
 * Both streams, joined.
 *
 * `raise notice` — which is how `rls-check.sql` reports its pass — goes to
 * **stderr**, not stdout. Reading only stdout made this script call a passing
 * check a failure, which it did on the first run against a real database. So
 * the two are captured together and the caller matches against both.
 */
function psql(dbUrl: string, args: string[]): string {
  const result = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) throw result.error;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) throw new Error(`psql exited ${result.status}:\n${output.slice(-1200)}`);
  return output;
}

/** The smallest catalogue and config the schema will accept. */
function probeCatalogue(): Catalogue {
  return {
    products: [
      {
        handle: "probe-item",
        title: "Probe Item",
        description: "Written by pnpm supabase:setup and deleted again.",
        url: `${PROBE_STORE}/products/probe-item`,
        images: [],
        variants: [{ id: "1", title: "Default", price: 1, available: true }],
        tags: [],
        available: true,
      },
    ],
  } as unknown as Catalogue;
}

function probeConfig(): ShopConfig {
  return {
    brand: { name: "Setup Probe", tagline: "Deleted on the next line.", storeUrl: PROBE_STORE },
    theme: {
      colorway: { accent: "#6d3cf5" },
      typography: "editorial-serif",
      mood: "clean",
      density: "regular",
      cornerRadius: "soft",
    },
    blocks: [
      {
        id: "grid",
        block: { type: "productGrid", title: "Probe", products: [{ handle: "probe-item" }], layout: "grid" },
      },
    ],
    meta: { prompt: "a setup probe", generatedAt: new Date().toISOString(), audience: "nobody" },
  } as unknown as ShopConfig;
}

/**
 * Delete the probe rows, with or without psql.
 *
 * The `finally` that calls this is the promise that this script touches
 * nothing it did not create, so it cannot be the thing that needs psql. Both
 * deletes are keyed to the reserved `.invalid` names above, and `shops` and
 * `shop_versions` cascade from `stores` at the database level — which is a
 * foreign key, so it holds through PostgREST exactly as it does through psql.
 */
async function removeProbes(dbUrl: string | null): Promise<void> {
  if (dbUrl) {
    psql(dbUrl, [
      "-c",
      `delete from public.stores where store_url = '${PROBE_STORE}';
       delete from public.early_access where email = '${PROBE_EMAIL}';`,
    ]);
    return;
  }

  const client = serviceRoleClient();
  const stores = await client.from("stores").delete().eq("store_url", PROBE_STORE);
  const emails = await client.from("early_access").delete().eq("email", PROBE_EMAIL);
  const failure = stores.error ?? emails.error;
  if (failure) throw new Error(`probe rows could not be deleted: ${failure.message}`);
}

async function main(): Promise<void> {
  const dbUrl = NO_PSQL ? null : required("SUPABASE_DB_URL");
  required("SUPABASE_URL");
  required("SUPABASE_SERVICE_ROLE_KEY");

  if (dbUrl) {
    step("1. Applying the schema");
    psql(dbUrl, ["-f", "src/lib/publish/schema.sql"]);
    ok("schema.sql applied. It is `create table if not exists` throughout, so this is safe to re-run.");

    step("2. Proving row-level security");
    // The check raises on the first failure and rolls itself back. A silent
    // `RLS check passed` notice is the pass; anything else throws out of psql.
    const rls = psql(dbUrl, ["-f", "src/lib/publish/rls-check.sql"]);
    if (!/RLS check passed/.test(rls)) {
      bad("rls-check.sql did not report a pass. Output:\n" + rls.slice(-800));
      process.exit(1);
    }
    ok("anon reads published shops and nothing else, and writes nothing.");
    ok("early_access is unreadable and unwritable by anon — the one table holding personal data.");
  } else {
    step("1-2. Skipped — --no-psql");
    process.stdout.write(
      "  Run these two in the Supabase dashboard's SQL editor, in this order:\n" +
        "    src/lib/publish/schema.sql     — creates the tables. Safe to re-run.\n" +
        "    src/lib/publish/rls-check.sql  — must return one row reading `RLS check passed`.\n" +
        "                                     Rolls itself back, so it changes nothing.\n" +
        "  Step 3 below fails against a database that has not had the first one applied, so\n" +
        "  it is not possible to skip that by accident. The RLS proof is not covered by\n" +
        "  anything here — read the row the second file returns yourself. A result grid\n" +
        "  saying `Success. No rows returned` means you ran an older copy of that file.\n",
    );
  }

  step("3. Exercising the adapter against real PostgREST");
  const store = createSupabaseStore();
  const early = createSupabaseEarlyAccessStore(serviceRoleClient());
  const ingestedAt = new Date().toISOString();

  try {
    // upsert + onConflict. Twice on purpose: the second call must update the
    // same row rather than raise a duplicate-key error, which is the whole
    // reason `onConflict: "store_url"` is there and the thing a contract test
    // cannot check.
    const first = await store.upsertStore({ storeUrl: PROBE_STORE, catalogue: probeCatalogue(), ingestedAt });
    const second = await store.upsertStore({ storeUrl: PROBE_STORE, catalogue: probeCatalogue(), ingestedAt });
    if (first.id !== second.id) throw new Error("upsert created a second row instead of updating the first");
    ok("upsert with onConflict updates rather than duplicates.");

    // maybeSingle on a hit and on a miss.
    const found = await store.findStoreByUrl(PROBE_STORE);
    if (!found) throw new Error("findStoreByUrl returned null for a store that was just written");
    const missing = await store.findStoreByUrl("https://definitely-not-here.invalid");
    if (missing !== null) throw new Error("findStoreByUrl returned something for a store that does not exist");
    ok("maybeSingle returns the row on a hit and null on a miss.");

    const shop = await store.createShop({ storeId: first.id, slug: PROBE_SLUG, plan: "free" });
    const version = await store.addVersion({
      shopId: shop.id,
      config: probeConfig(),
      prompt: "a setup probe",
      audience: "nobody",
    });
    if (version.version !== 1) throw new Error(`first version numbered ${version.version}, expected 1`);
    ok("createShop and addVersion round-trip, and versions start at 1.");

    if (!(await store.slugTaken(PROBE_SLUG))) throw new Error("slugTaken said no for a slug just created");
    ok("slugTaken sees a published slug.");

    // `get_published_shop` — the one path an anon key is meant to reach, and
    // the only place the Genome could leak. Read here through the service role
    // because the check above already proved the anon posture.
    const published = await store.loadBySlug(PROBE_SLUG);
    if (!published) throw new Error("loadBySlug returned null for a shop that was just published");
    // Through `unknown`: `PublishedShop` has no `genome` field by design, so
    // TypeScript is right that the cast is odd. The check is about what the
    // database actually returned at runtime, which the type cannot speak to.
    if ("genome" in (published as unknown as Record<string, unknown>)) {
      throw new Error("loadBySlug returned a genome field. The Genome must never leave the server.");
    }
    ok("loadBySlug resolves through get_published_shop and carries no Genome.");

    // The embedded-resource select, which is the shape most likely to come
    // back nested differently than `listPublished` unwraps it.
    const listed = await store.listPublished(50);
    if (!listed.some((entry) => entry.slug === PROBE_SLUG)) {
      throw new Error("listPublished did not include the shop just published — check the embedded select shape");
    }
    ok("listPublished unwraps its embedded resource correctly.");

    const record = await early.record({
      name: "Setup Probe",
      email: PROBE_EMAIL,
      store: "supabase-setup-probe.invalid",
      brief: "Written by pnpm supabase:setup and deleted again.",
    });
    if (!record.id) throw new Error("early-access insert returned no id");
    if (!(await early.list()).some((r) => r.email === PROBE_EMAIL)) {
      throw new Error("early-access row did not come back from list()");
    }
    ok("the contact form's table accepts a row and reads it back.");
  } finally {
    step("4. Removing the probe rows");
    await removeProbes(dbUrl);
    ok("probe rows deleted. Nothing this script did not create was touched.");
  }

  step("Done. The database is ready.");
  process.stdout.write(
    "\nNext: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the deployment\n" +
      "(server-only — never NEXT_PUBLIC_), then run `pnpm deploy:check`.\n",
  );
}

try {
  await main();
} catch (error: unknown) {
  bad(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
