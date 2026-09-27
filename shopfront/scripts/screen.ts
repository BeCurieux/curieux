#!/usr/bin/env tsx
/**
 * pnpm screen <candidates.txt>
 *
 * Sixty stores in, thirty target lines out.
 *
 * Finding kill-test targets is two jobs wearing one hat. The first is
 * judgement — whose traffic comes off Instagram, who runs two campaigns a
 * month, who has no developer to build them a landing page. That one is a
 * person's, and it is why `killtest/targets.txt` is written by hand.
 *
 * The second is checking. Is the feed open, are there enough products, is
 * anything in stock, how good is the photography. That is mechanical, it is
 * miserable across sixty candidates, and skipping it is expensive in a way that
 * only surfaces mid-run — a closed feed drops the ingester onto its slowest
 * rung, and a store with eleven products has nothing to select from, so the
 * shop it produces tests the renderer instead of the merchandiser.
 *
 * So: paste in every candidate, however rough. This reads each one and prints
 * lines ready for the targets file, with the rejects commented out rather than
 * dropped — a target that vanished silently is one nobody reconsiders.
 *
 * It decides nothing. The verdict column is advice printed beside the numbers
 * it came from.
 */

import { readFile } from "node:fs/promises";
import { ingestStore } from "../src/lib/ingest/index";
import { parseCandidates, screen, screenV5, type ScreenResult, type V5Screen } from "../src/lib/killtest/screen";

const v5 = process.argv.includes("--v5");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  process.stderr.write(
    [
      "Usage: pnpm screen <candidates.txt> [--v5]",
      "",
      "  --v5  screen for the v5 kill test: 300+ products across several types,",
      "        with the Genome cost of each store at 3 runs.",
      "",
      "  One store URL per line. Blank lines and # comments are ignored, so you",
      "  can paste a rough list and annotate it as you go.",
      "",
      "  Prints lines for killtest/targets.txt. Rejects are commented out, not",
      "  removed.",
      "",
    ].join("\n"),
  );
  process.exit(2);
}

const candidates = parseCandidates(await readFile(file, "utf8"));

if (candidates.length === 0) {
  process.stderr.write(`No URLs in ${file}.\n`);
  process.exit(1);
}

process.stderr.write(`\n  Screening ${candidates.length} candidates${v5 ? " for the v5 kill test" : ""}.\n\n`);

if (v5) {
  const rows: V5Screen[] = [];
  for (const [index, url] of candidates.entries()) {
    const position = `${String(index + 1).padStart(3)}/${candidates.length}`;
    let row: V5Screen;
    try {
      const ingest = await ingestStore(url);
      row = screenV5(ingest.store.storeUrl, ingest.catalogue);
    } catch (error) {
      row = { ...screenV5(url, null), notes: [error instanceof Error ? error.message : String(error)] };
    }
    rows.push(row);
    process.stderr.write(`  ${position}  ${row.verdict.padEnd(11)} ${url}  (${row.productCount} products, ${row.productTypes} types)\n`);
    for (const note of row.notes) process.stderr.write(`            · ${note}\n`);
  }
  const usable = rows.filter((r) => r.verdict !== "wrong-test");
  const cost = usable.reduce((sum, r) => sum + r.genomeCostAud, 0);
  process.stderr.write(`\n  ${rows.filter((r) => r.verdict === "good").length} good · ${rows.filter((r) => r.verdict === "workable").length} workable · ${rows.length - usable.length} skipped`);
  process.stderr.write(`\n  Genome for the usable ones: ~A$${cost.toFixed(2)} of the A$150 kill-test budget, at 3 runs.\n`);
  if (usable.length < 30) process.stderr.write(`  ${30 - usable.length} short of thirty. Screen more candidates.\n`);
  process.stderr.write("\n");
  process.stdout.write("[merchants]\n");
  for (const r of [...rows.filter((x) => x.verdict === "good"), ...rows.filter((x) => x.verdict === "workable"), ...rows.filter((x) => x.verdict === "wrong-test")]) {
    process.stdout.write(`${r.line}\n`);
  }
  process.exit(0);
}

const results: ScreenResult[] = [];

for (const [index, url] of candidates.entries()) {
  const position = `${String(index + 1).padStart(3)}/${candidates.length}`;
  try {
    // The real ingester, not a lighter fetch written for this. Screening a
    // store with a different code path to the one that will ingest it later is
    // how a candidate passes here and fails there.
    const ingest = await ingestStore(url);
    const result = screen(ingest.store.storeUrl, ingest.catalogue);
    results.push(result);
    process.stderr.write(`  ${position}  ${result.verdict.padEnd(11)} ${url}\n`);
    for (const note of result.notes) process.stderr.write(`            · ${note}\n`);
  } catch (error) {
    const result = screen(url, null);
    results.push(result);
    process.stderr.write(`  ${position}  unreachable  ${url}\n`);
    process.stderr.write(`            · ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

const good = results.filter((r) => r.verdict === "good");
const workable = results.filter((r) => r.verdict === "workable");
const wrong = results.filter((r) => r.verdict === "wrong-test");
const thin = results.filter((r) => r.verdict !== "wrong-test" && r.hardPhotography);

process.stderr.write(
  [
    "",
    `  ${good.length} good · ${workable.length} workable · ${wrong.length} not this test`,
    `  ${thin.length} shot without a studio template — the mediocre-photography sample`,
    "",
  ].join("\n"),
);

// The bar is thirty merchants. Said here because the alternative is finding out
// after the DMs have gone.
const usable = good.length + workable.length;
if (usable < 30) {
  process.stderr.write(`  ${30 - usable} short of thirty. Screen more candidates before starting.\n\n`);
}

if (thin.length === 0 && usable > 0) {
  process.stderr.write(
    [
      "  Every candidate was shot to a template. The brief asks the renderer to flatter",
      "  mediocre photography, and this list would never test that. Screen a batch of",
      "  smaller makers before starting — the shape of merchant who photographs their own",
      "  stock is the one this sample is missing.",
      "",
      "",
    ].join("\n"),
  );
}

// stdout is the file content, so this composes: `pnpm screen list.txt >> killtest/targets.txt`
process.stdout.write("[merchants]\n");
for (const result of [...good, ...workable, ...wrong]) process.stdout.write(`${result.line}\n`);
process.stdout.write("\n[creators]\n");
