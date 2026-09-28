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

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scan } from "../src/engine/evaluate.js";
import { supportedJurisdictions } from "../src/engine/registry.js";
import { annotate } from "../src/card/annotate.js";
import { badgeSvg, mayDisplayBadge } from "../src/card/badge.js";
import { shareCard } from "../src/card/og.js";
import { resultPage } from "../src/card/page.js";
import { loadEmbeddedFonts } from "../src/card/fonts.js";
import { WORDMARK } from "../src/card/tokens.js";
import { fetchCopy, RobotsDisallowed } from "../src/fetch/fetch.js";
import { coverageGap, coverageNote } from "../src/fetch/coverage.js";
import { rewriteAll } from "../src/rewrite/rewrite.js";
import { anthropicDrafter, apiKey } from "../src/rewrite/model.js";
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
const FETCH_LOG = join(ROOT, "fetch.log");

type Target = { slug: string; url: string; why: string; wordmark?: string };

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
    const fields = line.split("\t").map((part) => part.trim());
    const [slug, url, why, wordmark] = fields;
    if (!slug || !url) throw new Error(`${TARGETS}:${i + 1} — wants slug, tab, url, tab, why.`);
    if (seen.has(slug)) throw new Error(`${TARGETS}:${i + 1} — "${slug}" is already used; slugs name files.`);
    if (fields.length > 4) {
      // Loud rather than lenient. The old parser joined every trailing field
      // into the why, which was harmless until the fourth field started
      // meaning something — a stray tab in a sentence would silently become
      // the name printed on somebody's card.
      throw new Error(
        `${TARGETS}:${i + 1} (${slug}) — ${fields.length} tab-separated fields, expected at most 4 ` +
          `(slug, url, why, name). A tab inside the "why" will do this; use spaces.`,
      );
    }
    if (!why) {
      // Not pedantry. A target with no reason gets a generic message and a
      // silence that teaches nothing, which spends one of thirty chances —
      // the test's only real cost — on noise.
      throw new Error(`${TARGETS}:${i + 1} (${slug}) — needs a reason. A generic DM is a wasted target.`);
    }
    seen.add(slug);
    targets.push({ slug, url, why, wordmark: wordmark || undefined });
  }
  return targets;
}

/**
 * Collect the copy for any target that has none.
 *
 * Opt-in with `--fetch` rather than automatic. Reading thirty strangers' pages
 * is an outward-facing act, and it should be a word the founder typed, not a
 * side effect of asking for cards to be re-rendered.
 *
 * What lands is an ordinary editable text file, on purpose: KILLTEST.md asks
 * the founder to read each page before the scanner does, and the fetched text
 * is a draft of that reading rather than a replacement for it. Fix it in
 * place, re-run without `--fetch`, and the card follows the file.
 */
async function collect(targets: Target[], own: boolean, markets: Jurisdiction[]): Promise<void> {
  const contact = process.env.SCAN_CONTACT?.trim() || undefined;
  if (!contact) {
    console.log("(SCAN_CONTACT is unset — set it so the stores you read can see who you are.)");
  }

  for (const target of targets) {
    const copyPath = join(COPY, `${target.slug}.txt`);
    if (existsSync(copyPath)) continue;
    try {
      const fetched = await fetchCopy(target.url, { own, contact });
      // Nothing was read — the request timed out, was refused, or 404'd. Write
      // no file. An empty copy file is worse than none: its existence makes
      // every later `--fetch` skip this target, and empty copy scans as
      // 100/100 clear. Thirty unreachable stores once produced thirty clean
      // ledger rows this way.
      if (!fetched.retrieved) {
        const why = fetched.trace.findLast((a) => a.rung === "page")?.outcome ?? "nothing came back";
        console.log(`  skipped ${target.slug.padEnd(20)} ${why}`);
        continue;
      }
      writeFileSync(copyPath, `${fetched.text}\n`);
      appendFileSync(
        FETCH_LOG,
        [
          `# ${target.slug} — ${new Date().toISOString()}`,
          `requested: ${target.url}`,
          ...fetched.trace.map(
            (a) => `  ${a.rung.padEnd(22)} ${a.outcome}${a.chars === undefined ? "" : ` (${a.chars} chars)`}`,
          ),
          "",
        ].join("\n"),
      );
      const flags = [
        fetched.thin ? "THIN — probably a JavaScript shell, paste the copy by hand" : "",
        coverageNote(coverageGap(fetched.text, fetched.pageText, markets)) ?? "",
      ].filter(Boolean);
      console.log(
        `  fetched ${target.slug.padEnd(20)} ${String(fetched.text.length).padStart(5)} chars  via ${fetched.via}` +
          (flags.length > 0 ? `\n           ${flags.join("\n           ")}` : ""),
      );
    } catch (error) {
      const why =
        error instanceof RobotsDisallowed
          ? "robots.txt disallows it — pass --own only if this is your own site"
          : error instanceof Error
            ? (error.message.split("\n")[0] ?? "failed")
            : "failed";
      console.log(`  skipped ${target.slug.padEnd(20)} ${why}`);
    }
  }
}

