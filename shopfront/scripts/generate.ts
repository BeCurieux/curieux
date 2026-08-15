#!/usr/bin/env tsx
/**
 * pnpm generate <store-url> "<prompt>" [options]
 *
 * The definition of done for Sprints 1–2, as one command: a store URL and a
 * sentence in, a published shop URL out, with the Genome stored on the way
 * through.
 *
 * Each stage is cached at a different grain because each costs a different
 * thing. The ingest is a crawl of somebody else's storefront and is reused
 * until `--fresh`. The Genome is a model pass over a whole catalogue and is
 * reused until `--regenome`, because a merchant generating twenty shops should
 * pay for one catalogue read. Only the merchandising runs every time — it is
 * the only stage whose answer depends on the prompt.
 *
 * The published page records its own funnel from the first shopper who opens
 * it — `pnpm funnel <slug>` reads it back.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore, IngestError } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";
import { enrichCatalogue, GenomeError } from "../src/lib/genome/index";
import { loadGenome, saveGenome, staleFor } from "../src/lib/genome/store";
import type { CatalogueGenome } from "../src/lib/genome/types";
import { merchandise, MerchandiseError } from "../src/lib/merchandise/index";
import { defaultStore, publishShop, PublishError, checkSlug } from "../src/lib/publish/index";
import { readCreator, type Creator } from "../src/lib/creator";
import type { RefreshPolicy } from "../src/lib/publish/types";
import { genomeVersionOf } from "../src/lib/provenance";
import { PROMPT_VERSION as MERCHANDISE_PROMPT_VERSION } from "../src/lib/merchandise/prompt";
import { PROMPT_VERSION as GENOME_PROMPT_VERSION } from "../src/lib/genome/prompt";

interface Args {
  url: string;
  prompt: string;
  slug?: string;
  plan: "free" | "pro";
  creator?: Creator;
  refresh: RefreshPolicy;
  fresh: boolean;
  regenome: boolean;
  noGenome: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    url: "",
    prompt: "",
    plan: "free",
    refresh: "pinned",
    fresh: false,
    regenome: false,
    noGenome: false,
    quiet: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      /*
       * Attribution, from the person running the command and from nowhere
       * else. `--creator @ana.ruiz --creator-name "Ana Ruiz"` — a profile URL
       * works in place of the handle, because that is what gets pasted.
       *
       * `readCreator` throws on anything it cannot read rather than falling
       * back to something plausible. A mangled handle would publish a real
       * person's name onto a public URL, and it would look fine.
       */
      case "--creator": {
        const value = argv[++i];
        if (!value) throw new Error("--creator needs a handle, e.g. @ana.ruiz");
        // A second `--creator` replaces the first outright rather than merging
        // into it: the name and url that were set belonged to the old handle.
        args.creator = readCreator({ handle: value });
        break;
      }
      case "--creator-name": {
        const value = argv[++i];
        if (!value) throw new Error("--creator-name needs a value");
        if (!args.creator) throw new Error("--creator-name needs --creator first");
        args.creator = readCreator({ ...args.creator, name: value });
        break;
      }
      case "--creator-url": {
        const value = argv[++i];
        if (!value) throw new Error("--creator-url needs a value");
        if (!args.creator) throw new Error("--creator-url needs --creator first");
        args.creator = readCreator({ ...args.creator, url: value });
        break;
      }
      case "--live":
        args.refresh = "live";
        break;
      case "--slug": {
        const value = argv[++i];
        if (!value) throw new Error("--slug needs a value");
        const check = checkSlug(value);
        if (check.ok !== true) throw new Error(check.reason);
        args.slug = value;
        break;
      }
      case "--plan": {
        const value = argv[++i];
        if (value !== "free" && value !== "pro") throw new Error("--plan must be free or pro");
        args.plan = value;
        break;
      }
      case "--fresh":
        args.fresh = true;
        break;
      case "--regenome":
        args.regenome = true;
        break;
      case "--no-genome":
        args.noGenome = true;
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
    throw new Error(
      [
        'Usage: pnpm generate <store-url> "<prompt>" [options]',
        "",
        "  --slug my-shop            the URL, checked and refused rather than mangled",
        "  --plan free|pro           pro removes the badge",
        "  --creator @ana.ruiz       credit this shop to somebody's audience",
        "  --creator-name 'Ana Ruiz' how they are credited on the page",
        "  --creator-url <url>       where the credit links",
        "  --live                    let `pnpm refresh` mend this shop against current stock",
        "  --fresh --regenome --no-genome",
      ].join("\n"),
    );
  }
  return args;
}

const say = (quiet: boolean, message: string) => {
  if (!quiet) process.stderr.write(`${message}\n`);
};

