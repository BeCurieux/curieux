/**
 * Social mockups: the prompt, and the shop it produced.
 *
 * The product is one sentence in and a whole shop out, so every frame here
 * shows both halves and nothing else. The typed line is the merchant's actual
 * prompt from the demo config, not marketing copy written to sit above a
 * screenshot — if the words on the poster and the words that made the shop
 * ever drift apart, the poster is lying.
 *
 * Composed as HTML and screenshotted rather than assembled in an image
 * library, because the phone frame, the grain, the glow and the type are all
 * things CSS is better at than I am, and because a mockup that needs a tweak
 * is then a CSS tweak.
 *
 * The goods in these shops are drawn, not photographed — see shops.mjs. Every
 * other pixel is the renderer's own output at the size a phone actually shows
 * it, screenshotted from a running dev server rather than redrawn here, so a
 * change to the template shows up in the next poster without anybody
 * remembering to update it.
 */

import { launch } from "./browser.mjs";
import { wordmark } from "./wordmark.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRATCH = `${ROOT}/.cache/press`;

/** Grounds are darkened from each shop's own palette, not invented next to it. */
const SHOPS = [
  {
    mood: "utility", brand: "Bench & Bolt", frame: "mid",
    prompt: "the starter kit for someone setting up their first workshop",
    ground: "#17120D", ink: "#F7F0E5", accent: "#FF5A1F", glow: "#FF4A0D",
  },
  {
    mood: "clean", brand: "Sea Salt Skin", frame: "mid",
    prompt: "a first routine for someone who has never used skincare",
    ground: "#042B25", ink: "#E8FAF5", accent: "#22D6AC", glow: "#00B08B",
  },
  {
    mood: "playful", brand: "Pip & Pockets", frame: "grid",
    prompt: "a gift edit for a two-year-old who ruins everything",
    ground: "#360619", ink: "#FFE9F2", accent: "#FF4C86", glow: "#FF1F6B",
  },
  {
    mood: "editorial", brand: "Folio Press", frame: "mid",
    prompt: "a desk set for someone who has started writing by hand again",
    ground: "#0A0C32", ink: "#ECEBFF", accent: "#7C84FF", glow: "#1B23E8",
  },
  {
    mood: "luxe", brand: "Maison Verre", frame: "mid",
    prompt: "a wedding list for two people who already own everything",
    // Warmer and a shade up from the shop's own #0C0B0E: at the shop's exact
    // ground the phone's bezel vanished into the poster and the device lost
    // its edges entirely.
    ground: "#191309", ink: "#F6F0E4", accent: "#E8B23C", glow: "#E8B23C",
  },
];

const FONTS = {
  display: `${ROOT}/node_modules/@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2`,
  sans: `${ROOT}/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2`,
};

async function dataUri(path, type) {
  return `data:${type};base64,${(await readFile(path)).toString("base64")}`;
}

const fonts = {
  display: await dataUri(FONTS.display, "font/woff2"),
  sans: await dataUri(FONTS.sans, "font/woff2"),
};

const shot = {};
const badgeShot = {};
for (const shop of SHOPS) {
  badgeShot[shop.mood] = await dataUri(`${SCRATCH}/badge-${shop.mood}.png`, "image/png");
  for (const frame of ["fold", "grid", "mid", "foot"]) {
    shot[`${shop.mood}-${frame}`] = await dataUri(`${SCRATCH}/phone-${shop.mood}-${frame}.png`, "image/png");
  }
}

/**
 * Grain. Without it a flat dark ground photographs as a compression artefact
 * farm the moment Instagram re-encodes it.
 */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3"/></filter><rect width="220" height="220" filter="url(#n)" opacity="0.42"/></svg>`,
)}")`;

const BASE = `
  @font-face { font-family: Display; src: url(${fonts.display}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: Sans; src: url(${fonts.sans}) format("woff2"); font-weight: 300 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Sans, sans-serif; -webkit-font-smoothing: antialiased; }
  .canvas { position: relative; overflow: hidden; }
  .canvas::after {
    content: ""; position: absolute; inset: 0; background-image: ${GRAIN};
    mix-blend-mode: overlay; opacity: 0.5; pointer-events: none;
  }
  .glow { position: absolute; border-radius: 50%; filter: blur(120px); pointer-events: none; }
  .eyebrow {
    font-size: 19px; font-weight: 500; letter-spacing: 0.24em; text-transform: uppercase;
  }
  /* The device. A bezel, one highlight along the top edge, and a shadow with a
     tight contact layer under a wide soft one — a single blurred shadow reads
     as a sticker. */
  .phone { position: absolute; border-radius: 58px; padding: 13px; background: #0B0B0D;
    box-shadow: 0 2px 0 rgba(255,255,255,0.14) inset, 0 0 0 1px rgba(255,255,255,0.13),
                0 40px 60px -20px rgba(0,0,0,0.7), 0 140px 160px -60px rgba(0,0,0,0.85); }
  .screen { border-radius: 46px; overflow: hidden; display: block; }
  .screen img { width: 100%; display: block; }
  /* A zoom of a real page, presented as one: the crop keeps the shop's own
     ground, so the card only needs an edge and a shadow to read as lifted off
     the screen beside it. */
  .callout { position: absolute; border-radius: 22px; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.16), 0 30px 60px -18px rgba(0,0,0,0.75); }
  .callout img { width: 100%; display: block; }
`;

