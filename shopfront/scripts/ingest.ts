#!/usr/bin/env tsx
/**
 * pnpm ingest <store-url> [options]
 *
 * Step 1 of `pnpm generate`, runnable on its own — because the way this gets
 * good is by pointing it at real storefronts and reading what came back, and
 * that loop is much tighter without a model call in the middle of it.
 *
 * The JSON goes to stdout (or --out); the human summary goes to stderr. So
 * `pnpm ingest allbirds.com > catalogue.json` shows you the summary while
 * writing the file.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore, IngestError } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";

interface Args {
  url: string;
  out?: string;
  limit?: number;
  fresh: boolean;
  render: boolean;
  robots: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { url: "", fresh: false, render: true, robots: true, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
        args.out = argv[++i];
        break;
      case "--limit":
        args.limit = Number.parseInt(argv[++i] ?? "", 10);
        break;
      case "--fresh":
        args.fresh = true;
        break;
      case "--no-render":
        args.render = false;
        break;
      case "--no-robots":
        // For a merchant who has connected their own store. See robots.ts.
        args.robots = false;
        break;
      case "--quiet":
        args.quiet = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        if (!args.url) args.url = arg;
    }
  }
  if (!args.url) throw new Error("Usage: pnpm ingest <store-url> [--out file] [--fresh] [--no-render] [--limit n]");
  return args;
}

/**
 * Ingests are cached by host.
 *
 * Iterating on the merchandiser means running the same store twenty times in
 * an afternoon, and re-fetching somebody else's storefront twenty times to
 * get an identical answer is both slow and rude. `--fresh` skips it.
 */
function cachePath(url: string): string {
  return path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(url))}.json`);
}

async function readCache(file: string): Promise<IngestResult | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as IngestResult;
  } catch {
    return null;
  }
}

function summarise(result: IngestResult): string {
  const lines: string[] = [];
  const { brand, catalogue, store, reviews, diagnostics } = result;
  const money = (n: number) => `${catalogue.currency ? `${catalogue.currency} ` : ""}${n.toFixed(2)}`;
  const prices = catalogue.products.map((p) => p.price.min);
  const soldOut = catalogue.products.filter((p) => !p.available).length;
  const noImages = catalogue.products.filter((p) => p.images.length === 0).length;

  lines.push(`${brand.name} — ${store.storeUrl}`);
  if (brand.tagline) lines.push(`  "${brand.tagline}"`);
  lines.push(`  source        ${store.catalogueSource}${catalogue.truncated ? " (truncated)" : ""}`);
  lines.push(`  products      ${catalogue.productCount}${soldOut ? `, ${soldOut} sold out` : ""}${noImages ? `, ${noImages} with no imagery` : ""}`);
  if (prices.length) lines.push(`  prices        ${money(Math.min(...prices))} – ${money(Math.max(...catalogue.products.map((p) => p.price.max)))}`);
  lines.push(`  logo          ${brand.logoUrl ?? "none found"}`);
  lines.push(`  colourway     ${Object.entries(brand.suggestedColorway).map(([k, v]) => `${k[0]}:${v}`).join("  ")}`);
  lines.push(`  voice         ${brand.voice.headings.length} headings, ${brand.voice.sentences.length} sentences`);
  lines.push(`  reviews       not ingested${reviews.platformDetected ? ` (${reviews.platformDetected} detected)` : ""}`);
  if (diagnostics.warnings.length) {
    lines.push("");
    for (const warning of diagnostics.warnings) lines.push(`  ! ${warning}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const file = cachePath(args.url);

  let result = args.fresh ? null : await readCache(file);
  if (result && !args.quiet) process.stderr.write(`(cached — pass --fresh to re-fetch)\n`);

  if (!result) {
    const started = Date.now();
    result = await ingestStore(args.url, {
      ...(args.limit && Number.isFinite(args.limit) ? { maxProducts: args.limit } : {}),
      ...(args.render ? {} : { renderer: null }),
      ...(args.robots ? {} : { respectRobots: false }),
    });
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(result, null, 2));
    if (!args.quiet) process.stderr.write(`ingested in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  }

  if (!args.quiet) process.stderr.write(`${summarise(result)}\n`);

  const json = JSON.stringify(result, null, 2);
  if (args.out) {
    await writeFile(args.out, json);
    if (!args.quiet) process.stderr.write(`\nwritten to ${args.out}\n`);
  } else if (!process.stdout.isTTY) {
    process.stdout.write(`${json}\n`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof IngestError) {
    process.stderr.write(`\n${error.message}\n\n`);
    // The trace is the whole point of failing here rather than throwing a
    // stack: it says which rungs were tried and what each one answered.
    for (const entry of error.trace) {
      const detail = [entry.url, entry.detail].filter(Boolean).join(" — ");
      process.stderr.write(`  ${entry.outcome.padEnd(8)}${entry.step.padEnd(24)}${detail}\n`);
    }
    process.exit(1);
  }
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
