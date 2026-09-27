#!/usr/bin/env tsx
/**
 * pnpm killtest <command>
 *
 *   check                          preflight only — is this test allowed to run?
 *   generate <targets-file>        a shop per merchant, recorded in the ledger
 *   log <store-url> --stage <s>    what a merchant actually said
 *   status                         the count, and the call
 *
 * Step 7 is "Stop", and this is the only thing it asks anyone to build. Sprint 3
 * — OAuth sync, email capture, creator shops, billing, word-editing, TikTok-URL
 * input — is gated on the verdict this prints.
 *
 * `status` computes the call rather than offering an opinion, which is the
 * point. "Kill quickly rather than rationalise" is not advice a tool can give
 * on the day; it is a number decided in advance and read out later.
 */

import { anthropicApiKey } from "../src/lib/anthropic-key";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestStore } from "../src/lib/ingest/index";
import { normaliseStoreUrl, storeCacheKey } from "../src/lib/ingest/url";
import type { IngestResult } from "../src/lib/ingest/types";
import { defaultGenomeV1Store } from "../src/lib/genome/v1/store";
import { catalogueVerdict, suggestPops } from "../src/lib/pop/suggest";
import { defaultPopStore } from "../src/lib/pop/store";
import { choosePops, outreachNote, popSlug, type SentPop } from "../src/lib/killtest/pops";
import { spawnSync } from "node:child_process";
import {
  addTargets,
  emptyLedger,
  loadLedger,
  preflight,
  recordOutcome,
  saveLedger,
  verdict,
  STAGES,
  OUTCOMES,
  THRESHOLD_COUNT,
  TARGET_MERCHANTS,
  SEGMENTS,
  type Ledger,
  type Segment,
  type TargetInput,
  type Outcome,
  type Stage,
} from "../src/lib/killtest/index";

const usage = `Usage:
  pnpm killtest check <targets-file>
  pnpm killtest generate <targets-file> [--prompt "<prompt>"] [--dry-run]      (v3: one bio shop each)
  pnpm killtest pops <targets-file> [--per-brand 3] [--runs 3] [--min 6] [--dry-run]   (v5: campaign POPs)
  pnpm killtest log <store-url> --stage <${STAGES.join("|")}> [--outcome <${OUTCOMES.join("|")}>] [--said "..."]
  pnpm killtest status`;

/**
 * One storefront per line, under a `[merchants]` or `[creators]` heading.
 *
 * Two things the first version got wrong. It only stripped lines that *begin*
 * with `#`, while the example file's own notation puts the note after the URL
 * — so uncommenting a line from the example handed the ingester
 * "https://store.com   # beauty, ~80 products" as a URL. And it had nowhere to
 * say who somebody is, which is the whole point of this change.
 *
 * Headings rather than a per-line tag because a human maintains this file, and
 * a heading shows the split of the list at a glance instead of requiring it to
 * be counted.
 */
async function readTargets(file: string): Promise<TargetInput[]> {
  const raw = await readFile(file, "utf8");
  const targets: TargetInput[] = [];
  let segment: Segment = "merchant";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const heading = /^\[(\w+)]$/.exec(trimmed);
    if (heading) {
      const name = heading[1]!.toLowerCase().replace(/s$/, "");
      if (!SEGMENTS.includes(name as Segment)) {
        throw new Error(`Unknown section [${heading[1]}] in ${file}. Use ${SEGMENTS.map((s) => `[${s}s]`).join(" or ")}.`);
      }
      segment = name as Segment;
      continue;
    }

    const hash = trimmed.indexOf("#");
    const storeUrl = (hash === -1 ? trimmed : trimmed.slice(0, hash)).trim();
    const note = hash === -1 ? "" : trimmed.slice(hash + 1).trim();
    if (storeUrl.length === 0) continue;

    targets.push({ storeUrl, segment, ...(note ? { note } : {}) });
  }

  return targets;
}

function reportPreflight(targets: TargetInput[]): boolean {
  const result = preflight({
    storeUrls: targets.map((t) => t.storeUrl),
    aiProvider: process.env.AI_PROVIDER,
    anthropicKey: anthropicApiKey(),
    chromiumPath: process.env.CHROMIUM_PATH,
  });

  for (const warning of result.warnings) process.stderr.write(`  ! ${warning}\n\n`);
  if (result.ok) {
    const merchants = targets.filter((t) => t.segment !== "creator").length;
    const creators = targets.length - merchants;
    const who = creators > 0 ? `${merchants} merchants and ${creators} creators` : `${merchants} merchants`;
    process.stderr.write(`  ready — ${who}, generating with the model\n\n`);
    return true;
  }

  process.stderr.write("  This kill test cannot run:\n\n");
  for (const blocker of result.blockers) process.stderr.write(`  × ${blocker}\n\n`);
  return false;
}