/**
 * "Made with popuup" — the real wordmark, and the same three words the free
 * tier's badge puts at the foot of every published shop.
 *
 * The dark letters take the poster's ink rather than the brand navy, which is
 * invisible on a near-black ground. The violet on the double-u is the one part
 * that never translates: it is what makes the mark recognisable at 200px, and
 * it is the piece the in-page badge keeps for the same reason.
 */
const VIOLET = "#9B7BFF";

const lockup = (width, ink, align = "right") => `
  <div style="display:flex; flex-direction:column; align-items:${align === "right" ? "flex-end" : "flex-start"}; gap:${Math.round(width * 0.055)}px">
    <span class="eyebrow" style="font-size:${Math.round(width * 0.082)}px; opacity:0.72">Made with</span>
    <span style="display:block; width:${width}px">${wordmark({ ink, accent: VIOLET, id: `uu-${align}-${width}` })}</span>
  </div>`;

// --------------------------------------------------------------- the frames

/**
 * One shop: the prompt above, the phone rising off the bottom edge.
 *
 * The same composition serves the feed and the story — a story is not a
 * different design, it is the same one with more air above the device, so it
 * takes a size rather than a second template.
 */
const FEED = { width: 1080, height: 1350, pad: 84, size: 60, phone: 566, top: 512 };
const STORY = { width: 1080, height: 1920, pad: 90, size: 64, phone: 620, top: 690 };

const portrait = (shop, page = FEED) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>
<div class="canvas" style="width:${page.width}px; height:${page.height}px; background:${shop.ground}; color:${shop.ink}">
  <div class="glow" style="width:900px; height:900px; left:-180px; top:-380px; background:${shop.glow}; opacity:0.3"></div>
  <div class="glow" style="width:700px; height:700px; right:-260px; top:${page.top}px; background:${shop.glow}; opacity:0.16"></div>

  <!-- The top block flows rather than being pinned line by line, because the
       prompts are two and three lines long and the rule under them has to
       follow the type, not a number I measured off one of them. -->
  <div style="position:absolute; left:${page.pad}px; right:${page.pad}px; top:${Math.round(page.height * 0.058)}px">
    <div style="display:flex; justify-content:space-between; align-items:flex-start">
      <span class="eyebrow" style="color:${shop.accent}">The prompt</span>
      ${lockup(196, shop.ink)}
    </div>

    <p style="margin-top:40px; padding-right:66px; font-family:Display; font-weight:400;
              font-size:${page.size}px; line-height:1.1; letter-spacing:-0.022em; text-wrap:balance">
      &ldquo;${shop.prompt}&rdquo;
    </p>

    <div style="margin-top:54px; display:flex; align-items:center; gap:18px">
      <span style="width:74px; height:2px; background:${shop.accent}; opacity:0.85"></span>
      <span class="eyebrow" style="font-size:16px; opacity:0.62">${shop.brand}</span>
    </div>
  </div>

  <div class="phone" style="width:${page.phone}px; left:${(page.width - page.phone) / 2}px; top:${page.top}px">
    <span class="screen"><img src="${shot[`${shop.mood}-${shop.frame}`]}" alt=""></span>
  </div>
</div></body></html>`;

/** All five at once: same sentence-in, five different shops out. */
const fan = ({ width, height, phone, label }) => {
  // The deck is laid out from its total span, not from a gap I liked the look
  // of: at 0.86 of a phone width the outer two ran off both edges of the
  // canvas and lost their brand names.
  const gap = phone.w * (phone.gap ?? 0.62);
  const span = gap * (SHOPS.length - 1) + phone.w;
  const left = (width - span) / 2;
  const cards = SHOPS.map((shop, i) => {
    const middle = (SHOPS.length - 1) / 2;
    const lift = Math.abs(i - middle) * phone.lift;
    const tilt = (i - middle) * 1.8;
    return `<div class="phone" style="width:${phone.w}px; left:${left + i * gap}px; top:${phone.top + lift}px;
      transform: rotate(${tilt}deg); padding:${Math.round(phone.w / 43)}px; border-radius:${Math.round(phone.w / 9.8)}px; z-index:${10 - Math.abs(i - middle)}">
      <span class="screen" style="border-radius:${Math.round(phone.w / 12.3)}px"><img src="${shot[`${shop.mood}-fold`]}" alt=""></span>
    </div>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>
