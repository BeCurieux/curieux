// Render the sample volume to PNGs — every page, plus a contact sheet.
// Same renderer as the print PDF, so what you see is what would print.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { renderBookHtml } from "../src/lib/pdf/html";
import { SAMPLE_BOOK } from "../src/lib/book/sample-volume";

mkdirSync("./sample/png", { recursive: true });

// The volume comes from the shared module now. This used to read
// scripts/sample-book.ts as *text*, slice it between two hard-coded
// landmarks, and write the result out as a generated .mts file to import —
// which worked until somebody moved a line, and left a stale _book.mts in
// the repository either way.
const html = renderBookHtml(SAMPLE_BOOK, "print");

// A4 at 300dpi is 2480x3508px. One CSS pixel is 1/96in, so an A4 page is
// 793.7 x 1122.5 CSS px and the device scale factor that lands exactly on
// 2480 wide is 300/96 = 3.125. Rendering at this scale means the PNGs are
// press resolution, not screen resolution.
const PRINT_SCALE = 300 / 96;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: PRINT_SCALE,
});
await page.setContent(html, { waitUntil: "networkidle" });

// Prodigi wants A4 at 300dpi: exactly 2480 x 3508px. Chromium's element box
// lands a pixel or two off (and taller still where display type overhangs its
// line box), so every page is normalised to the exact spec afterwards. A file
// that is 2481px wide is the kind of thing a print system rejects.
const PRINT_W = 2480, PRINT_H = 3508;

const els = await page.$$(".page");
const names: string[] = [];
for (let i = 0; i < els.length; i++) {
  const n = `./sample/png/${String(i).padStart(2, "0")}.png`;
  const raw = await els[i].screenshot();
  await sharp(raw)
    .resize(PRINT_W, PRINT_H, { fit: "cover", position: "top" })
    .png({ compressionLevel: 9 })
    .toFile(n);
  names.push(n);
}

// Contact sheet: every page at a glance, so pacing is visible.
const thumbs = names.map((n, i) => {
  const b64 = readFileSync(n).toString("base64");
  const label = i === 0 ? "cover" : i === names.length - 1 ? "back" : String(i);
  return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${label}</figcaption></figure>`;
}).join("");

const sheet = `<html><head><style>
  body { margin:0; padding:40px; background:#EDEDE7;
         font-family:"Liberation Sans",Arial,sans-serif; }
  h1 { font-family:Charter,Georgia,serif; font-weight:400; font-size:26px;
       margin:0 0 4px; letter-spacing:-0.01em; }
  .sub { font-size:11px; letter-spacing:0.18em; text-transform:uppercase;
         color:#7A7D77; margin-bottom:28px; }
  .grid { display:grid; grid-template-columns:repeat(5,1fr); gap:22px 18px; }
  figure { margin:0; }
  img { width:100%; display:block; box-shadow:0 2px 10px rgba(0,0,0,.14); background:#fff; }
  figcaption { font-size:9px; letter-spacing:0.12em; color:#9DA09A; margin-top:6px;
               text-transform:uppercase; }
</style></head><body>
  <h1>The Year You Were Two — Florence</h1>
  <div class="sub">Qotidia · A4 portrait · ${names.length - 2} interior pages</div>
  <div class="grid">${thumbs}</div>
</body></html>`;

// The contact sheet is for reading on screen, so it stays at screen scale.
const sheetPage = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
await sheetPage.setContent(sheet, { waitUntil: "networkidle" });
await sheetPage.screenshot({ path: "./sample/png/contact-sheet.png", fullPage: true });

await browser.close();
console.log(`wrote ${names.length} page PNGs at 300dpi A4 + contact sheet`);
