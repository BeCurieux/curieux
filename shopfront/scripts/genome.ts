#!/usr/bin/env tsx
/**
 * pnpm genome <store-url> [options]
 *
 * Step 2 on its own: read a cached ingest, enrich it, store the Genome beside
 * the catalogue. Separate from `merchandise` because it is a per-store cost
 * rather than a per-shop one — a merchant generates twenty shops from one
 * catalogue read, and paying for the read twenty times would be a bug.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore, IngestError } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";
import { enrichCatalogue, GenomeError, createAnthropicGenomeProvider, createMockGenomeProvider } from "../src/lib/genome/index";
import { saveGenome, staleFor } from "../src/lib/genome/store";
import type { CatalogueGenome } from "../src/lib/genome/types";

interface Args {
  url: string;
  provider?: "anthropic" | "mock";
  quiet: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { url: "", quiet: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--provider": {
        const value = argv[++i];
        if (value !== "anthropic" && value !== "mock") throw new Error("--provider must be anthropic or mock");
        args.provider = value;
        break;
      }
      case "--quiet":
        args.quiet = true;
        break;
      case "--json":
        args.json = true;
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        args.url = arg;
    }
  }
  if (!args.url) throw new Error("Usage: pnpm genome <store-url> [--provider anthropic|mock] [--json]");
  return args;
}

async function loadIngest(url: string): Promise<IngestResult> {
  const file = path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(url))}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as IngestResult;
  } catch {
    return ingestStore(url);
  }
}

function summarise(genome: CatalogueGenome, ingest: IngestResult): string {
  const lines: string[] = [];
  const { diagnostics: d } = genome;

  lines.push(`${ingest.brand.name} — ${genome.products.length} products enriched`);
  lines.push(`  read          ${genome.catalogueRead}`);
  lines.push(`  by            ${d.model} (${d.attempts} attempt${d.attempts === 1 ? "" : "s"})`);
  if (d.usage) lines.push(`  tokens        ${d.usage.inputTokens} in, ${d.usage.outputTokens} out`);

  const bands = genome.priceBands;
  lines.push(
    bands.entryBelow === null
      ? "  price bands   not computed — too few distinct prices to split"
      : `  price bands   entry <${bands.entryBelow} · core <${bands.coreBelow} · premium <${bands.premiumBelow} · flagship above`,
  );

  lines.push("");
  lines.push(`  ${count(genome, "role", "hero")} heroes · ${count(genome, "role", "supporting")} supporting · ${count(genome, "role", "add-on")} add-ons`);
  lines.push(
    `  photography   ${count(genome, "photo", "strong")} strong · ${count(genome, "photo", "adequate")} adequate · ${count(genome, "photo", "weak")} weak · ${count(genome, "photo", "none")} none`,
  );

  const related = genome.products.filter((p) => p.complements.length + p.substitutes.length > 0).length;
  lines.push(`  relationships ${related} of ${genome.products.length} products relate to another`);

  const stale = staleFor(genome, ingest.catalogue);
  if (!stale.complete) lines.push(`  coverage      ${stale.missing.length} catalogue products not covered`);

  for (const [index, errors] of d.rejected.entries()) {
    lines.push("");
    lines.push(`  attempt ${index + 1} rejected:`);
    for (const error of errors.slice(0, 6)) lines.push(`    × ${error}`);
  }
  if (d.warnings.length) {
    lines.push("");
    for (const warning of d.warnings) lines.push(`  ! ${warning}`);
  }
  return lines.join("\n");
}

function count(genome: CatalogueGenome, field: "role" | "photo", value: string): number {
  return genome.products.filter((p) => (field === "role" ? p.role : p.photography.rating) === value).length;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ingest = await loadIngest(args.url);

  const started = Date.now();
  const genome = await enrichCatalogue(ingest, {
    ...(args.provider
      ? {
          provider:
            args.provider === "anthropic"
              ? createAnthropicGenomeProvider()
              : createMockGenomeProvider(ingest.catalogue.products),
        }
      : {}),
  });

  const key = storeCacheKey(normaliseStoreUrl(args.url));
  const file = await saveGenome(key, genome);

  if (!args.quiet) {
    process.stderr.write(`enriched in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
    process.stderr.write(`${summarise(genome, ingest)}\n\nstored at ${file}\n`);
  }
  if (args.json) process.stdout.write(`${JSON.stringify(genome, null, 2)}\n`);
}

main().catch((error: unknown) => {
  if (error instanceof GenomeError) {
    process.stderr.write(`\n${error.message}\n`);
    for (const [index, errors] of error.attempts.entries()) {
      process.stderr.write(`\n  attempt ${index + 1}:\n`);
      for (const message of errors.slice(0, 8)) process.stderr.write(`    × ${message}\n`);
    }
    process.stderr.write("\n");
    process.exit(1);
  }
  if (error instanceof IngestError) {
    process.stderr.write(`\n${error.message}\n\n`);
    process.exit(1);
  }
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