<div class="canvas" style="width:${width}px; height:${height}px; background:#0B0A0C; color:#F4F1EA">
  <div class="glow" style="width:${width}px; height:${width * 0.7}px; left:${width * 0.06}px; top:${-width * 0.34}px; background:#FF4A0D; opacity:0.2"></div>
  <div class="glow" style="width:${width * 0.7}px; height:${width * 0.7}px; right:${-width * 0.2}px; bottom:${-width * 0.34}px; background:#1B23E8; opacity:0.26"></div>

  <!-- The wordmark leads instead of sitting in a corner, because the deck runs
       off the bottom edge and anything down there is half a phone deep. -->
  <div style="position:absolute; left:${label.x}px; right:${label.x}px; top:${label.top}px; text-align:center">
    <div style="display:flex; justify-content:center">${lockup(label.mark, "#F4F1EA", "left")}</div>
    <p style="margin-top:${label.gap}px; font-family:Display; font-weight:400; font-size:${label.size}px; line-height:1.08; letter-spacing:-0.024em">
      Five prompts. Five shops.<br>No builder, no templates, no drag.
    </p>
  </div>

  ${cards}
</div></body></html>`;
};

/**
 * The badge, which is the whole distribution plan.
 *
 * Every other poster here shows what a merchant gets. This one shows what
 * popuup gets back, and it shows it by lifting the actual pixels off the
 * bottom of an actual page rather than setting the words again in a design
 * file — the crop and the phone beside it come from the same screenshot pass.
 */
const badgePoster = (mood) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>
<div class="canvas" style="width:1080px; height:1350px; background:#0B0A0C; color:#F4F1EA">
  <div class="glow" style="width:820px; height:820px; left:-200px; top:-340px; background:#6C2BF5; opacity:0.34"></div>
  <div class="glow" style="width:640px; height:640px; right:-220px; bottom:-240px; background:#6C2BF5; opacity:0.2"></div>

  <div style="position:absolute; left:84px; right:84px; top:78px">
    <span class="eyebrow" style="color:${VIOLET}">The badge</span>
    <p style="margin-top:40px; font-family:Display; font-weight:400; font-size:62px;
              line-height:1.08; letter-spacing:-0.022em; padding-right:120px">
      Every free shop ends with this.
    </p>
    <p style="margin-top:30px; font-size:25px; line-height:1.5; opacity:0.66; max-width:640px">
      One line at the foot of the page, in the merchant&rsquo;s own palette. It is
      how the next merchant finds us.
    </p>
  </div>

  <!-- The device sits fully inside the canvas here, unlike every other poster.
       It has to: the badge is the last thing on the page, so a phone that runs
       off the bottom edge crops off the only reason this frame exists. -->
  <div class="phone" style="width:404px; left:604px; top:452px">
    <span class="screen"><img src="${shot[`${mood}-foot`]}" alt=""></span>
  </div>

  <div class="callout" style="width:560px; left:56px; top:900px; transform:rotate(-2.4deg)">
    <img src="${badgeShot[mood]}" alt="">
  </div>
</div></body></html>`;

// ------------------------------------------------------------------ compose

await mkdir(`${SCRATCH}/out`, { recursive: true });
const browser = await launch();

/**
 * PNG and JPEG for every frame. Instagram takes both; the JPEG is a fifth of
 * the weight and is the one that survives a phone's share sheet without being
 * re-encoded twice.
 */
async function render(name, html, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const file = `${SCRATCH}/${name}.html`;
  await writeFile(file, html);
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SCRATCH}/out/${name}.png` });
  await page.screenshot({ path: `${SCRATCH}/out/${name}.jpg`, type: "jpeg", quality: 94 });
  await page.close();
  console.log(`${name.padEnd(26)} ${width}x${height}`);
}

for (const shop of SHOPS) {
  await render(`popuup-${shop.mood}`, portrait(shop, FEED), FEED.width, FEED.height);
  await render(`popuup-${shop.mood}-story`, portrait(shop, STORY), STORY.width, STORY.height);
}

await render("popuup-badge", badgePoster("editorial"), 1080, 1350);

await render("popuup-five-feed", fan({
  width: 1080, height: 1350, label: { x: 90, top: 92, size: 56, gap: 40, mark: 236 },
  phone: { w: 296, top: 470, lift: 30 },
}), 1080, 1350);

await render("popuup-five-story", fan({
  width: 1080, height: 1920, label: { x: 90, top: 350, size: 62, gap: 46, mark: 268 },
  phone: { w: 460, gap: 0.44, top: 1000, lift: 36 },
}), 1080, 1920);

await render("popuup-five-wide", fan({
  width: 1600, height: 900, label: { x: 160, top: 66, size: 52, gap: 34, mark: 220 },
  phone: { w: 262, top: 356, lift: 24 },
}), 1600, 900);

await browser.close();