async function main() {
  const flag = process.argv.indexOf("--markets");
  const markets = (
    flag === -1
      ? supportedJurisdictions()
      : (process.argv[flag + 1] ?? "").split(",").map((m) => m.trim().toUpperCase())
  ) as Jurisdiction[];
  const reviewedOn = new Date();

  const targets = readTargets();
  if (process.argv.includes("--fetch")) {
    mkdirSync(COPY, { recursive: true });
    console.log(`fetching copy for targets that have none…`);
    await collect(targets, process.argv.includes("--own"), markets);
    console.log("");
  }
  const wantsRewrites = process.argv.includes("--rewrite");
  const drafter = wantsRewrites && apiKey() ? anthropicDrafter() : undefined;
  if (wantsRewrites && !drafter) {
    console.log("(--rewrite needs ASSAY_ANTHROPIC_API_KEY; the cards will carry each rule's remedy instead.)");
  }

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
      scans.push({
        slug: target.slug,
        why: target.why,
        score: null,
        marks: null,
        badge: null,
        wordmark: target.wordmark ?? WORDMARK,
      });
      continue;
    }

    const text = readFileSync(copyPath, "utf8");
    const result = scan({
      text,
      source: { kind: "url", reference: target.url },
      jurisdictions: markets,
    });

    // An empty file is a file nobody read — a failed fetch saved by an older
    // version of this script, or a paste that lost its body. It scores 100
    // because there was nothing to deduct for, and a ledger row reading 100
    // for a page nobody read is the one number in this file that must never
    // be wrong. Note the floor is empty, not thin: a page really can be short.
    if (result.readChars === 0) {
      missing.push(`${target.slug}  ${target.url}  (${copyPath} is empty)`);
      scans.push({
        slug: target.slug,
        why: target.why,
        score: null,
        marks: null,
        badge: null,
        wordmark: target.wordmark ?? WORDMARK,
      });
      continue;
    }
    const { marks } = annotate(text, result.findings);
    const base = join(OUT, target.slug);

    // Opt-in, and per target rather than per finding: thirty pages of drafts
    // is thirty pages of API calls, and the card is already useful without
    // them — every note carries the rule's own remedy.
    const rewrites = drafter
      ? (await rewriteAll(text, marks, { drafter, jurisdictions: markets })).rewrites
      : {};

    const wordmark = target.wordmark ?? WORDMARK;
    writeFileSync(`${base}.html`, resultPage({ text, result, reviewedOn, rewrites, fonts, wordmark }));
    writeFileSync(`${base}.card.svg`, shareCard({ text, result, reviewedOn, fonts, wordmark }));
    writeFileSync(`${base}.badge.svg`, badgeSvg({ result, reviewedOn }));

    bands[result.score.band] += 1;
    scans.push({
      slug: target.slug,
      why: target.why,
      score: result.score.value,
      marks: marks.length,
      badge: mayDisplayBadge(result),
      wordmark,
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
    console.log(
      `No copy saved yet for ${missing.length} — run again with --fetch, ` +
        `or put the page's text in ${COPY}/<slug>.txt:`,
    );
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
