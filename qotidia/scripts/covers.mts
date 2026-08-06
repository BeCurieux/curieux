// Every cover in the annual sequence, rendered through the real cover code.
//
// Not an illustration of the covers — the same renderBookHtml() and the same
// Charter that produces the print PDF, so what comes out is what would be
// manufactured. Ages nought to eighteen, each in its permanent colour, plus a
// shelf view of the spines together.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { renderBookHtml } from "../src/lib/pdf/html";
import { AGE_COLOURS, colourForAge } from "../src/lib/book/colours";
import { yearWord } from "../src/lib/book/structure";

const OUT = "./sample/covers";
mkdirSync(OUT, { recursive: true });

const CHILD = process.env.COVER_NAME ?? "Florence";
const FIRST_YEAR = 2026;

// A4 at 300dpi is 2480x3508. One CSS px is 1/96in, so the scale factor that
// lands exactly on 2480 wide is 300/96.
const PRINT_W = 2480, PRINT_H = 3508;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});

const files: { age: number; file: string; colour: string }[] = [];

for (const { age } of AGE_COLOURS) {
  const colour = colourForAge(age);
  const book = {
    cover: {
      childName: CHILD,
      ageWord: yearWord(age).toUpperCase(),
      year: String(FIRST_YEAR + age),
      imprint: "Qotidia",
      colour,
      spineWidthMm: 12.8,
    },
    pages: [],
  };

  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 300 / 96,
  });
  await page.setContent(renderBookHtml(book as any, "print"), { waitUntil: "networkidle" });
  const el = await page.$('[data-cover="front"]');
  if (!el) throw new Error(`no front cover rendered for age ${age}`);

  const file = `${OUT}/age-${String(age).padStart(2, "0")}.png`;
  await sharp(await el.screenshot())
    .resize(PRINT_W, PRINT_H, { fit: "cover", position: "top" })
    .png({ compressionLevel: 9 })
    .toFile(file);
  files.push({ age, file, colour: colour.hex });
  await page.close();
  console.log(`age ${String(age).padStart(2)}  ${colour.name.padEnd(20)} ${colour.hex}  ${file}`);
}

// Contact sheet — the whole sequence at once, which is the actual argument.
const sheetHtml = `<html><body style="margin:0;background:#ECE3D5;
  font-family:-apple-system,system-ui,sans-serif;padding:44px">
  <div style="font-size:30px;color:#2B2620">qotidia</div>
  <div style="font-size:15px;color:#6B6157;margin:10px 0 30px">
    Nineteen covers, one per age, each colour fixed for good.</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:22px">
  ${files.map((f) => `<div>
      <img src="data:image/png;base64,${readFileSync(f.file).toString("base64")}"
           style="width:100%;display:block;box-shadow:0 3px 14px rgba(0,0,0,.16)"/>
      <div style="font-size:12px;color:#6B6157;margin-top:7px">
        ${yearWord(f.age)} &middot; ${f.colour}</div>
    </div>`).join("")}
  </div></body></html>`;

const sheetPage = await browser.newPage({ viewport: { width: 1700, height: 1200 } });
await sheetPage.setContent(sheetHtml, { waitUntil: "networkidle" });
await sheetPage.screenshot({ path: `${OUT}/all-covers.png`, fullPage: true });
await sheetPage.close();

// Shelf view — spines together, which is how a family actually sees them.
const shelfHtml = `<html><body style="margin:0;background:#ECE3D5;
  font-family:-apple-system,system-ui,sans-serif;padding:56px 44px">
  <div style="font-size:15px;color:#6B6157;margin-bottom:26px">
    Eighteen years on a shelf. The gap is the one you haven&rsquo;t made yet.</div>
  <div style="display:flex;align-items:flex-end;gap:7px;border-bottom:5px solid #D4C8B6;padding-bottom:16px">
  ${AGE_COLOURS.filter((c) => c.age >= 1 && c.age <= 12).map((c, i) => {
    const missing = c.age === 7;
    const h = 330 + (i % 4) * 13;
    return `<div style="height:${h}px;width:62px;border-radius:3px 3px 0 0;
      ${missing ? "border:2px dashed #D4C8B6" : `background:${c.hex};color:${c.inkHex};box-shadow:0 2px 9px rgba(0,0,0,.14)`};
      display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:15px 6px">
      <span style="writing-mode:vertical-rl;white-space:nowrap;font-size:15px;
        ${missing ? "color:#8A8D86" : ""}">
        ${missing ? "not yet" : `The Year You Were ${yearWord(c.age)}`}</span>
      ${missing ? "" : `<span style="font-size:10px;letter-spacing:.16em;opacity:.65">${FIRST_YEAR + c.age}</span>`}
    </div>`;
  }).join("")}
  </div></body></html>`;

const shelfPage = await browser.newPage({ viewport: { width: 1100, height: 560 } });
await shelfPage.setContent(shelfHtml, { waitUntil: "networkidle" });
await shelfPage.screenshot({ path: `${OUT}/shelf.png`, fullPage: true });
await shelfPage.close();

await browser.close();
console.log(`\n${files.length} covers + contact sheet + shelf → ${OUT}`);
