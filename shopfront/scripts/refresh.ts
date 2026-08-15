#!/usr/bin/env tsx
/**
 * pnpm refresh <slug> [--apply]   ·   pnpm refresh --all [--apply]
 *
 * What a live shop does when its catalogue moves under it.
 *
 * Prices and stock already flow through without this — the renderer resolves
 * both from the store's catalogue rather than from the config, so re-ingesting
 * a merchant updates every shop they have published at once. What does not flow
 * through is the *selection*: the products chosen, in the order chosen. A shop
 * whose first three cards sold out last week is still leading with them.
 *
 * So this reads the drift, decides, and mends what can be mended. It says what
 * it would do and does nothing until `--apply`, because a shop is a public URL
 * and a surprise edit to one is worse than a stale card.
 *
 * It does not regenerate. Where the damage is past mending it says so and
 * prints the command, because regenerating costs a model call and picks
 * products afresh — a decision that belongs to a person and to `pnpm generate`,
 * not to a maintenance script running unattended.
 *
 * Run `pnpm ingest <url> --fresh` first. This compares against the newest
 * catalogue on disk and falls back to the one the shop is already serving; it
 * does not crawl, because "when to re-read a merchant" and "what to do about
 * what changed" are two decisions and folding them together means neither can
 * be run alone.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultStore, publishShop, type ShopStore } from "../src/lib/publish/index";
import type { PublishedShop, PublishedShopSummary } from "../src/lib/publish/types";
import { refreshShop } from "../src/lib/smart/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import { IngestResult } from "../src/lib/ingest/types";

interface Args {
  slug?: string;
  apply: boolean;
  all: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, all: false };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--all") args.all = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else args.slug = arg;
  }
  if (!args.slug && !args.all) {
    throw new Error("Usage: pnpm refresh <slug> [--apply]   ·   pnpm refresh --all [--apply]");
  }
  return args;
}

const out = (line = "") => process.stdout.write(`${line}\n`);

async function candidates(store: ShopStore, args: Args): Promise<PublishedShopSummary[]> {
  const all = await store.listPublished(500);
  if (args.slug) return all.filter((shop) => shop.slug === args.slug);
  // `--all` means every *live* shop. A pinned one holds for the same reason
  // every time, which is noise rather than information.
  return all.filter((shop) => shop.refresh === "live");
}

/**
 * The newest ingest of this shop's store that exists on disk.
 *
 * Validated on the way in rather than cast. A cache file is written by another
 * command and edited by hand more often than anyone admits, and a malformed one
 * would otherwise reach the drift comparison as a catalogue with no products —
 * which reads as "everything was delisted" and is the single worst thing this
 * script could conclude.
 */
async function freshIngest(shop: PublishedShop): Promise<IngestResult | null> {
  const file = path.join(
    ".cache",
    "ingest",
    `${storeCacheKey(normaliseStoreUrl(shop.config.brand.storeUrl))}.json`,
  );
  try {
    return IngestResult.parse(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const store = defaultStore();
  const shops = await candidates(store, args);

  if (shops.length === 0) {
    out(args.slug ? `No published shop at "${args.slug}".` : "No shops are set to live.");
    process.exit(1);
  }

  out();
  let mended = 0;

  for (const summary of shops) {
    const shop = await store.loadBySlug(summary.slug);
    if (!shop) continue;

    const ingest = await freshIngest(shop);
    const catalogue = ingest?.catalogue ?? shop.catalogue;
    const outcome = refreshShop({ config: shop.config, catalogue, policy: shop.refresh });

    out(`  ${shop.slug}  ·  v${shop.version}  ·  ${shop.refresh}`);
    out(`    ${outcome.decision.action.padEnd(11)} ${outcome.decision.reason}`);
    if (!ingest) out("      (no newer ingest on disk — compared against what the page is serving)");

    for (const handle of outcome.dropped) out(`      − ${handle} (delisted)`);
    for (const handle of outcome.demoted) out(`      ↓ ${handle} (sold out, moved back)`);

    if (outcome.decision.action === "regenerate") {
      out(`      → pnpm generate ${shop.config.brand.storeUrl} "${shop.config.meta.prompt}" --slug ${shop.slug}`);
    }

    if (outcome.decision.action === "repair" && outcome.config) {
      if (!args.apply) {
        out("      (dry run — pass --apply to publish this)");
      } else {
        await apply(store, shop, outcome.config, ingest);
        mended++;
        out(`      applied — v${shop.version + 1}`);
      }
    }

    out();
  }

  if (args.apply && mended > 0) out(`  ${mended} shop${mended === 1 ? "" : "s"} mended.`);
  out();
}

/**
 * Publish the mended config as a new version.
 *
 * Two paths, and the difference is whether there is a newer catalogue to store.
 *
 * With one, this goes through `publishShop`, which upserts the store row — and
 * that write is the point rather than a side effect. The repair was computed
 * against the fresh catalogue, so a page still serving the old one would render
 * a config that disagrees with the stock it resolves against.
 *
 * Without one, nothing about the store has changed and `addVersion` is the
 * whole job. Manufacturing an `IngestResult` to reach `publishShop` would mean
 * writing a store row out of fields invented for the purpose, which is the kind
 * of shortcut that ends up as a fabricated `ingestedAt` on somebody's page.
 *
 * Either way it appends. Overwriting the current version would orphan the
 * funnel events keyed to it, and a merchant who preferred the page before the
 * mend could not get it back.
 */
async function apply(
  store: ShopStore,
  shop: PublishedShop,
  config: PublishedShop["config"],
  ingest: IngestResult | null,
): Promise<void> {
  if (ingest) {
    await publishShop({ config, ingest, slug: shop.slug, plan: shop.plan }, { store });
    return;
  }

  const record = await store.findShopBySlug(shop.slug);
  if (!record) throw new Error(`Lost the shop record for "${shop.slug}" between reading and writing it.`);

  await store.addVersion({
    shopId: record.id,
    config,
    prompt: config.meta.prompt,
    audience: config.meta.audience ?? null,
    // Null, honestly. No model answered — this version is the output of the
    // repair rules in `lib/smart`, and attributing it to whichever model
    // produced the version it was mended from would misfile it in exactly the
    // query provenance exists to serve.
    model: null,
    promptVersion: null,
    genomeVersion: null,
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n\n`);
  process.exit(1);
});