/**
 * One `pnpm generate` per merchant, in sequence.
 *
 * Sequential rather than parallel on purpose: this crawls thirty storefronts
 * belonging to people who have not asked us to, and hammering them in parallel
 * is both rude and the fastest way to get rate-limited off the test.
 */
async function generate(file: string, prompt: string, dryRun: boolean): Promise<void> {
  const targets = await readTargets(file);
  if (!reportPreflight(targets)) process.exit(1);
  if (dryRun) {
    process.stderr.write("  --dry-run: stopping before any storefront is touched.\n\n");
    return;
  }

  const now = new Date();
  let ledger = addTargets((await loadLedger()) ?? emptyLedger(now), targets, now);

  for (const [index, target] of targets.entries()) {
    const { storeUrl } = target;
    const tag = target.segment === "creator" ? "  creator" : "";
    process.stderr.write(`  ${String(index + 1).padStart(2)}/${targets.length}  ${storeUrl}${tag}\n`);

    const run = spawnSync("pnpm", ["generate", storeUrl, prompt, "--quiet"], { encoding: "utf8" });
    if (run.status !== 0) {
      // A merchant we could not generate for is not a merchant who said no.
      // Recording the difference is what keeps the denominator honest.
      process.stderr.write(`        failed: ${(run.stderr ?? "").trim().split("\n").slice(-1)[0] ?? "unknown"}\n`);
      continue;
    }

    const url = (run.stdout ?? "").trim().split("\n").pop() ?? "";
    const slug = url.split("/").pop() ?? "";
    ledger = recordOutcome(
      ledger,
      storeUrl,
      { slug, shopUrl: url, generatedAt: new Date().toISOString() },
      new Date(),
    );
    await saveLedger(ledger);
    process.stderr.write(`        ${url}\n`);
  }

  process.stderr.write(`\n  ledger: ${await saveLedger(ledger)}\n\n`);
}

/**
 * v5: for each brand, read the catalogue, run the Genome, and send the two or
 * three POPs it has real depth for, leading with what keywords would miss.
 *
 * Every paid step goes through the Genome's cost ledger, so the run stops at
 * the cap rather than past it. Brands whose catalogue reads `skip` are
 * screened out, not contacted, and are not added to the ledger: a brand we
 * chose not to ask is not a brand that said no.
 */
