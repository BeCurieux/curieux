/**
 * End-to-end smoke test against a running app: manual entry, three photos,
 * three ads, one real download — then the file is handed to ffprobe.
 *
 *   pnpm build && pnpm start &   # then:
 *   pnpm smoke -- --base http://localhost:3000 --photos a.jpg,b.jpg,c.jpg --out ./out
 *
 * Not in CI: it needs a browser that can encode video, which is a property of
 * the machine rather than of the commit.
 */

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const base = arg("base", "http://localhost:3000")!;
const photos = (arg("photos") ?? "").split(",").filter(Boolean);
const out = arg("out", "./smoke-out")!;
const exe = arg("browser", process.env.CHROMIUM_PATH);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));

await page.goto(base);
await page.getByRole("button", { name: "Enter the details yourself" }).click();
await page.getByLabel("Product name").fill("Ceramic Bud Vase | Speckled Stoneware");
await page.getByLabel("Price amount").fill("32.00");
await page.getByLabel("Currency code").fill("GBP");
await page.getByLabel("Shop name").fill("Fern & Kiln");
await page
  .getByLabel("Description")
  .fill("A small vase for a single stem.\n\n• Wheel-thrown stoneware\n• Speckled oatmeal glaze\n• Stands 12 cm tall");
await page.locator('input[type="file"]').setInputFiles(photos);
await page.getByRole("button", { name: "Make my 3 ads" }).click();
await page.locator(".ad").nth(2).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, "studio.png"), fullPage: true });

const first = page.locator(".ad").first();
await first.locator("canvas").screenshot({ path: path.join(out, "preview.png") });

const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 120_000 }),
  first.getByRole("button", { name: "Download" }).click(),
]);
const file = path.join(out, download.suggestedFilename());
await download.saveAs(file);
console.log(file);
await browser.close();
