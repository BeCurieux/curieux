/**
 * `pnpm card` — a scan, rendered as the artefact.
 *
 * This is the kill test's whole toolchain. A founder points it at a page of
 * copy and gets back three files: the result page to read and send, the share
 * card at OG size to attach to a DM, and the badge as it would look on the
 * merchant's PDP. No key, no account, no network.
 *
 *   pnpm card --url https://brand.example/products/serum --out ./cards/aurelia
 *   pnpm card --file page.txt --out ./cards/aurelia
 *   pnpm card --text "Clinically proven…" --markets AU,EU --wordmark SORREL
 *   pnpm card --file page.txt --rewrite      # draft the replacements too
 *   pnpm card --file page.txt --png          # needs a Chromium, see below
 *
 * The masthead says Franca by default (`WORDMARK`, src/card/tokens.ts).
 * `--wordmark` overrides it — kept now the name is settled, because trying
 * another one in front of a founder should stay a flag rather than an edit.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { scan } from "../src/engine/evaluate.js";
import { supportedJurisdictions } from "../src/engine/registry.js";
import { badgeSvg, mayDisplayBadge } from "../src/card/badge.js";
import { shareCard, OG_HEIGHT, OG_WIDTH } from "../src/card/og.js";
import { resultPage } from "../src/card/page.js";
import { loadEmbeddedFonts } from "../src/card/fonts.js";
import { fetchCopy } from "../src/fetch/fetch.js";
import { coverageGap, coverageNote } from "../src/fetch/coverage.js";
import { annotate } from "../src/card/annotate.js";
import { rewriteAll } from "../src/rewrite/rewrite.js";
import { anthropicDrafter, apiKey } from "../src/rewrite/model.js";
import type { Jurisdiction } from "../src/engine/types.js";

type Options = {
  text?: string;
  url?: string;
  reference?: string;
  markets: Jurisdiction[];
  out: string;
  wordmark?: string;
  png: boolean;
  reviewedOn: Date;
};

function parse(argv: string[]): Options {
  let text: string | undefined;
  let url: string | undefined;
  let reference: string | undefined;
  let markets = supportedJurisdictions();
  let out = "./cards/scan";
  let wordmark: string | undefined;
  let png = false;
  let reviewedOn = new Date();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--text" && next !== undefined) [text, i] = [next, i + 1];
    else if (arg === "--file" && next !== undefined) {
      text = readFileSync(next, "utf8");
      reference = next;
      i += 1;
    } else if (arg === "--url" && next !== undefined) {
      url = next;
      reference = next;
      i += 1;
    } else if (arg === "--markets" && next !== undefined) {
      markets = next.split(",").map((m) => m.trim().toUpperCase()) as Jurisdiction[];
      i += 1;
    } else if (arg === "--out" && next !== undefined) [out, i] = [next, i + 1];
    else if (arg === "--wordmark" && next !== undefined) [wordmark, i] = [next, i + 1];
    else if (arg === "--source" && next !== undefined) [reference, i] = [next, i + 1];
    else if (arg === "--date" && next !== undefined) {
      // So a card can be regenerated identically, and so the suite is stable.
      reviewedOn = new Date(`${next}T00:00:00Z`);
      i += 1;
    } else if (arg === "--png") png = true;
  }

  if (text === undefined && url === undefined) {
    throw new Error(
      'Nothing to render. Pass --file ./page.txt, --text "…", or --url https://….\n' +
        `Markets available: ${supportedJurisdictions().join(", ")}.`,
    );
  }
  if (Number.isNaN(reviewedOn.getTime())) throw new Error("--date wants YYYY-MM-DD.");
  return { text, url, reference, markets, out, wordmark, png, reviewedOn };
}

/**
 * SVG to PNG, for the DM. Optional, and it says why when it cannot.
 *
 * Chromium is not a dependency of this project and is not installed by it.
 * Where one exists — PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM_PATH pointed at a
 * binary — this rasterises at 2× so the card survives a retina screen.
 */
