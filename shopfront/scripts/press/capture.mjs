/**
 * Phone captures for the social mockups.
 *
 * Four frames per demo shop, all at the aspect ratio of the device frame they
 * get dropped into (390 x 845), so nothing is cropped or squashed on the way
 * in: the fold, the seam where the hero meets the grid, the grid itself, and
 * the foot of the page. Plus a clip of the badge on its own.
 *
 * Device scale factor 3 because the screen ends up ~560px wide in a 1080px
 * canvas and a 1x capture would show its pixels — and because the badge clip
 * gets blown up further still.
 */

import { launch } from "./browser.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const MOODS = ["utility", "clean", "playful", "editorial", "luxe"];
const OUT = resolve(import.meta.dirname, "../../.cache/press");
const BASE = process.env.PRESS_ORIGIN ?? "http://localhost:3000";

await mkdir(OUT, { recursive: true });

const VIEWPORT = { width: 390, height: 845 };
const SCALE = 3;

/**
 * Where each frame was taken from, in CSS pixels.
 *
 * The posters that show the page whole have to line up on the same regions,
 * and the offsets were briefly copied out of this script's log into the
 * composer by hand — which is a number in two files waiting to disagree.
 */
const offsets = {};

const browser = await launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
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

  // The foot frame: the end of the shop, where the badge lives. It is the
  // only frame that shows what a published shop actually gives back.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/phone-${mood}-foot.png` });

  // And the badge on its own, clipped from the page rather than redrawn, so
  // the poster shows the thing itself at a size somebody can read.
  // Clipped to the words, not to the element: the anchor carries the tap
  // target's padding, so its own box is half again as tall as the type and the
  // crop came out sitting at the top of a field of empty page.
  const badge = await page.evaluate(() => {
    const words = [...document.querySelectorAll(".badge span")];
    if (!words.length) return null;
    const boxes = words.map((word) => word.getBoundingClientRect());
    const top = Math.min(...boxes.map((b) => b.top));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    return {
      x: Math.min(...boxes.map((b) => b.left)),
      y: top,
      width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
      height: bottom - top,
    };
  });
  if (badge) {
    const pad = 22;
    await page.screenshot({
      path: `${OUT}/badge-${mood}.png`,
      clip: {
        x: Math.max(0, badge.x - pad),
        y: Math.max(0, badge.y - pad),
        width: Math.min(390, badge.width + pad * 2),
        height: badge.height + pad * 2,
      },
    });
  }

  // The whole page in one image. Posters that show the design full-bleed need
  // more than a screenful, and the scroll-through animates by moving this
  // behind a mask rather than by driving a real browser frame by frame.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/page-${mood}.png`, fullPage: true });

  offsets[mood] = { fold: 0, grid, mid };

  console.log(`${mood.padEnd(10)} fold + grid (${grid}) + mid (${mid}) + foot + badge + page`);
  await page.close();
}

await writeFile(
  `${OUT}/frames.json`,
  `${JSON.stringify({ viewport: VIEWPORT, scale: SCALE, offsets }, null, 2)}\n`,
);

await browser.close();
