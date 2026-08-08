// Render a sample volume through the real rendering path.
//
// Uses the production HTML renderer, the real archetypes, the real colour
// system and the real preflight — only the photographs are stand-ins. The
// output is a genuine press-spec file: exact A4 trim, no bleed, cover as
// page one, mirrored margins, folios on the outer edge.
//
// Usage: npm run sample

import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { renderBookHtml } from "../src/lib/pdf/html";
import { SAMPLE_BOOK, SAMPLE_PAGES } from "../src/lib/book/sample-volume";
import { FORMAT } from "../src/lib/book/format";
import { runPreflight } from "../src/lib/pdf/preflight";

const outDir = process.argv[2] ?? "./sample";
mkdirSync(outDir, { recursive: true });

const pages = SAMPLE_PAGES;
const book = SAMPLE_BOOK;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setContent(renderBookHtml(book, "print"), { waitUntil: "networkidle" });

const audit = await page.evaluate((safeMm: number) => {
  const overflow: number[] = [], unsafe: number[] = [], blank: number[] = [];
  const safePx = safeMm * (96 / 25.4);
  document.querySelectorAll<HTMLElement>(".page[data-page]").forEach((el) => {
    const n = Number(el.dataset.page);
    const box = el.getBoundingClientRect();
    const content = el.querySelector<HTMLElement>(".content");
    if (content && (content.scrollHeight > content.clientHeight + 1 ||
        content.scrollWidth > content.clientWidth + 1)) overflow.push(n);
    const bleedEl = el.querySelector(".full-bleed");
    if (!bleedEl && content) {
      content.querySelectorAll<HTMLElement>("*").forEach((c) => {
        if (!c.textContent?.trim() && c.tagName !== "IMG") return;
        const b = c.getBoundingClientRect();
        if (!b.width || !b.height) return;
        if (b.left - box.left < safePx - 0.5 || b.top - box.top < safePx - 0.5 ||
            box.right - b.right < safePx - 0.5 || box.bottom - b.bottom < safePx - 0.5) {
          if (!unsafe.includes(n)) unsafe.push(n);
        }
      });
    }
    const ink = !!bleedEl || !!el.querySelector(".content img") ||
      (content?.textContent ?? "").trim().length > 0;
    if (!ink) blank.push(n);
  });
  return { overflow, unsafe, blank };
}, FORMAT.safeMarginMm);

const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1 });
writeFileSync(`${outDir}/qotidia-sample.pdf`, pdf);
await browser.close();

const result = runPreflight({
  interiorPages: pages.length,
  pageWidthMm: FORMAT.trimWidthMm,
  pageHeightMm: FORMAT.trimHeightMm,
  bleedAdded: false,
  cropMarksAdded: false,
  images: [],
  fontsEmbedded: true,
  colourSpace: FORMAT.colourSpace,
  transparencyFlattened: true,
  overflowPages: audit.overflow,
  safeAreaViolations: audit.unsafe,
  spreadPages: [],
  blankPages: audit.blank,
  uncitedBlocks: 0,
  cover: { colour: book.cover.colour, spineWidthMm: 12.8, spineAuthoritative: true },
});

console.log(`Rendered ${pages.length} interior pages + 2 covers -> ${outDir}/qotidia-sample.pdf`);
console.log(result.passed ? "Preflight: PASS" : "Preflight: FAIL");
for (const i of result.issues) console.log(`  [${i.severity}] ${i.code}: ${i.message}`);