async function rasterise(svg: string, to: string, width: number, height: number): Promise<void> {
  const { chromium } = await import("playwright-core");
  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`,
      { waitUntil: "load" },
    );
    await page.screenshot({ path: to });
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parse(process.argv.slice(2));

  let text = options.text;
  if (text === undefined && options.url) {
    const fetched = await fetchCopy(options.url, {
      own: process.argv.includes("--own"),
      contact: process.env.SCAN_CONTACT?.trim() || undefined,
    });
    for (const attempt of fetched.trace) {
      console.log(
        `  ${attempt.rung.padEnd(22)} ${attempt.outcome}` +
          (attempt.chars === undefined ? "" : ` (${attempt.chars} chars)`),
      );
    }
    const note = process.argv.includes("--whole")
      ? null
      : coverageNote(coverageGap(fetched.text, fetched.pageText, options.markets));
    if (note) console.log(`  ${note}\n`);
    else console.log("");
    if (fetched.thin) {
      throw new Error(
        `${options.url} gave back ${fetched.text.length} characters — almost certainly a page that ` +
          `builds itself in the browser. Copy the text by hand and use --file.`,
      );
    }
    text = process.argv.includes("--whole") ? fetched.pageText : fetched.text;
  }
  const copy = text ?? "";

  const result = scan({
    text: copy,
    source: options.reference ? { kind: "url", reference: options.reference } : { kind: "paste" },
    jurisdictions: options.markets,
  });

  const base = resolve(options.out);
  mkdirSync(dirname(base), { recursive: true });

  // Rewrites are opt-in. Without `--rewrite` the notes show each rule's own
  // remedy, which is correct and costs nothing; with it, the exact fixes run
  // offline and the rest go to the model — every draft through the same gate.
  const rewrites: Record<string, string> = {};
  if (process.argv.includes("--rewrite")) {
    const { marks } = annotate(copy, result.findings);
    const key = apiKey();
    if (!key) {
      console.log("(no ASSAY_ANTHROPIC_API_KEY — drafting the exact fixes only, and saying so.)");
    }
    const run = await rewriteAll(copy, marks, {
      drafter: key ? anthropicDrafter() : undefined,
      jurisdictions: options.markets,
    });
    Object.assign(rewrites, run.rewrites);
    for (const accepted of run.accepted) {
      console.log(`  rewrote ${JSON.stringify(accepted.claim)} → ${JSON.stringify(accepted.text)} [${accepted.source}]`);
    }
    for (const miss of run.missed) {
      // The rejection reason is the useful half: "the exact fix did not clear
      // the gate" is not actionable, and "it still trips the EU whole-product
      // rule, which needs the component named" is.
      const why = miss.rejected.at(-1);
      console.log(
        `  kept the remedy for ${JSON.stringify(miss.claim)} — ${miss.reason}` +
          (why ? `\n${" ".repeat(13)}${JSON.stringify(why.text)}: ${why.reason}` : ""),
      );
    }
    if (run.accepted.length + run.missed.length > 0) console.log("");
  }

  const fonts = loadEmbeddedFonts();
  const page = resultPage({
    text: copy,
    result,
    reviewedOn: options.reviewedOn,
    wordmark: options.wordmark,
    rewrites,
    fonts,
  });
  const card = shareCard({
    text: copy,
    result,
    reviewedOn: options.reviewedOn,
    wordmark: options.wordmark,
    fonts,
  });
  const badge = badgeSvg({ result, reviewedOn: options.reviewedOn, live: true });
  const lapsed = badgeSvg({ result, reviewedOn: options.reviewedOn, live: false });

  writeFileSync(`${base}.html`, page);
  writeFileSync(`${base}.card.svg`, card);
  writeFileSync(`${base}.badge.svg`, badge);
  writeFileSync(`${base}.badge-lapsed.svg`, lapsed);

  const written = [`${base}.html`, `${base}.card.svg`, `${base}.badge.svg`, `${base}.badge-lapsed.svg`];

  if (options.png) {
    try {
      await rasterise(card, `${base}.card.png`, OG_WIDTH, OG_HEIGHT);
      written.push(`${base}.card.png`);
    } catch (error) {
      console.warn(
        `PNG skipped — no Chromium available. Set CHROMIUM_PATH, or open the .html and screenshot it.\n` +
          `  (${error instanceof Error ? error.message.split("\n")[0] : error})`,
      );
    }
  }

  console.log(`${result.score.value}/100 · ${result.score.band} · ${result.findings.length} findings`);
  console.log(`badge: ${mayDisplayBadge(result) ? "eligible" : "not eligible"}`);
  for (const file of written) console.log(`  ${file}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
