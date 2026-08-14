/**
 * Phone captures for the social mockups.
 *
 * Two frames per demo shop, both at the aspect ratio of the device frame they
 * get dropped into (390 x 845), so nothing is cropped or squashed on the way
 * in: the fold, and the same shop scrolled to the first full row of the grid.
 * Device scale factor 3 because the screen ends up ~560px wide in a 1080px
 * canvas and a 1x capture would show its pixels.
 */

import { launch } from "./browser.mjs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const MOODS = ["utility", "clean", "playful", "editorial", "luxe"];
const OUT = resolve(import.meta.dirname, "../../.cache/press");
const BASE = process.env.PRESS_ORIGIN ?? "http://localhost:3000";

await mkdir(OUT, { recursive: true });

const browser = await launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 845 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

for (const mood of MOODS) {
  const page = await context.newPage();
  await page.goto(`${BASE}/preview/demo-${mood}`, { waitUntil: "networkidle" });
  // The dev-server overlay is a real element in the page, and it planted a
  // dark circle over the bottom-left card in the first pass.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(700);

  await page.screenshot({ path: `${OUT}/phone-${mood}-fold.png` });

  // The grid frame: scroll so the first row of cards sits just under the top
  // edge rather than at some arbitrary offset, which is what makes five
  // different shops line up as a set.
  const grid = await page.evaluate(() => {
    const card = document.querySelector(".card");
    if (!card) return null;
    const top = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - 96));
    return Math.round(window.scrollY);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/phone-${mood}-grid.png` });

  // The mid frame catches the seam — the end of the hero, the headline, and
  // the first row of the grid in one screen. It is the frame that reads as a
  // shop rather than as a picture or a list.
  const mid = await page.evaluate(() => {
    const headline = document.querySelector(".hero-copy h1");
    if (!headline) return null;
    window.scrollTo(0, Math.max(0, headline.getBoundingClientRect().top + window.scrollY - 70));
    return Math.round(window.scrollY);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/phone-${mood}-mid.png` });

  console.log(`${mood.padEnd(10)} fold + grid (${grid}) + mid (${mid})`);
  await page.close();
}

await browser.close();
