// Render the sample volume to PNGs — every page, plus a contact sheet.
// Same renderer as the print PDF, so what you see is what would print.
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

mkdirSync("./sample/png", { recursive: true });

// Reuse the sample book definition by importing the script's page data.
const src = readFileSync("./scripts/sample-book.ts", "utf8");
const body = src.slice(src.indexOf("const PAGES"), src.indexOf("const browser"));
const mod = `import { renderBookHtml } from "../src/lib/pdf/html";
import { colourForAge } from "../src/lib/book/colours";
${src.slice(src.indexOf("interface Scene"), src.indexOf("type B = RenderPage"))}
${src.slice(src.indexOf("type B = RenderPage"), src.indexOf("const browser"))}
export const html = renderBookHtml(book as any, "print");`;
writeFileSync("./scripts/_book.mts", mod.replace(/import type { RenderPage[^\n]*\n/g, ""));

const { html } = await import("./_book.mts");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1273 }, deviceScaleFactor: 1.4 });
await page.setContent(html, { waitUntil: "networkidle" });

const els = await page.$$(".page");
const names: string[] = [];
for (let i = 0; i < els.length; i++) {
  const n = `./sample/png/${String(i).padStart(2, "0")}.png`;
  await els[i].screenshot({ path: n });
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
  <div class="sub">Ordinary Tuesday · A4 portrait · ${names.length - 2} interior pages</div>
  <div class="grid">${thumbs}</div>
</body></html>`;

const sheetPage = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
await sheetPage.setContent(sheet, { waitUntil: "networkidle" });
await sheetPage.screenshot({ path: "./sample/png/contact-sheet.png", fullPage: true });

await browser.close();
console.log(`wrote ${names.length} page PNGs + contact sheet`);