async function pops(file: string, options: { perBrand: number; runs: number; min: number; dryRun: boolean }): Promise<void> {
  const targets = await readTargets(file);
  if (!reportPreflight(targets)) process.exit(1);
  if (options.dryRun) {
    process.stderr.write("  --dry-run: stopping before any storefront is touched.\n\n");
    return;
  }

  const genomeStore = await defaultGenomeV1Store();
  const popStore = await defaultPopStore();
  const outDir = path.join("killtest", "out");
  await mkdir(outDir, { recursive: true });
  let ledger = (await loadLedger()) ?? emptyLedger(new Date());

  for (const [index, target] of targets.entries()) {
    const { storeUrl } = target;
    process.stderr.write(`  ${String(index + 1).padStart(2)}/${targets.length}  ${storeUrl}\n`);

    // 1. The catalogue, cached so the Genome and the engine read the same one.
    let ingest: IngestResult;
    try {
      ingest = await ingestStore(storeUrl);
      const cache = path.join(".cache", "ingest", `${storeCacheKey(normaliseStoreUrl(storeUrl))}.json`);
      await mkdir(path.dirname(cache), { recursive: true });
      await writeFile(cache, JSON.stringify(ingest));
    } catch (error) {
      process.stderr.write(`        could not read the catalogue: ${error instanceof Error ? error.message : String(error)}\n`);
      continue;
    }

    // 2. The Genome, under the cost cap. Over the cap stops the whole run.
    // Out of the kill test's own budget (A$150, owner, 2026-09-27), never the gold set's.
    const classify = spawnSync("pnpm", ["genome:classify", storeUrl, "--provider", "anthropic", "--runs", String(options.runs), "--budget", "killtest"], { encoding: "utf8" });
    if (classify.status !== 0) {
      const why = (classify.stderr ?? "").trim().split("\n").slice(-1)[0] ?? "unknown";
      process.stderr.write(`        Genome failed: ${why}\n`);
      if (/cap is already spent|KILLTEST_CAP_AUD/.test(classify.stderr ?? "")) {
        process.stderr.write("\n  Stopped at the Genome cost cap. Raising it is the owner's decision.\n\n");
        break;
      }
      continue;
    }

    // 3. What this catalogue can make well, and whether it is worth asking.
    const genome = (await genomeStore.loadClassification(ingest.store.storeUrl)).values;
    const suggestions = suggestPops(ingest.catalogue, genome, { minProducts: options.min, minConfidence: options.runs >= 5 ? 0.8 : 0.66 });
    const read = catalogueVerdict(suggestions);
    process.stderr.write(`        ${read.viable} POPs with depth, ${read.genomeLed} Genome-led → ${read.verdict}\n`);
    if (read.verdict === "skip") {
      process.stderr.write("        screened out: nothing here a keyword collection could not make. Not contacted.\n");
      continue;
    }

    // 4. Generate and publish the chosen POPs.
    const titles = new Map(ingest.catalogue.products.map((p) => [p.handle, p.title]));
    const sent: SentPop[] = [];
    for (const [i, suggestion] of choosePops(suggestions, options.perBrand).entries()) {
      const briefFile = path.join(".cache", "pop", "briefs", `${storeCacheKey(normaliseStoreUrl(storeUrl))}-killtest-${i + 1}.json`);
      await mkdir(path.dirname(briefFile), { recursive: true });
      await writeFile(briefFile, JSON.stringify(suggestion.brief, null, 2));
      const slug = popSlug(ingest.brand.name, suggestion);
      const run = spawnSync("pnpm", ["pop", "generate", storeUrl, "--brief", briefFile, "--slug", slug, "--provider", "anthropic"], { encoding: "utf8" });
      const published = /published POP v\d+ \([^)]*\): (\S+)/.exec(run.stderr ?? "");
      if (run.status !== 0 || !published) {
        process.stderr.write(`        POP failed ("${suggestion.sentence}"): ${(run.stderr ?? "").trim().split("\n").slice(-1)[0] ?? "unknown"}\n`);
        continue;
      }
      const stored = await popStore.find(slug);
      const latest = stored?.versions.at(-1);
      sent.push({
        slug,
        url: published[1]!,
        sentence: suggestion.sentence,
        products: latest?.decisions.length ?? suggestion.handles.length,
        genomeOnly: (latest?.baseline?.popOnly ?? suggestion.genomeOnly).map((h) => titles.get(h) ?? h),
      });
      process.stderr.write(`        ${published[1]}  "${suggestion.sentence}"\n`);
    }
    if (sent.length === 0) continue;

    // 5. The ledger, and the note to send.
    ledger = addTargets(ledger, [target], new Date());
    ledger = recordOutcome(
      ledger,
      storeUrl,
      {
        slug: sent[0]!.slug,
        shopUrl: sent[0]!.url,
        generatedAt: new Date().toISOString(),
        pops: sent.map(({ slug, url, sentence, genomeOnly }) => ({ slug, url, sentence, genomeOnly })),
      },
      new Date(),
    );
    await saveLedger(ledger);
    const note = path.join(outDir, `${storeCacheKey(normaliseStoreUrl(storeUrl))}.md`);
    await writeFile(note, outreachNote(ingest.brand.name, sent));
    process.stderr.write(`        note: ${note}\n`);
  }

  process.stderr.write(`\n  ledger: ${await saveLedger(ledger)}\n\n`);
}

