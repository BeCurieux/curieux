#!/usr/bin/env node
/**
 * The five front-page phones, shot from the running renderer.
 *
 * `capture.mjs` shoots the mood shops as `shop-<mood>.jpg`. This shoots the
 * five edits as `edit-*.jpg`, which is what the "One catalogue. Five shops."
 * section actually displays.
 *
 * Framed on the first block containing a product card rather than the top of
 * the page. A full-bleed hero fills a phone viewport entirely, so a capture
 * from the top of the document is a photograph of one product — which
 * demonstrates nothing about merchandising, and was how the first version of
 * these came out.
 */

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SLUGS = ["edit-ibiza", "edit-escape", "edit-wedding", "edit-budget", "edit-sale"];

/**
 * The phone in the hero, and why it is a second shot of a shop already here.
 *
 * The hero used `shop-luxe.jpg`, framed on the top of the page — which for a
 * luxe mood is a full-bleed tagline, so the advert for "we build you a shop"
 * was a dark slab with one line of type on it. The products, which are the
 * entire point, were below the fold of the capture.
 *
 * `edit-wedding` came from the identical sentence to the one printed in the
 * box beside it, so this is the shop that sentence actually produced — and
 * unlike `demo-luxe` it holds only photographed products, so the grid is
 * glassware rather than two initials standing in for missing pictures.
 *
 * Framed on the *second* product block: the first leads with one large
 * sold-out decanter, which is a good picture and a poor advert.
 */
const HERO = { slug: "edit-ibiza", block: 1, out: "hero.jpg" };

/** 390x845 at 2x — a phone, because that is what these shops are opened on. */
const VIEWPORT = { width: 390, height: 845 };

function chromiumPath() {
  const explicit = process.env.CHROMIUM_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (explicit) return explicit;
  const resolved = chromium.executablePath();
  return resolved && existsSync(resolved) ? resolved : null;
}

async function baseUrl() {
  if (process.env.PRESS_BASE_URL) return process.env.PRESS_BASE_URL.replace(/\/$/, "");
  try {
    const lock = JSON.parse(await readFile(path.join(process.cwd(), ".next", "dev", "lock"), "utf8"));
    if (typeof lock.appUrl === "string") return lock.appUrl.replace(/\/$/, "");
  } catch {
    /* reported below */
  }
  return null;
}

const executablePath = chromiumPath();
if (!executablePath) {
  process.stderr.write("\n  No Chromium. Set CHROMIUM_PATH, or run `pnpm exec playwright install chromium`.\n\n");
  process.exit(1);
}

const base = await baseUrl();
if (!base) {
  process.stderr.write("\n  No dev server. Run `pnpm dev` in another terminal, or set PRESS_BASE_URL.\n\n");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });

for (const slug of SLUGS) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await page.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle" });

  const found = await page.evaluate(() => {
    const block = [...document.querySelectorAll(".block")].find((b) => b.querySelector(".card"));
    if (!block) return false;
    block.scrollIntoView({ block: "start" });
    window.scrollBy(0, -12);
    return true;
  });

  if (!found) {
    process.stderr.write(`  ! ${slug} has no product grid — shooting the top of the page instead.\n`);
  }

  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/press/${slug}.jpg`, type: "jpeg", quality: 86 });
  process.stdout.write(`  ${slug}\n`);
  await page.close();
}

{
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await page.goto(`${base}/preview/${HERO.slug}`, { waitUntil: "networkidle" });
  await page.evaluate((n) => {
    const blocks = [...document.querySelectorAll(".block")].filter((b) => b.querySelector(".card"));
    (blocks[n] ?? blocks[0] ?? document.body).scrollIntoView({ block: "start" });
    window.scrollBy(0, -12);
  }, HERO.block);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/press/${HERO.out}`, type: "jpeg", quality: 88 });
  process.stdout.write(`  ${HERO.out.padEnd(14)} (hero, from ${HERO.slug})\n`);
  await page.close();
}

await browser.close();
process.stdout.write("\n  Six shots written to public/press/.\n\n");
