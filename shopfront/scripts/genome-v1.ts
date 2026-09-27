#!/usr/bin/env tsx
/**
 * Genome v1 (v5's M1) from the command line.
 *
 *   pnpm genome:classify <store-url> [--provider anthropic|mock] [--mode batch|direct]
 *                        [--runs 5] [--limit N] [--no-images] [--featured h1,h2] [--min 5] [--json]
 *   pnpm genome:override <store-url> <handle> <dimension> <value> [value...]
 *   pnpm genome:seed                     publish the taxonomy and price bands to Supabase
 *   pnpm genome:goldset <store-url...> [--file urls.txt] [--set NAME] [--size 200] [--seed 1]
 *   pnpm genome:invite "<labeller name>"   print a labelling link, once
 *   pnpm genome:eval --a <labeller> --b <labeller> [--adjudicator <labeller>] [--set NAME]
 *                    [--model [--provider anthropic|mock] [--mode batch|direct]]
 *
 * Anything that spends money goes through the M1 cap (A$100, `cost.ts`): the
 * estimate is checked before a request is sent and the measured spend is
 * written to `.cache/genome-v1/spend.json` after.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";
import { resolveOrigin } from "../src/lib/origin";
import { storeNameFromEnv } from "../src/lib/publish/store";
import { createAnthropicClassifier } from "../src/lib/genome/v1/anthropic";
import { classifyCatalogue, type ClassifyResult } from "../src/lib/genome/v1/classify";
import { audPerUsd, projectCatalogue, readLedger, spentAud } from "../src/lib/genome/v1/cost";
import {
  adjudicatedGold,
  agreement,
  agreementMarkdown,
  labelShifts,
  modelMarkdown,
  scoreModel,
} from "../src/lib/genome/v1/eval";
import { goldCatalogue, hashToken, newInviteToken, sampleGoldSet, type SampleSource } from "../src/lib/genome/v1/gold";
import { createMockClassifier } from "../src/lib/genome/v1/mock";
import { declare } from "../src/lib/genome/v1/overrides";
import { PROMPT_VERSION } from "../src/lib/genome/v1/prompt";
import type { ClassifierProvider } from "../src/lib/genome/v1/provider";
import type { GenomeValue } from "../src/lib/genome/v1/records";
import { defaultGenomeV1Store, type GenomeV1Store, type Labeller } from "../src/lib/genome/v1/store";
import { isDimensionId, MODEL_DIMENSIONS, TAXONOMY_VERSION } from "../src/lib/genome/v1/taxonomy";

// ------------------------------------------------------------------ args

interface Flags {
  positional: string[];
  values: Map<string, string>;
  switches: Set<string>;
}

const SWITCHES = new Set(["--json", "--no-images", "--model"]);

function parse(argv: string[]): Flags {
  const flags: Flags = { positional: [], values: new Map(), switches: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (SWITCHES.has(arg)) flags.switches.add(arg);
    else if (arg.startsWith("--")) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      flags.values.set(arg, value);
    } else flags.positional.push(arg);
  }
  return flags;
}

const out = (line = "") => process.stderr.write(`${line}\n`);
const money = (usd: number) => `US$${usd.toFixed(4)} ≈ A$${(usd * audPerUsd()).toFixed(4)}`;

// --------------------------------------------------------------- helpers

async function loadIngest(url: string): Promise<IngestResult> {
  const file = path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(url))}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as IngestResult;
  } catch {
    return ingestStore(url);
  }
}

function provider(flags: Flags): ClassifierProvider {
  const name = flags.values.get("--provider") ?? (process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "mock");
  if (name === "mock") return createMockClassifier();
  if (name !== "anthropic") throw new Error("--provider must be anthropic or mock");
  // Direct by default: with the prompt cache warm it measured half the cost of
  // batch, and eight times faster (see src/lib/genome/v1/anthropic.ts).
  const mode = flags.values.get("--mode") ?? "direct";
  if (mode !== "batch" && mode !== "direct") throw new Error("--mode must be batch or direct");
  return createAnthropicClassifier({ mode });
}

async function labellerByNameOrId(store: GenomeV1Store, key: string | undefined): Promise<Labeller | undefined> {
  if (!key) return undefined;
  const all = await store.listLabellers();
  const found = all.filter((l) => l.id === key || l.name.toLowerCase() === key.toLowerCase());
  if (found.length !== 1) throw new Error(found.length ? `"${key}" matches ${found.length} labellers; use the id.` : `No labeller "${key}".`);
  return found[0];
}

function costSummary(result: ClassifyResult, p: ClassifierProvider): string[] {
  const lines: string[] = [];
  if (p.billing === "free") return ["  cost          none (mock)"];
  lines.push(`  tokens        ${result.usage.inputTokens} in, ${result.usage.cacheReadTokens} cache-read, ${result.usage.cacheWriteTokens} cache-write, ${result.usage.outputTokens} out`);
  lines.push(`  spent         ${money(result.usd)} (${p.billing} pricing)`);
  if (result.usdPerProductRun !== null) {
    // Projected at the mode that was measured only. Batch and direct cache
    // differently, so halving a direct run's cost does not give the batch
    // price (it measured higher, not lower).
    const perRun = result.usdPerProductRun;
    lines.push(`  per product   ${money(perRun * 5)} at 5 runs`);
    const at = projectCatalogue(perRun, 5, 2000);
    lines.push(`  2,000 SKUs    US$${at.usd.toFixed(2)} ≈ A$${at.aud.toFixed(2)} at 5 runs (${p.billing === "batch" ? "batch" : "direct"}, as measured)`);
  }
  if (result.ledger) lines.push(`  M1 budget     A$${spentAud(result.ledger).toFixed(2)} of A$${result.ledger.capAud} spent`);
  lines.push(`  rate          ${audPerUsd()} AUD/USD (assumed; set AUD_PER_USD)`);
  return lines;
}

// -------------------------------------------------------------- commands

async function classify(flags: Flags): Promise<void> {
  const url = flags.positional[0];
  if (!url) throw new Error("Usage: pnpm genome:classify <store-url> [--provider anthropic|mock] [--mode batch|direct] [--runs 5] [--limit N]");
  const ingest = await loadIngest(url);
  const storeUrl = ingest.store.storeUrl;
  const store = await defaultGenomeV1Store();
  const previous = await store.loadClassification(storeUrl).catch(() => ({ products: [], values: [] }));
  const p = provider(flags);
  const started = Date.now();

  const result = await classifyCatalogue({
    storeUrl,
    catalogue: ingest.catalogue,
    provider: p,
    runs: Number(flags.values.get("--runs") ?? 5),
    limit: flags.values.has("--limit") ? Number(flags.values.get("--limit")) : undefined,
    images: !flags.switches.has("--no-images"),
    previous,
    merchant: {
      featured: new Set((flags.values.get("--featured") ?? "").split(",").filter(Boolean)),
      merchantMin: flags.values.has("--min") ? Number(flags.values.get("--min")) : undefined,
    },
    label: `classify ${storeUrl}`,
    onProgress: (m) => out(`  … ${m}`),
  });
  await store.saveClassification(storeUrl, result.products, result.values);

  const runFile = path.join(".cache", "genome-v1", "runs", `${storeCacheKey(normaliseStoreUrl(url))}-${Date.now()}.json`);
  await mkdir(path.dirname(runFile), { recursive: true });
  await writeFile(runFile, JSON.stringify({ storeUrl, provider: p.name, promptVersion: PROMPT_VERSION, ...result }, null, 2));

  out(`${ingest.brand.name}: ${result.products.length} products, ${result.requests} requests, ${result.reused} reused, in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  out(`  by            ${p.name} · ${TAXONOMY_VERSION} · prompt ${PROMPT_VERSION}`);
  out(`  stored        ${store.name}`);
  if (result.failedRuns.length) {
    out(`  failed runs   ${result.failedRuns.length}`);
    for (const f of result.failedRuns.slice(0, 8)) out(`    × ${f.handle} run ${f.run}: ${f.error}`);
  }
  for (const line of costSummary(result, p)) out(line);
  out("");
  for (const product of result.products.slice(0, 6)) {
    const rows = result.values.filter((v) => v.handle === product.handle);
    out(`  ${product.title}  [${product.parentCategory ?? "category split"}]`);
    for (const dim of [...MODEL_DIMENSIONS, "price_band", "price_position", "inventory_depth", "assortment_role"]) {
      const vs = rows.filter((r) => r.dimension === dim);
      out(`    ${dim.padEnd(16)} ${vs.map((v) => `${v.value}${v.runAgreement ? ` (${v.runAgreement})` : ""}`).join(", ")}`);
    }
  }
  out(`\n  run written to ${runFile}`);
  if (flags.switches.has("--json")) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function override(flags: Flags): Promise<void> {
  const [url, handle, dim, ...values] = flags.positional;
  if (!url || !handle || !dim || !values.length) throw new Error("Usage: pnpm genome:override <store-url> <handle> <dimension> <value> [value...]");
  if (!isDimensionId(dim)) throw new Error(`No dimension "${dim}" in ${TAXONOMY_VERSION}.`);
  const ingest = await loadIngest(url);
  const rows = declare({
    storeUrl: ingest.store.storeUrl,
    handle,
    dimension: dim,
    values,
    catalogueHandles: new Set(ingest.catalogue.products.map((p) => p.handle)),
  });
  const store = await defaultGenomeV1Store();
  await store.saveDeclaration(ingest.store.storeUrl, handle, dim, rows);
  out(`${handle}: ${dim} declared as ${values.join(", ")} (merchant_declared, wins over the model).`);
}

async function seed(): Promise<void> {
  if (storeNameFromEnv() !== "supabase") {
    throw new Error("genome:seed publishes to Supabase; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The local store needs no seeding.");
  }
  const { seedTaxonomy } = await import("../src/lib/genome/v1/store-supabase");
  const n = await seedTaxonomy();
  out(`${TAXONOMY_VERSION}: ${n.values} values and ${n.bands} price band rows published.`);
}

async function goldset(flags: Flags): Promise<void> {
  const urls = [...flags.positional];
  const file = flags.values.get("--file");
  if (file) urls.push(...(await readFile(file, "utf8")).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
  if (!urls.length) throw new Error("Usage: pnpm genome:goldset <store-url...> [--file urls.txt] [--set NAME] [--size 200] [--seed 1]");
  const goldSet = flags.values.get("--set") ?? `gold-${new Date().toISOString().slice(0, 10)}`;
  const store = await defaultGenomeV1Store();

  const sources: SampleSource[] = [];
  for (const url of urls) {
    try {
      const ingest = await loadIngest(url);
      const classified = await store.loadClassification(ingest.store.storeUrl).catch(() => ({ products: [], values: [] }));
      const categories = classified.products.length ? new Map(classified.products.map((p) => [p.handle, p.parentCategory])) : undefined;
      sources.push({ storeUrl: ingest.store.storeUrl, catalogue: ingest.catalogue, categories });
      out(`  ✓ ${ingest.store.storeUrl}: ${ingest.catalogue.products.length} products${categories ? ", classified" : ""}`);
    } catch (error) {
      out(`  × ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const sample = sampleGoldSet(sources, { goldSet, size: Number(flags.values.get("--size") ?? 200), seed: Number(flags.values.get("--seed") ?? 1) });
  const saved = await store.addGoldItems(sample.items);
  out(`\n${goldSet}: ${saved.length} products from ${sample.stores} stores${sample.categories.length ? `, ${sample.categories.length} categories` : ""} (${store.name})`);
  for (const w of sample.warnings) out(`  ! ${w}`);
}

async function invite(flags: Flags): Promise<void> {
  const name = flags.positional.join(" ").trim();
  if (!name) throw new Error('Usage: pnpm genome:invite "<labeller name>"');
  const store = await defaultGenomeV1Store();
  const token = newInviteToken();
  await store.createLabeller(name, hashToken(token));
  const origin = flags.values.get("--origin") ?? resolveOrigin();
  out(`Invite for ${name} (${store.name} store). This link is shown once and stored only as a hash:\n`);
  process.stdout.write(`${origin}/label/${token}\n`);
}

async function evaluate(flags: Flags): Promise<void> {
  const store = await defaultGenomeV1Store();
  const a = await labellerByNameOrId(store, flags.values.get("--a"));
  const b = await labellerByNameOrId(store, flags.values.get("--b"));
  if (!a || !b) throw new Error("Usage: pnpm genome:eval --a <labeller> --b <labeller> [--adjudicator <labeller>] [--set NAME] [--model]");
  const adjudicator = await labellerByNameOrId(store, flags.values.get("--adjudicator"));
  const goldSet = flags.values.get("--set");
  const items = await store.listGoldItems(goldSet);
  const itemIds = new Set(items.map((i) => i.id));
  const labels = (await store.listLabels()).filter((l) => itemIds.has(l.itemId));
  const at = new Date().toISOString();
  const reportDir = path.join("docs", "eval");
  await mkdir(reportDir, { recursive: true });

  // 1. Do the humans agree?
  const rows = agreement(labels, a.id, b.id, TAXONOMY_VERSION);
  const run = await store.saveEvalRun({
    kind: "agreement",
    taxonomyVersion: TAXONOMY_VERSION,
    promptVersion: null,
    model: null,
    config: { goldSet: goldSet ?? null, labellers: [a.name, b.name], items: items.length },
    metrics: { dimensions: rows },
  });
  await store.saveGate(rows.map((r) => ({ taxonomyVersion: TAXONOMY_VERSION, dimension: r.dimension, kappa: r.kappa, items: r.items, verdict: r.verdict, evalRunId: run.id, decidedAt: at })));
  const agreementFile = path.join(reportDir, `${at.slice(0, 10)}-agreement.md`);
  await writeFile(agreementFile, agreementMarkdown(rows, { labellers: [a.name, b.name], taxonomyVersion: TAXONOMY_VERSION, at }));
  for (const r of rows) out(`  ${r.dimension.padEnd(16)} κ ${r.kappa === null ? "—" : r.kappa.toFixed(2)}  n=${r.items}  ${r.verdict}`);
  out(`  report: ${agreementFile}`);

  if (!flags.switches.has("--model")) return;

  // 2. Does the model agree with them?
  const gold = adjudicatedGold(labels, a.id, b.id, TAXONOMY_VERSION, adjudicator?.id);
  const goldItems = items.filter((i) => gold.answers.has(i.id));
  const p = provider(flags);
  const storeUrl = `gold:${goldSet ?? "all"}`;
  const result = await classifyCatalogue({ storeUrl, catalogue: goldCatalogue(goldItems), provider: p, label: `eval ${storeUrl}`, onProgress: (m) => out(`  … ${m}`) });

  const runsDir = path.join(".cache", "genome-v1", "gold-runs");
  await mkdir(runsDir, { recursive: true });
  const previousFile = (await readdir(runsDir).catch(() => [] as string[])).filter((f) => f.startsWith(storeUrl.replace(/[^a-z0-9-]/gi, "_"))).sort().pop();
  const previous: GenomeValue[] | null = previousFile ? JSON.parse(await readFile(path.join(runsDir, previousFile), "utf8")) : null;
  await writeFile(path.join(runsDir, `${storeUrl.replace(/[^a-z0-9-]/gi, "_")}-${Date.now()}.json`), JSON.stringify(result.values));

  const scores = scoreModel(gold, result.values);
  const shifts = previous ? labelShifts(previous, result.values) : undefined;
  const gate = new Map(rows.map((r) => [r.dimension, r.verdict]));
  const human = new Map(rows.map((r) => [r.dimension, r.observed]));
  await store.saveEvalRun({
    kind: "model",
    taxonomyVersion: TAXONOMY_VERSION,
    promptVersion: PROMPT_VERSION,
    model: p.model,
    config: { goldSet: goldSet ?? null, provider: p.name, agreementRun: run.id },
    metrics: { dimensions: scores, shifts: shifts ?? null, usd: result.usd, usage: result.usage },
  });
  const modelFile = path.join(reportDir, `${at.slice(0, 10)}-model-${p.model}.md`);
  await writeFile(modelFile, modelMarkdown(scores, { model: p.model, promptVersion: PROMPT_VERSION, taxonomyVersion: TAXONOMY_VERSION, at, gold, gate, human, shifts }));
  for (const line of costSummary(result, p)) out(line);
  out(`  report: ${modelFile}`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parse(rest);
  switch (command) {
    case "classify":
      return classify(flags);
    case "override":
      return override(flags);
    case "seed":
      return seed();
    case "goldset":
      return goldset(flags);
    case "invite":
      return invite(flags);
    case "eval":
      return evaluate(flags);
    case "budget": {
      const ledger = await readLedger();
      out(`M1 classification spend: A$${spentAud(ledger).toFixed(2)} of A$${ledger.capAud} (${ledger.entries.length} runs).`);
      for (const e of ledger.entries) out(`  ${e.at}  ${e.label}  ${e.requests} requests  A$${e.aud.toFixed(4)}`);
      return;
    }
    default:
      throw new Error("Commands: classify, override, seed, goldset, invite, eval, budget");
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
