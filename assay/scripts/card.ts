/**
 * `pnpm card` — a scan, rendered as the artefact.
 *
 * This is the kill test's whole toolchain. A founder points it at a page of
 * copy and gets back three files: the result page to read and send, the share
 * card at OG size to attach to a DM, and the badge as it would look on the
 * merchant's PDP. No key, no account, no network.
 *
 *   pnpm card --file page.txt --out ./cards/aurelia
 *   pnpm card --text "Clinically proven…" --markets AU,EU --wordmark VOUCH
 *   pnpm card --file page.txt --png          # needs a Chromium, see below
 *
 * `--wordmark` exists because the product has no name (BRIEF.md §11, item 1).
 * Thirty real founders reacting to thirty real cards is a better name test
 * than a shortlist, so the masthead is an argument rather than a constant.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { scan } from "../src/engine/evaluate.js";
import { supportedJurisdictions } from "../src/engine/registry.js";
import { badgeSvg, mayDisplayBadge } from "../src/card/badge.js";
import { shareCard, OG_HEIGHT, OG_WIDTH } from "../src/card/og.js";
import { resultPage } from "../src/card/page.js";
import { loadEmbeddedFonts } from "../src/card/fonts.js";
import type { Jurisdiction } from "../src/engine/types.js";

type Options = {
  text: string;
  reference?: string;
  markets: Jurisdiction[];
  out: string;
  wordmark?: string;
  png: boolean;
  reviewedOn: Date;
};

function parse(argv: string[]): Options {
  let text: string | undefined;
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

  if (text === undefined) {
    throw new Error(
      'Nothing to render. Pass --file ./page.txt or --text "…".\n' +
        `Markets available: ${supportedJurisdictions().join(", ")}.`,
    );
  }
  if (Number.isNaN(reviewedOn.getTime())) throw new Error("--date wants YYYY-MM-DD.");
  return { text, reference, markets, out, wordmark, png, reviewedOn };
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
  const result = scan({
    text: options.text,
    source: options.reference
      ? { kind: "url", reference: options.reference }
      : { kind: "paste" },
    jurisdictions: options.markets,
  });

  const base = resolve(options.out);
  mkdirSync(dirname(base), { recursive: true });

  const fonts = loadEmbeddedFonts();
  const page = resultPage({
    text: options.text,
    result,
    reviewedOn: options.reviewedOn,
    wordmark: options.wordmark,
    fonts,
  });
  const card = shareCard({
    text: options.text,
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
