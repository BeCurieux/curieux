#!/usr/bin/env tsx
/**
 * The POP engine from the command line: v5's M2, public path.
 *
 *   pnpm pop brief <store-url> "<sentence>" [--parser anthropic|mock] [--out brief.json]
 *   pnpm pop generate <store-url> ("<sentence>" | --brief brief.json)
 *                     [--lock h1,h2] [--exclude h3] [--slug s] [--shortlist 24]
 *                     [--parser anthropic|mock] [--provider anthropic|mock] [--no-publish]
 *   pnpm pop show <slug>
 *
 * `brief` is the chips step: it reads the sentence, prints the brief, and
 * writes it to a file the merchant can edit. `generate --brief` builds from
 * that confirmed file. `generate "<sentence>"` does both in one go, and still
 * refuses any rule the sentence did not plainly state, until someone confirms
 * it in the file.
 *
 * The embedded admin that will do this with chips and buttons is M0, and
 * waits for the kill test.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";
import { loadGenome } from "../src/lib/genome/store";
import { defaultGenomeV1Store } from "../src/lib/genome/v1/store";
import { PROMPT_VERSION as GENOME_V1_PROMPT_VERSION } from "../src/lib/genome/v1/prompt";
import { TAXONOMY_VERSION } from "../src/lib/genome/v1/taxonomy";
import { createAnthropicProvider, createMockProvider } from "../src/lib/merchandise/index";
import { PROMPT_VERSION as MERCHANDISE_PROMPT_VERSION } from "../src/lib/merchandise/prompt";
import { publishShop } from "../src/lib/publish/index";
import { PopBrief, targetsOf, unenforceable } from "../src/lib/pop/brief";
import { generatePop } from "../src/lib/pop/engine";
import { resolveMentions } from "../src/lib/pop/filter";
import { BRIEF_PROMPT_VERSION, createAnthropicBriefParser, createMockBriefParser, finaliseBrief } from "../src/lib/pop/parse";
import { defaultPopStore } from "../src/lib/pop/store";

interface Flags {
  positional: string[];
  values: Map<string, string>;
  switches: Set<string>;
}

function parse(argv: string[]): Flags {
  const flags: Flags = { positional: [], values: new Map(), switches: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--no-publish") flags.switches.add(arg);
    else if (arg.startsWith("--")) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      flags.values.set(arg, value);
    } else flags.positional.push(arg);
  }
  return flags;
}

const out = (line = "") => process.stderr.write(`${line}\n`);
const list = (v: string | undefined) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const anthropicByDefault = () => process.env.AI_PROVIDER === "anthropic";

async function loadIngest(url: string): Promise<IngestResult> {
  const file = path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(url))}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as IngestResult;
  } catch {
    return ingestStore(url);
  }
}

async function readBrief(ingest: IngestResult, flags: Flags, sentence: string | undefined): Promise<PopBrief> {
  const file = flags.values.get("--brief");
  let brief: PopBrief;
  if (file) {
    // A file the merchant confirmed. Whatever it says binds, including a
    // price the model read, so its source becomes the merchant's.
    const raw = PopBrief.parse(JSON.parse(await readFile(file, "utf8")));
    brief = raw.ruleSource.priceMax === "model" ? { ...raw, ruleSource: { priceMax: "merchant" } } : raw;
  } else {
    if (!sentence) throw new Error("Give a sentence, or --brief <file> from `pnpm pop brief`.");
    const which = flags.values.get("--parser") ?? (anthropicByDefault() ? "anthropic" : "mock");
    const parser = which === "anthropic" ? createAnthropicBriefParser() : createMockBriefParser();
    out(`  brief read by ${parser.name}`);
    brief = finaliseBrief(sentence, await parser.parse(sentence));
    const mentions = resolveMentions(brief.mentions, ingest.catalogue);
    if (mentions.handles.length) {
      out(`  named in the sentence, locked in: ${mentions.handles.join(", ")}`);
      brief = { ...brief, rules: { ...brief.rules, includeHandles: [...brief.rules.includeHandles, ...mentions.handles] } };
    }
    for (const m of mentions.unresolved) out(`  ! "${m}" does not name exactly one product; not locked. Use --lock <handle>.`);
  }
  const lock = list(flags.values.get("--lock"));
  const exclude = list(flags.values.get("--exclude"));
  return {
    ...brief,
    rules: {
      ...brief.rules,
      includeHandles: [...new Set([...brief.rules.includeHandles, ...lock])],
      excludeHandles: [...new Set([...brief.rules.excludeHandles, ...exclude])],
    },
  };
}

/** The chips, as text. */
function printBrief(brief: PopBrief): void {
  const r = brief.rules;
  out(`\n  "${brief.sentence}"`);
  out(`  for            ${brief.who.persona || "—"}`);
  if (brief.why.campaign) out(`  occasion       ${brief.why.campaign}`);
  out(`  goal           ${brief.goal}`);
  for (const [dim, values] of targetsOf(brief)) if (values.size) out(`  ${dim.padEnd(14)} ${[...values].join(", ")}`);
  out(`  price          ${r.priceMax === null ? "no cap" : `≤ ${r.priceMax} ${r.priceScope === "per_item" ? "per item" : "in total"} (${brief.ruleSource.priceMax})`}`);
  if (r.includeHandles.length) out(`  locked         ${r.includeHandles.join(", ")}`);
  if (r.excludeHandles.length) out(`  excluded       ${r.excludeHandles.join(", ")}`);
  for (const [label, v] of [["min units", r.minUnits], ["margin", r.marginMin], ["ship by", r.shipBy]] as const) if (v !== null) out(`  ${label.padEnd(14)} ${v}`);
}

