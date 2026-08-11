// Render facing-page spreads for the website.
//
// Every image on the landing page is a cover. Nobody has seen a page — which
// is a strange thing to be true of a site selling a book, and probably the
// largest single gap left in it.
//
// These come off the same renderer as the press PDF, from the same volume
// definition, through the same archetypes and the same colour system. So the
// spread on the website is the spread off the press, not an impression of
// one drawn in CSS. That distinction is the whole reason to do it this way:
// a mock-up can promise anything, and would need re-drawing every time the
// book's typography moved.
//
// Pairs, not single pages, because a book is read two pages at a time and
// the facing-page relationship is most of what the design does — a
// full-bleed photograph opposite a quiet page of text, a quote given a whole
// side to itself. A carousel of single pages loses exactly the thing worth
// showing.
//
//     npm run spreads
//
// Output goes to public/sample/spreads/. Committed, because the website
// cannot render them at request time and nobody should need Chromium
// installed to build the site.

import { chromium } from "playwright-core";
import { mkdirSync, statSync } from "node:fs";
import sharp from "sharp";
import { renderBookHtml } from "../src/lib/pdf/html";
import { SAMPLE_BOOK } from "../src/lib/book/sample-volume";
import { SPREADS } from "../src/lib/marketing/spreads";

const OUT = "./public/sample/spreads";
mkdirSync(OUT, { recursive: true });

// Wide enough to stay sharp on a 2x display at the width the page shows it,
// and no wider. These are committed to the repository, so every extra pixel
// is paid for by everyone who clones it.
const WIDTH = 2000;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});
const page = await browser.newPage({
  viewport: { width: 1700, height: 1200 },
  deviceScaleFactor: 2,
});
await page.setContent(renderBookHtml(SAMPLE_BOOK, "print"), { waitUntil: "networkidle" });

// Build each spread in the page itself: clone the two rendered pages side by
// side and lay a gutter shadow across the join. Cloning rather than
// re-rendering means these are the very elements the PDF is made of.
await page.addStyleTag({
  content: `
    .spread-stage { position: absolute; left: 0; top: 0; z-index: 9999;
                    display: flex; background: #FEFCF8; }
    .spread-stage .page { margin: 0 !important; box-shadow: none !important; }
    .spread-gutter { position: absolute; top: 0; bottom: 0; left: 50%;
                     width: 5%; transform: translateX(-50%); pointer-events: none;
                     background: linear-gradient(90deg,
                       rgba(43,38,32,0) 0%, rgba(43,38,32,0.13) 42%,
                       rgba(43,38,32,0.20) 50%, rgba(43,38,32,0.13) 58%,
                       rgba(43,38,32,0) 100%); }
  `,
});

for (const spread of SPREADS) {
  const ok = await page.evaluate(([left, right]) => {
    document.querySelector(".spread-stage")?.remove();
    // No helper functions in here. esbuild injects a __name shim into named
    // functions for stack traces, and that shim does not exist inside the
    // browser — the whole evaluate throws "__name is not defined", which
    // looks nothing like the problem it is.
    const a = document.querySelector<HTMLElement>(`.page[data-page="${left}"]`);
    const b = document.querySelector<HTMLElement>(`.page[data-page="${right}"]`);
    if (!a || !b) return false;
    const stage = document.createElement("div");
    stage.className = "spread-stage";
    stage.append(a.cloneNode(true), b.cloneNode(true));
    const gutter = document.createElement("div");
    gutter.className = "spread-gutter";
    stage.append(gutter);
    document.body.prepend(stage);
    return true;
  }, [spread.left, spread.right] as const);

  if (!ok) {
    // Loud, because the alternative is a website quietly missing a spread.
    throw new Error(
      `Spread "${spread.id}" wants pages ${spread.left} and ${spread.right}, ` +
        `and the sample volume does not have both.`
    );
  }

  const shot = await page.locator(".spread-stage").screenshot();
  const file = `${OUT}/${spread.id}.webp`;
  // WebP, not PNG. These are photographic, they are committed to the
  // repository, and the image optimiser is switched off — so whatever is
  // written here is exactly what every visitor downloads. The same three
  // spreads as PNG came to 2.5MB.
  await sharp(shot).resize({ width: WIDTH }).webp({ quality: 82 }).toFile(file);
  const bytes = statSync(file).size;
  console.log(`${file}  pages ${spread.left}|${spread.right}  ${Math.round(bytes / 1024)}kB`);
  if (bytes > 400_000) {
    console.log(`  ⚠ over 400kB — heavy for a landing page`);
  }
}

await browser.close();
console.log(`\nwrote ${SPREADS.length} spreads to ${OUT}`);
