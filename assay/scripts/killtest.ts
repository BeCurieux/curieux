/**
 * `pnpm killtest` — thirty pages in, thirty cards and a ledger out.
 *
 * BRIEF.md §10 is a two-week outreach motion, and the part of it a machine can
 * do is the tedious half: run every target, render every card, and keep the
 * ledger whose arithmetic decides the gate. The half a machine cannot do is
 * the half that matters — reading a real page, choosing who to write to, and
 * writing to them. KILLTEST.md is the runbook for that.
 *
 *   killtest/targets.txt        slug ⇥ url ⇥ why this brand is on the list
 *   killtest/copy/<slug>.txt    the page's copy, saved by hand
 *   killtest/out/<slug>.*       the card, rendered
 *   killtest/ledger.md          the run, and what each founder said back
 *
 * None of that is committed — `.gitignore` keeps everything under `killtest/`
 * out except the example. These brands have agreed to nothing, and a
 * repository full of graded strangers is the Yuka problem with a git history.
 *
 * Re-running is safe and expected: the ledger's outreach columns are read back
 * and preserved (see `src/killtest/ledger.ts`, which is where that lives so it
 * can be tested), and only the scan columns are refreshed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scan } from "../src/engine/evaluate.js";
import { supportedJurisdictions } from "../src/engine/registry.js";
import { annotate } from "../src/card/annotate.js";
import { badgeSvg, mayDisplayBadge } from "../src/card/badge.js";
import { shareCard } from "../src/card/og.js";
import { resultPage } from "../src/card/page.js";
import { loadEmbeddedFonts } from "../src/card/fonts.js";
import {
  GATE,
  mergeRows,
  parseLedger,
  renderLedger,
  tally,
  type ScanRow,
} from "../src/killtest/ledger.js";
import type { Jurisdiction } from "../src/engine/types.js";

const ROOT = "killtest";
const COPY = join(ROOT, "copy");
const OUT = join(ROOT, "out");
const TARGETS = join(ROOT, "targets.txt");
const LEDGER = join(ROOT, "ledger.md");

type Target = { slug: string; url: string; why: string };

function readTargets(): Target[] {
  if (!existsSync(TARGETS)) {
    throw new Error(
      `No ${TARGETS}. Copy killtest/targets.example.txt to killtest/targets.txt and fill it in.\n` +
        `One target per line: slug, tab, product-page URL, tab, why this brand is on the list.`,
    );
  }
  const targets: Target[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of readFileSync(TARGETS, "utf8").split("\n").entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [slug, url, ...rest] = line.split("\t").map((part) => part.trim());
    if (!slug || !url) throw new Error(`${TARGETS}:${i + 1} — wants slug, tab, url, tab, why.`);
    if (seen.has(slug)) throw new Error(`${TARGETS}:${i + 1} — "${slug}" is already used; slugs name files.`);
    const why = rest.join(" ").trim();
    if (!why) {
      // Not pedantry. A target with no reason gets a generic message and a
      // silence that teaches nothing, which spends one of thirty chances —
      // the test's only real cost — on noise.
      throw new Error(`${TARGETS}:${i + 1} (${slug}) — needs a reason. A generic DM is a wasted target.`);
    }
    seen.add(slug);
    targets.push({ slug, url, why });
  }
  return targets;
}

function main() {
  const flag = process.argv.indexOf("--markets");
  const markets = (
    flag === -1
      ? supportedJurisdictions()
      : (process.argv[flag + 1] ?? "").split(",").map((m) => m.trim().toUpperCase())
  ) as Jurisdiction[];
  const reviewedOn = new Date();

  const targets = readTargets();
  const known = parseLedger(existsSync(LEDGER) ? readFileSync(LEDGER, "utf8") : "");
  const fonts = loadEmbeddedFonts();
  mkdirSync(OUT, { recursive: true });
  mkdirSync(COPY, { recursive: true });

  const scans: ScanRow[] = [];
  const missing: string[] = [];
  const bands = { clear: 0, review: 0, rework: 0 };

  for (const target of targets) {
    const copyPath = join(COPY, `${target.slug}.txt`);
    if (!existsSync(copyPath)) {
      missing.push(`${target.slug}  ${target.url}`);
      scans.push({ slug: target.slug, why: target.why, score: null, marks: null, badge: null });
      continue;
    }

    const text = readFileSync(copyPath, "utf8");
    const result = scan({
      text,
      source: { kind: "url", reference: target.url },
      jurisdictions: markets,
    });
    const { marks } = annotate(text, result.findings);
    const base = join(OUT, target.slug);

    writeFileSync(`${base}.html`, resultPage({ text, result, reviewedOn, fonts }));
    writeFileSync(`${base}.card.svg`, shareCard({ text, result, reviewedOn, fonts }));
    writeFileSync(`${base}.badge.svg`, badgeSvg({ result, reviewedOn }));

    bands[result.score.band] += 1;
    scans.push({
      slug: target.slug,
      why: target.why,
      score: result.score.value,
      marks: marks.length,
      badge: mayDisplayBadge(result),
    });
  }

  const rows = mergeRows(scans, known);
  const counts = tally(rows);
  writeFileSync(LEDGER, renderLedger(rows, counts));

  console.log(`${counts.scanned} of ${targets.length} targets scanned · cards in ${OUT}/`);
  if (counts.scanned > 0) {
    console.log(`bands: ${bands.clear} clear · ${bands.review} worth a look · ${bands.rework} needs a rewrite`);
  }
  if (missing.length > 0) {
    console.log("");
    console.log(`No copy saved yet for ${missing.length} — put the page's text in ${COPY}/<slug>.txt:`);
    for (const line of missing) console.log(`  ${line}`);
  }
  console.log("");
  console.log(
    `gate: ${counts.wantItLive}/${GATE.wantItLive} want it live · ` +
      `${counts.offeredToPay}/${GATE.offeredToPay} offered to pay`,
  );
  if (counts.proceed) console.log("→ §10 says proceed.");
  else if (counts.exhausted) console.log("→ all thirty contacted, gate not met. Read §10's kill/reshape paragraph.");
  else console.log(`→ ${GATE.targets - counts.contacted} still to contact.`);
  console.log(`ledger: ${LEDGER}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