async function briefCommand(flags: Flags): Promise<void> {
  const [url, sentence] = flags.positional;
  if (!url || !sentence) throw new Error('Usage: pnpm pop brief <store-url> "<sentence>" [--out brief.json]');
  const ingest = await loadIngest(url);
  const brief = await readBrief(ingest, flags, sentence);
  printBrief(brief);
  const problems = unenforceable(brief, { hasUnits: false, hasCost: false });
  for (const p of problems) out(`  ! ${p}`);
  const file = flags.values.get("--out") ?? path.join(".cache", "pop", "briefs", `${storeCacheKey(normaliseStoreUrl(url))}-${Date.now()}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(brief, null, 2)}\n`);
  out(`\n  written to ${file}. Edit it if anything is wrong, then:\n  pnpm pop generate ${url} --brief ${file}`);
}

async function generateCommand(flags: Flags): Promise<void> {
  const [url, sentence] = flags.positional;
  if (!url) throw new Error('Usage: pnpm pop generate <store-url> ("<sentence>" | --brief brief.json)');
  const ingest = await loadIngest(url);
  const brief = await readBrief(ingest, flags, sentence);
  printBrief(brief);

  const storeUrl = ingest.store.storeUrl;
  const genome = (await (await defaultGenomeV1Store()).loadClassification(storeUrl).catch(() => ({ values: [] }))).values;
  const legacyGenome = (await loadGenome(storeCacheKey(normaliseStoreUrl(url)))) ?? undefined;
  const which = flags.values.get("--provider") ?? (anthropicByDefault() ? "anthropic" : "mock");
  const provider = which === "anthropic" ? createAnthropicProvider() : createMockProvider();

  const started = Date.now();
  const result = await generatePop({
    ingest,
    brief,
    genome,
    ...(legacyGenome ? { legacyGenome } : {}),
    provider,
    shortlistSize: Number(flags.values.get("--shortlist") ?? 24),
  });

  out(`\n  ${result.shortlist.length} shortlisted of ${ingest.catalogue.products.length - result.excluded.length} passing the rules; ${result.excluded.length} excluded`);
  const reasons = new Map<string, number>();
  for (const e of result.excluded) {
    const key = e.reason.replace(/\(cheapest [\d.]+\)/, "").trim();
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  for (const [reason, n] of reasons) out(`    × ${n} ${reason}`);
  out("");
  for (const d of result.decisions) out(`  ${String(d.position).padStart(2)}. ${d.role.padEnd(10)} ${d.handle}  (${d.score})  ${d.reason}`);
  for (const r of result.repairs) out(`  repaired: ${r}`);
  for (const w of result.warnings) out(`  ! ${w}`);
  out(`\n  assembled by ${result.merchandise.model} in ${((Date.now() - started) / 1000).toFixed(1)}s (${result.merchandise.attempts} attempt${result.merchandise.attempts === 1 ? "" : "s"})`);

  if (flags.switches.has("--no-publish")) {
    out("  not published (--no-publish).");
    return;
  }
  const published = await publishShop({
    config: result.config,
    ingest,
    ...(legacyGenome ? { genome: legacyGenome } : {}),
    ...(flags.values.get("--slug") ? { slug: flags.values.get("--slug")! } : {}),
    provenance: {
      model: result.merchandise.model,
      promptVersion: MERCHANDISE_PROMPT_VERSION,
      genomeVersion: genome.length ? `${TAXONOMY_VERSION}@${GENOME_V1_PROMPT_VERSION}` : null,
    },
  });
  const popStore = await defaultPopStore();
  const recorded = await popStore.record({
    shopSlug: published.shop.slug,
    shopVersionId: published.shop.versionId,
    brief,
    shortlist: result.shortlist.map((s) => ({
      handle: s.candidate.product.handle,
      score: s.score,
      matched: s.matched,
      notes: s.notes,
      pinnedVariantId: s.candidate.pinnedVariantId,
    })),
    excluded: result.excluded,
    repairs: result.repairs,
    decisions: result.decisions,
    taxonomyVersion: TAXONOMY_VERSION,
    briefPromptVersion: flags.values.has("--brief") ? null : BRIEF_PROMPT_VERSION,
  });
  out(`  published POP v${recorded.version.version} (${popStore.name}): ${published.url}`);
}

async function showCommand(flags: Flags): Promise<void> {
  const slug = flags.positional[0];
  if (!slug) throw new Error("Usage: pnpm pop show <slug>");
  const found = await (await defaultPopStore()).find(slug);
  if (!found) throw new Error(`No POP at "${slug}".`);
  printBrief(found.pop.brief);
  for (const v of found.versions) {
    out(`\n  v${v.version} · ${v.createdAt} · ${v.decisions.length} products · shop version ${v.shopVersionId}`);
    for (const d of v.decisions) out(`    ${String(d.position).padStart(2)}. ${d.role.padEnd(10)} ${d.handle} [${d.decisionSource}] ${d.reason}`);
    for (const r of v.repairs) out(`    repaired: ${r}`);
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parse(rest);
  if (command === "brief") return briefCommand(flags);
  if (command === "generate") return generateCommand(flags);
  if (command === "show") return showCommand(flags);
  throw new Error("Commands: brief, generate, show");
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