async function stageIngest(url: string, fresh: boolean, quiet: boolean): Promise<IngestResult> {
  const file = path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(url))}.json`);
  if (!fresh) {
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as IngestResult;
      say(quiet, `  1 ingest      cached — ${cached.catalogue.products.length} products`);
      return cached;
    } catch {
      // No cache. Fall through and crawl.
    }
  }
  const result = await ingestStore(url);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(result, null, 2));
  say(quiet, `  1 ingest      ${result.catalogue.products.length} products from ${result.store.storeUrl}`);
  return result;
}

async function stageGenome(
  ingest: IngestResult,
  key: string,
  args: Args,
): Promise<CatalogueGenome | undefined> {
  if (args.noGenome) {
    say(args.quiet, "  2 genome      skipped — selection runs on titles and prices alone");
    return undefined;
  }

  if (!args.regenome) {
    const cached = await loadGenome(key);
    if (cached) {
      const stale = staleFor(cached, ingest.catalogue);
      say(
        args.quiet,
        stale.complete
          ? `  2 genome      cached — ${cached.products.length} products`
          : `  2 genome      cached — ${cached.products.length} products, ${stale.missing.length} in the catalogue not covered (--regenome to refresh)`,
      );
      return cached;
    }
  }

  const genome = await enrichCatalogue(ingest);
  await saveGenome(key, genome);
  say(args.quiet, `  2 genome      ${genome.products.length} products read by ${genome.diagnostics.model}`);
  return genome;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const key = storeCacheKey(normaliseStoreUrl(args.url));

  say(args.quiet, "");
  const ingest = await stageIngest(args.url, args.fresh, args.quiet);
  const genome = await stageGenome(ingest, key, args);

  const merchandised = await merchandise(ingest, args.prompt, { ...(genome ? { genome } : {}) });
  const d = merchandised.diagnostics;
  say(
    args.quiet,
    `  3 merchandise ${merchandised.config.blocks.length} blocks by ${d.model} (${d.attempts} attempt${d.attempts === 1 ? "" : "s"})`,
  );

  const store = defaultStore();
  const published = await publishShop(
    {
      config: merchandised.config,
      ingest,
      genome: genome ?? null,
      // Recorded now because it cannot be recovered later: which model
      // actually answered, and which revision of the prompt was in force.
      provenance: {
        model: d.model,
        promptVersion: MERCHANDISE_PROMPT_VERSION,
        genomeVersion: genome
          ? genomeVersionOf(genome.diagnostics.model, GENOME_PROMPT_VERSION)
          : null,
      },
      ...(args.slug ? { slug: args.slug } : {}),
      plan: args.plan,
      // Only passed when the command said so. `publishShop` leaves a
      // republished shop's attribution and policy alone otherwise.
      ...(args.creator ? { creator: args.creator } : {}),
      ...(args.refresh === "live" ? { refresh: args.refresh } : {}),
    },
    { store },
  );

  say(
    args.quiet,
    `  4 publish     ${published.created ? "created" : "updated"} v${published.shop.version} in the ${store.name} store`,
  );

  if (published.shop.creator) {
    say(args.quiet, `                credited to ${published.shop.creator.name} (@${published.shop.creator.handle})`);
  }
  if (published.shop.refresh === "live") {
    say(args.quiet, "                live — `pnpm refresh` will mend it against current stock");
  }

  for (const warning of d.warnings) say(args.quiet, `  ! ${warning}`);

  say(args.quiet, "");
  say(args.quiet, `  ${published.url}`);
  say(
    args.quiet,
    `  ${((Date.now() - started) / 1000).toFixed(1)}s · ${published.shop.plan} plan${published.shop.plan === "free" ? " (badge on)" : ""}`,
  );

  say(args.quiet, `  funnel recording once it is opened — \`pnpm funnel ${published.shop.slug}\``);
  say(args.quiet, "");

  // The URL alone on stdout, so this composes with anything.
  process.stdout.write(`${published.url}\n`);
}

main().catch((error: unknown) => {
  const detailed = (message: string, attempts: string[][]) => {
    process.stderr.write(`\n${message}\n`);
    for (const [index, errors] of attempts.entries()) {
      process.stderr.write(`\n  attempt ${index + 1}:\n`);
      for (const line of errors.slice(0, 8)) process.stderr.write(`    × ${line}\n`);
    }
    process.stderr.write("\n");
    process.exit(1);
  };

  if (error instanceof MerchandiseError) detailed(error.message, error.attempts);
  if (error instanceof GenomeError) detailed(error.message, error.attempts);
  if (error instanceof PublishError || error instanceof IngestError) {
    process.stderr.write(`\n${error.message}\n\n`);
    process.exit(1);
  }
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
