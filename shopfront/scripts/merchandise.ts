#!/usr/bin/env tsx
/**
 * pnpm merchandise <store-url> "<prompt>" [options]
 *
 * Steps 1 and 2 end to end: ingest the store (cached), then merchandise it
 * into a ShopConfig. The config goes to stdout; the summary goes to stderr.
 *
 * Not `pnpm generate` — that is the definition of done for Sprints 1-2 and it
 * ends in a published URL, which needs the renderer and Supabase. Calling this
 * `generate` would be claiming a shop exists when what exists is its plan.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore, IngestError } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";
import { merchandise, MerchandiseError, createAnthropicProvider, createMockProvider } from "../src/lib/merchandise/index";
import type { ShopConfig } from "../src/lib/schema";

interface Args {
  url: string;
  prompt: string;
  out?: string;
  provider?: "anthropic" | "mock";
  fresh: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { url: "", prompt: "", fresh: false, quiet: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
        args.out = argv[++i];
        break;
      case "--provider": {
        const value = argv[++i];
        if (value !== "anthropic" && value !== "mock") throw new Error(`--provider must be anthropic or mock`);
        args.provider = value;
        break;
      }
      case "--fresh":
        args.fresh = true;
        break;
      case "--quiet":
        args.quiet = true;
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  args.url = positional[0] ?? "";
  args.prompt = positional.slice(1).join(" ");
  if (!args.url || !args.prompt) {
    throw new Error('Usage: pnpm merchandise <store-url> "<prompt>" [--provider anthropic|mock] [--out file] [--fresh]');
  }
  return args;
}

async function loadIngest(url: string, fresh: boolean, quiet: boolean): Promise<IngestResult> {
  const file = path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(url))}.json`);
  if (!fresh) {
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as IngestResult;
      if (!quiet) process.stderr.write(`using cached ingest of ${cached.store.storeUrl}\n`);
      return cached;
    } catch {
      // No cache yet — fall through and fetch.
    }
  }
  const result = await ingestStore(url);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(result, null, 2));
  return result;
}

function summarise(config: ShopConfig, diagnostics: Awaited<ReturnType<typeof merchandise>>["diagnostics"]): string {
  const lines: string[] = [];
  lines.push(`${config.brand.name} — ${config.blocks.length} blocks`);
  if (config.meta.audience) lines.push(`  for           ${config.meta.audience}`);
  lines.push(`  by            ${diagnostics.model} (${diagnostics.attempts} attempt${diagnostics.attempts === 1 ? "" : "s"})`);
  if (diagnostics.usage) {
    lines.push(`  tokens        ${diagnostics.usage.inputTokens} in, ${diagnostics.usage.outputTokens} out`);
  }
  lines.push(
    `  catalogue     ${diagnostics.catalogue.offered} products offered${diagnostics.catalogue.omitted ? `, ${diagnostics.catalogue.omitted} withheld` : ""}${diagnostics.catalogue.descriptions ? "" : ", no descriptions"}`,
  );
  lines.push(
    `  theme         ${config.theme.mood} · ${config.theme.typography} · ${config.theme.density} · ${config.theme.colorway.background} ${config.theme.colorway.accent}`,
  );
  lines.push("");
  for (const [index, entry] of config.blocks.entries()) {
    lines.push(`  ${String(index + 1).padStart(2)}. ${describeBlock(entry)}`);
  }

  for (const [index, errors] of diagnostics.rejected.entries()) {
    lines.push("");
    lines.push(`  attempt ${index + 1} rejected:`);
    for (const error of errors) lines.push(`    × ${error}`);
  }
  if (diagnostics.warnings.length) {
    lines.push("");
    for (const warning of diagnostics.warnings) lines.push(`  ! ${warning}`);
  }
  return lines.join("\n");
}

function describeBlock({ id, block }: ShopConfig["blocks"][number]): string {
  const label = `${block.type.padEnd(12)}${id.padEnd(14)}`;
  switch (block.type) {
    case "hero":
      return `${label}"${block.headline}"`;
    case "productGrid":
      return `${label}${block.products.length} products, ${block.layout}${block.title ? ` — "${block.title}"` : ""}`;
    case "routine":
      return `${label}${block.steps.length} steps — "${block.title}"`;
    case "drop":
      return `${label}${block.products.length} products — "${block.title}"`;
    case "offer":
      return `${label}${block.code}`;
    case "linkList":
      return `${label}${block.links.length} links`;
    default:
      return label;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ingest = await loadIngest(args.url, args.fresh, args.quiet);

  const started = Date.now();
  const result = await merchandise(ingest, args.prompt, {
    ...(args.provider
      ? { provider: args.provider === "anthropic" ? createAnthropicProvider() : createMockProvider() }
      : {}),
  });

  if (!args.quiet) {
    process.stderr.write(`merchandised in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
    process.stderr.write(`${summarise(result.config, result.diagnostics)}\n`);
  }

  const json = JSON.stringify(result.config, null, 2);
  if (args.out) {
    await writeFile(args.out, json);
    if (!args.quiet) process.stderr.write(`\nwritten to ${args.out}\n`);
  } else if (!process.stdout.isTTY) {
    process.stdout.write(`${json}\n`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof MerchandiseError) {
    process.stderr.write(`\n${error.message}\n`);
    for (const [index, errors] of error.attempts.entries()) {
      process.stderr.write(`\n  attempt ${index + 1}:\n`);
      for (const message of errors) process.stderr.write(`    × ${message}\n`);
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