async function log(argv: string[]): Promise<void> {
  const storeUrl = argv[0];
  if (!storeUrl || storeUrl.startsWith("--")) throw new Error(usage);

  let stage: Stage | undefined;
  let outcome: Outcome | undefined;
  let said: string | undefined;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--stage") {
      const value = argv[++i];
      if (!STAGES.includes(value as Stage)) throw new Error(`--stage must be one of: ${STAGES.join(", ")}`);
      stage = value as Stage;
    } else if (arg === "--outcome") {
      const value = argv[++i];
      if (!OUTCOMES.includes(value as Outcome)) throw new Error(`--outcome must be one of: ${OUTCOMES.join(", ")}`);
      outcome = value as Outcome;
    } else if (arg === "--said") {
      said = argv[++i];
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const ledger = await loadLedger();
  if (!ledger) throw new Error("No ledger yet. Run `pnpm killtest generate <targets-file>` first.");
  if (!ledger.targets.some((t) => t.storeUrl === storeUrl)) {
    throw new Error(`"${storeUrl}" is not in the ledger. Targets are added by \`generate\`.`);
  }

  const updated = recordOutcome(
    ledger,
    storeUrl,
    {
      ...(stage ? { stage } : {}),
      ...(outcome ? { outcome } : {}),
      ...(said ? { said } : {}),
    },
    new Date(),
  );

  await saveLedger(updated);
  const target = updated.targets.find((t) => t.storeUrl === storeUrl)!;
  process.stderr.write(`\n  ${storeUrl} — ${target.stage} / ${target.outcome}\n\n`);
  printStatus(updated);
}

function printStatus(ledger: Ledger): void {
  const v = verdict(ledger);
  const lines: string[] = [];

  lines.push("");
  lines.push(`  kill test — started ${ledger.startedAt.slice(0, 10)}`);
  lines.push("");
  lines.push(`  generated        ${v.generated}`);
  lines.push(`  contacted        ${v.contacted} of ${TARGET_MERCHANTS}`);
  lines.push(`  want it live     ${v.wantItLive}   (the bar is ${THRESHOLD_COUNT})`);
  lines.push(`  asked the price  ${v.askedPrice}   ${v.askedPrice > 0 ? "— the brief calls this gold" : ""}`.trimEnd());
  lines.push(`  paid             ${v.paid}`);
  lines.push(`  still open       ${v.outstanding}`);
  lines.push("");

  /*
   * Creators are printed under the verdict, not inside it. They are the answer
   * to "which of the two is this for", and the gate above is the answer to
   * "does anyone want it at all" — put them in one column and the second
   * question quietly starts answering the first.
   */
  if (v.segments.creator.contacted > 0) {
    const { contacted, wantItLive } = v.segments.creator;
    lines.push(`  creators         ${wantItLive} of ${contacted} want it live   (not counted toward the bar)`);
    lines.push("");
  }

  const call = v.call === "proceed" ? "PROCEED" : v.call === "kill" ? "KILL" : "RUNNING";
  lines.push(`  ${call}`);
  lines.push(`  ${v.reason}`);
  lines.push("");

  if (v.call === "running") {
    lines.push("  Sprint 3 stays shut. Nothing in it gets built on a verdict that has not arrived.");
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
  process.stdout.write("\n");
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "check": {
      const file = rest[0];
      if (!file) throw new Error(usage);
      process.stderr.write("\n");
      if (!reportPreflight(await readTargets(file))) process.exit(1);
      return;
    }

    case "generate": {
      const file = rest[0];
      if (!file) throw new Error(usage);
      let prompt = "a clean bio shop for the people arriving from their social links";
      let dryRun = false;
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === "--prompt") prompt = rest[++i] ?? prompt;
        else if (rest[i] === "--dry-run") dryRun = true;
        else throw new Error(`Unknown option: ${rest[i]}`);
      }
      process.stderr.write("\n");
      await generate(file, prompt, dryRun);
      return;
    }

    case "pops": {
      const file = rest[0];
      if (!file) throw new Error(usage);
      const options = { perBrand: 3, runs: 3, min: 6, dryRun: false };
      for (let i = 1; i < rest.length; i++) {
        const flag = rest[i];
        if (flag === "--dry-run") options.dryRun = true;
        else if (flag === "--per-brand") options.perBrand = Number(rest[++i]);
        else if (flag === "--runs") options.runs = Number(rest[++i]);
        else if (flag === "--min") options.min = Number(rest[++i]);
        else throw new Error(`Unknown option: ${flag}`);
      }
      process.stderr.write("\n");
      await pops(file, options);
      return;
    }

    case "log":
      await log(rest);
      return;

    case "status": {
      const ledger = await loadLedger();
      if (!ledger) {
        process.stderr.write("\n  No kill test has been started.\n\n");
        process.exit(1);
      }
      printStatus(ledger);
      return;
    }

    default:
      throw new Error(usage);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n\n`);
  process.exit(1);
});
