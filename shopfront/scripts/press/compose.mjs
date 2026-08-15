/**
 * Social posters: the sentence somebody typed, and the shop it produced.
 *
 * The first cut of these was editorial — near-black grounds, a serif quote, a
 * device. Handsome, and the wrong speed for a feed: it explained itself slowly
 * and the concept did not survive a thumb. This cut fixes both by being louder
 * about the same true thing.
 *
 * - The prompt sits in a white field with a cursor after it, so the causality
 *   reads without a caption: this was typed, that came out.
 * - The ground is popuup's violet rather than the merchant's colour, on every
 *   poster. It makes the set unmistakably one campaign, and it is the only
 *   ground the goods reliably pop against — pink goods on a pink poster
 *   vanished.
 * - The display face is Fraunces with wght, SOFT and WONK all pushed: heavy,
 *   rounded terminals, alternate letterforms. It is the only face in the repo
 *   that can be chunky without being generic, and its roundness is the same
 *   roundness as the wordmark.
 *
 * Composed as HTML and screenshotted rather than assembled in an image
 * library, because the phone frame, the grain, the glow and the type are all
 * things CSS is better at than I am, and because a poster that needs a tweak
 * is then a CSS tweak.
 *
 * The goods are drawn, not photographed — see shops.mjs. Every other pixel is
 * the renderer's own output at the size a phone shows it, screenshotted from a
 * running dev server rather than redrawn here, so a change to the template
 * shows up in the next poster without anybody remembering to update it.
 */

import { launch } from "./browser.mjs";
import { wordmark } from "./wordmark.mjs";
import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRATCH = `${ROOT}/.cache/press`;

/** popuup's own violet, and the two grounds that had to differ from it. */
const VIOLET = "#6C2BF5";
const VIOLET_LIT = "#A88BFF";
const INDIGO = "#241468";
const LILAC = "#CDBCFF";
const NAVY = "#130A3D";

const SHOPS = [
  {
    mood: "utility", brand: "Bench & Bolt", frame: "mid", layout: "claim",
    shout: "one line in.<br>a whole<br>shop out.",
    prompt: "the starter kit for someone setting up their first workshop",
    ground: VIOLET, lit: VIOLET_LIT, ink: "#FFFFFF", cutouts: [0, 2],
  },
  {
    mood: "clean", brand: "Sea Salt Skin", frame: "mid", layout: "split",
    shout: "you type<br>who is<br>coming.",
    prompt: "a first routine for someone who has never used skincare",
    ground: VIOLET, lit: VIOLET_LIT, ink: "#FFFFFF", cutouts: [1, 4],
  },
  {
    mood: "playful", brand: "Pip & Pockets", frame: "grid", layout: "bleed",
    shout: "no blocks.<br>no drag.<br>no builder.",
    prompt: "a gift edit for a two-year-old who ruins everything",
    ground: VIOLET, lit: VIOLET_LIT, ink: "#FFFFFF", cutouts: [2, 4],
  },
  {
    // Folio Press works in ultramarine, which is a neighbour of the violet and
    // disappears into it. Pale ground, dark ink, same family.
    mood: "editorial", brand: "Folio Press", frame: "mid", layout: "object",
    shout: "the prompt<br>is the<br>builder.",
    prompt: "a desk set for someone who has started writing by hand again",
    ground: LILAC, lit: "#EDE5FF", ink: NAVY, cutouts: [0, 6],
  },
  {
    // Gold on violet is muddy; gold on indigo is the whole point of gold.
    mood: "luxe", brand: "Maison Verre", frame: "mid", layout: "claim",
    shout: "same code.<br>nothing<br>looks alike.",
    prompt: "a wedding list for two people who already own everything",
    ground: INDIGO, lit: "#4A2FA8", ink: "#FFFFFF", cutouts: [3, 5],
  },
];

const FONTS = {
  // The full-axis cut, not the SOFT-only one the renderer ships: the posters
  // need WONK as well, and the extra 40KB never reaches a shopper.
  display: `${ROOT}/node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2`,
  sans: `${ROOT}/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2`,
};

async function dataUri(path, type) {
  return `data:${type};base64,${(await readFile(path)).toString("base64")}`;
}

const fonts = {
  display: await dataUri(FONTS.display, "font/woff2"),
  sans: await dataUri(FONTS.sans, "font/woff2"),
};

/**
 * Where the capture pass took each frame from, so a poster that shows the page
 * whole can land on the same region a phone frame lands on. Computed rather
 * than typed: the offsets are per shop and they move whenever the template's
 * spacing does.
 */
const frames = JSON.parse(await readFile(`${SCRATCH}/frames.json`, "utf8"));
const pageWidth = frames.viewport.width * frames.scale;

/** The y offset to apply to a full-page image rendered at `width`. */
const at = (mood, frame, width) =>
  Math.round(frames.offsets[mood][frame] * frames.scale * (width / pageWidth));

const shot = {};
const badgeShot = {};
const cutout = {};
for (const shop of SHOPS) {
  badgeShot[shop.mood] = await dataUri(`${SCRATCH}/badge-${shop.mood}.png`, "image/png");
  for (const frame of ["fold", "grid", "mid", "foot", "page"]) {
    const file = frame === "page" ? `page-${shop.mood}` : `phone-${shop.mood}-${frame}`;
    shot[`${shop.mood}-${frame}`] = await dataUri(`${SCRATCH}/${file}.png`, "image/png");
  }
  for (const index of shop.cutouts) {
    cutout[`${shop.mood}-${index}`] = await dataUri(`${SCRATCH}/cutout-${shop.mood}-${index}.svg`, "image/svg+xml");
  }
}

/**
 * Grain. Without it a flat saturated ground turns into a compression artefact
 * farm the moment Instagram re-encodes it.
 */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3"/></filter><rect width="220" height="220" filter="url(#n)" opacity="0.42"/></svg>`,
)}")`;

const BASE = `
  @font-face { font-family: Display; src: url(${fonts.display}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: Sans; src: url(${fonts.sans}) format("woff2"); font-weight: 300 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Sans, sans-serif; -webkit-font-smoothing: antialiased; }
  .canvas { position: relative; overflow: hidden; }
  .canvas::after {
    content: ""; position: absolute; inset: 0; background-image: ${GRAIN};
    mix-blend-mode: overlay; opacity: 0.42; pointer-events: none;
  }

  /* wght, SOFT and WONK together. Any one of them alone still reads as a
     magazine; all three read as a poster. */
  .shout {
    font-family: Display; font-weight: 900;
    font-variation-settings: "SOFT" 100, "WONK" 1, "opsz" 144;
    letter-spacing: -0.032em; line-height: 0.92;
  }
  .eyebrow { font-size: 19px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase; }

  /* The device. A bezel, a highlight along the top edge, and a shadow with a
     tight contact layer under a wide soft one — a single blurred shadow reads
     as a sticker. */
  .phone { position: absolute; border-radius: 58px; padding: 13px; background: #0B0B0D;
    box-shadow: 0 2px 0 rgba(255,255,255,0.16) inset, 0 0 0 1px rgba(0,0,0,0.2),
                0 40px 60px -20px rgba(28,6,80,0.5), 0 140px 160px -60px rgba(20,4,60,0.6); }
  .screen { border-radius: 46px; overflow: hidden; display: block; }
  .screen img { width: 100%; display: block; }

  /* Goods loose on the ground: no plate, no cast shadow of their own beyond a
     soft drop, so they read as objects on the poster rather than as pictures
     of objects. */
  .cut { position: absolute; }
  .cut img { width: 100%; display: block; filter: drop-shadow(0 26px 26px rgba(20,4,60,0.32)); }

  /* The prompt, as a field somebody typed into. */
  .typed { background: #FFFFFF; border-radius: 34px; box-shadow: 0 22px 44px -20px rgba(20,4,60,0.5); }
  .caret { display: inline-block; width: 4px; background: currentColor; margin-left: 7px;
    vertical-align: baseline; transform: translateY(0.13em); }

  /* A zoom of a real page, presented as one. */
  .callout { position: absolute; border-radius: 22px; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.2), 0 30px 60px -18px rgba(20,4,60,0.7); }
  .callout img { width: 100%; display: block; }

  /* The credit, as a sticker rather than a corner mark — it survives being
     screenshotted, cropped and reposted, which corner marks do not. */
  .sticker { position: absolute; z-index: 6; background: #FFFFFF; border-radius: 999px;
    display: flex; align-items: center; gap: 18px; padding: 18px 34px;
    box-shadow: 0 20px 40px -16px rgba(20,4,60,0.55); }
  .sticker span:first-child { font-size: 25px; font-weight: 600; color: ${NAVY}; }
`;

/** The eyebrow and caret need a colour with contrast on white, not the ground. */
const promptInk = (shop) => (shop.ground === LILAC ? "#5B23F5" : shop.ground);

/** #RRGGBB at an alpha, for scrims that fade into the poster's own ground. */
const hexa = (hex, alpha) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** "Made with popuup", in the brand's own colours on a white sticker. */
const sticker = (markWidth, extra = "") => `
  <div class="sticker" style="${extra}">
    <span>Made with</span>
    <span style="display:block; width:${markWidth}px">${wordmark({ id: `uu-${markWidth}` })}</span>
  </div>`;

const typed = (prompt, size, colour) => {
  const caret = `<span class="caret" style="height:${Math.round(size * 0.86)}px; color:${colour}"></span>`;
  // The caret is glued to the last word. Left loose it wrapped onto a line of
  // its own the moment a prompt happened to fill the final line exactly, which
  // reads as a typo rather than a cursor.
  const line = prompt.replace(/(\S+)$/, `<span style="white-space:nowrap">$1${caret}</span>`);

  return `
  <div class="typed" style="padding:${Math.round(size * 0.86)}px ${Math.round(size * 0.96)}px">
    <p class="eyebrow" style="font-size:${Math.round(size * 0.5)}px; color:${colour}; margin-bottom:${Math.round(size * 0.44)}px">Make me a shop for</p>
    <p style="font-size:${size}px; line-height:1.24; color:${NAVY}">${line}</p>
  </div>`;
};

// --------------------------------------------------------------- the frames

/**
 * One shop. The claim, the sentence, the thing that came out.
 *
 * Feed and story are the same design at two heights rather than two designs,
 * so the set stays one set.
 */
const FEED = {
  width: 1080, height: 1350, pad: 66, shout: 126, prompt: 30,
  promptTop: 470, phone: 528, phoneTop: 742, sticker: 128, stickerTop: 1214,
};
const STORY = {
  width: 1080, height: 1920, pad: 72, shout: 140, prompt: 32,
  promptTop: 620, phone: 596, phoneTop: 950, sticker: 138, stickerTop: 1770,
};

/**
 * Four layouts, not one repeated five times.
 *
 * A carousel of five identical frames stops being a campaign by the third
 * swipe — the eye has already read the layout and skips the rest. Each shop
 * gets the one that suits what it has: the loud claim, the page shown whole,
 * a hard split, or a single object at poster scale. What stays constant is the
 * violet, the face, the typed field and the sticker, which is what holds them
 * together as a set.
 */
const LAYOUTS = {};

/** The claim: chunky line, the sentence, the device, goods loose around it. */
LAYOUTS.claim = (shop, page) => `
  <div style="position:absolute; inset:0; background:radial-gradient(120% 68% at 14% -6%, ${shop.lit} 0%, transparent 62%)"></div>

  <div class="cut" style="width:${Math.round(page.width * 0.29)}px; left:-46px; top:${page.phoneTop - 110}px; transform:rotate(-17deg)">
    <img src="${cutout[`${shop.mood}-${shop.cutouts[0]}`]}" alt="">
  </div>
  <div class="cut" style="width:${Math.round(page.width * 0.245)}px; right:-38px; top:${page.phoneTop - 230}px; transform:rotate(15deg)">
    <img src="${cutout[`${shop.mood}-${shop.cutouts[1]}`]}" alt="">
  </div>

  <p class="shout" style="position:absolute; left:${page.pad}px; right:${page.pad}px; top:${Math.round(page.height * 0.068)}px; font-size:${page.shout}px">
    ${shop.shout}
  </p>

  <div style="position:absolute; left:${page.pad}px; right:${page.pad + 40}px; top:${page.promptTop}px">
    ${typed(shop.prompt, page.prompt, promptInk(shop))}
  </div>

  <div class="phone" style="width:${page.phone}px; left:${Math.round((page.width - page.phone) / 2 + 22)}px; top:${page.phoneTop}px; transform:rotate(-4deg)">
    <span class="screen"><img src="${shot[`${shop.mood}-${shop.frame}`]}" alt=""></span>
  </div>

  ${sticker(page.sticker, `left:${page.pad - 22}px; top:${page.stickerTop}px; transform:rotate(-4deg)`)}`;

/**
 * The page, whole and unframed.
 *
 * No bezel and no tilt, because the bezel is the most generic object in tech
 * marketing and it is standing in front of the only thing worth looking at.
 * The scrim exists so white type survives whatever part of the page lands
 * under it.
 */
LAYOUTS.bleed = (shop, page) => `
  <img src="${shot[`${shop.mood}-page`]}" alt="" style="position:absolute; top:${-at(shop.mood, shop.frame, page.width) + Math.round(page.height * 0.24)}px; left:0; width:${page.width}px; display:block">

  <!-- Solid, then a short fade. The first version fell away over half the
       poster and turned the whole page lilac; a scrim has to be either opaque
       or absent, and the fade is only there to keep the seam off the eye. -->
  <div style="position:absolute; inset:0; background:linear-gradient(180deg, ${shop.ground} 0%, ${shop.ground} ${Math.round(page.height * 0.24)}px, ${hexa(shop.ground, 0)} ${Math.round(page.height * 0.31)}px)"></div>
  <div style="position:absolute; inset:0; background:linear-gradient(0deg, ${shop.ground} 0%, ${shop.ground} ${Math.round(page.height * 0.16)}px, ${hexa(shop.ground, 0)} ${Math.round(page.height * 0.25)}px)"></div>

  <p class="shout" style="position:absolute; left:${page.pad}px; right:${page.pad}px; top:${Math.round(page.height * 0.045)}px; font-size:${Math.round(page.shout * 0.72)}px; color:${shop.ink}">
    ${shop.shout}
  </p>

  <div style="position:absolute; left:${page.pad}px; right:${page.pad + 40}px; bottom:${Math.round(page.height * 0.115)}px">
    ${typed(shop.prompt, Math.round(page.prompt * 0.92), promptInk(shop))}
  </div>

  ${sticker(page.sticker, `left:${page.pad - 22}px; bottom:${Math.round(page.height * 0.036)}px; transform:rotate(-3deg)`)}`;

/** A hard vertical split: the words on one side, the shop running off the other. */
LAYOUTS.split = (shop, page) => {
  const column = Math.round(page.width * 0.48);
  return `
  <div style="position:absolute; inset:0; background:radial-gradient(90% 60% at 0% 0%, ${shop.lit} 0%, transparent 64%)"></div>

  <!-- The page is not cropped to the panel, it overflows it downward, so the
       edge reads as a shop continuing past the frame rather than a thumbnail. -->
  <div style="position:absolute; left:${column}px; top:${Math.round(page.height * 0.07)}px; right:0; bottom:${-Math.round(page.height * 0.06)}px; overflow:hidden; border-radius:34px 0 0 34px; box-shadow:-30px 40px 80px -30px rgba(20,4,60,0.6)">
    <img src="${shot[`${shop.mood}-page`]}" alt="" style="position:absolute; top:${-at(shop.mood, shop.frame, page.width - column)}px; left:0; width:${page.width - column}px; display:block">
  </div>

  <p class="shout" style="position:absolute; left:${page.pad}px; width:${column - page.pad}px; top:${Math.round(page.height * 0.075)}px; font-size:${Math.round(page.shout * 0.82)}px">
    ${shop.shout}
  </p>

  <div class="cut" style="width:${Math.round(page.width * 0.26)}px; left:${Math.round(page.width * 0.05)}px; top:${Math.round(page.height * 0.44)}px; transform:rotate(-13deg)">
    <img src="${cutout[`${shop.mood}-${shop.cutouts[0]}`]}" alt="">
  </div>

  <div style="position:absolute; left:${page.pad}px; width:${Math.round(page.width * 0.62)}px; bottom:${Math.round(page.height * 0.13)}px; z-index:5">
    ${typed(shop.prompt, Math.round(page.prompt * 0.88), promptInk(shop))}
  </div>

  ${sticker(Math.round(page.sticker * 0.86), `left:${page.pad - 22}px; bottom:${Math.round(page.height * 0.04)}px; transform:rotate(-3deg)`)}`;
};

/** One object at poster scale, with the shop kept small and honest beside it. */
LAYOUTS.object = (shop, page) => `
  <div style="position:absolute; inset:0; background:radial-gradient(80% 56% at 76% 46%, ${shop.lit} 0%, transparent 66%)"></div>

  <div class="cut" style="width:${Math.round(page.width * 0.72)}px; right:${-Math.round(page.width * 0.09)}px; top:${Math.round(page.height * 0.2)}px; transform:rotate(9deg)">
    <img src="${cutout[`${shop.mood}-${shop.cutouts[0]}`]}" alt="">
  </div>

  <p class="shout" style="position:absolute; left:${page.pad}px; right:${page.pad}px; top:${Math.round(page.height * 0.062)}px; font-size:${page.shout}px">
    ${shop.shout}
  </p>

  <div class="phone" style="width:${Math.round(page.width * 0.25)}px; left:${page.pad}px; bottom:${Math.round(page.height * 0.175)}px;
       transform:rotate(-5deg); padding:8px; border-radius:30px">
    <span class="screen" style="border-radius:24px"><img src="${shot[`${shop.mood}-${shop.frame}`]}" alt=""></span>
  </div>

  <div style="position:absolute; left:${page.pad}px; width:${Math.round(page.width * 0.55)}px; bottom:${Math.round(page.height * 0.028)}px; z-index:5">
    ${typed(shop.prompt, Math.round(page.prompt * 0.84), promptInk(shop))}
  </div>

  ${sticker(Math.round(page.sticker * 0.8), `right:${page.pad - 20}px; bottom:${Math.round(page.height * 0.028)}px; transform:rotate(3deg)`)}`;

const portrait = (shop, page = FEED) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>
<div class="canvas" style="width:${page.width}px; height:${page.height}px; background:${shop.ground}; color:${shop.ink}">
  ${LAYOUTS[shop.layout](shop, page)}
</div></body></html>`;

/** All five at once: same sentence in, five different shops out. */
const fan = ({ width, height, phone, label }) => {
  // Laid out from the deck's total span, not from a gap I liked the look of:
  // at 0.86 of a phone width the outer two ran off both edges of the canvas
  // and lost their brand names.
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
<div class="canvas" style="width:${width}px; height:${height}px; background:${VIOLET}; color:#FFFFFF">
  <div style="position:absolute; inset:0; background:radial-gradient(110% 62% at 50% -12%, ${VIOLET_LIT} 0%, transparent 64%)"></div>
  <div style="position:absolute; inset:0; background:radial-gradient(80% 60% at 96% 108%, ${INDIGO} 0%, transparent 62%)"></div>

  <p class="shout" style="position:absolute; left:${label.x}px; right:${label.x}px; top:${label.top}px; font-size:${label.size}px; text-align:center">
    five prompts.<br>five shops.
  </p>
  <p style="position:absolute; left:${label.x}px; right:${label.x}px; top:${label.subTop}px; text-align:center; font-size:${label.sub}px; opacity:0.82">
    No builder. No templates. No drag.
  </p>

  ${cards}
  ${sticker(label.mark, label.stickerStyle ?? `left:50%; transform:translateX(-50%) rotate(-3deg); top:${label.stickerTop}px`)}
</div></body></html>`;
};

/**
 * The badge, which is the whole distribution plan.
 *
 * Every other poster shows what a merchant gets. This one shows what popuup
 * gets back, and it shows it by lifting the actual pixels off the bottom of an
 * actual page rather than setting the words again in a design file — the crop
 * and the phone beside it come from the same screenshot pass.
 */
const badgePoster = (mood) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>
<div class="canvas" style="width:1080px; height:1350px; background:${VIOLET}; color:#FFFFFF">
  <div style="position:absolute; inset:0; background:radial-gradient(110% 60% at 10% -8%, ${VIOLET_LIT} 0%, transparent 62%)"></div>
  <div style="position:absolute; inset:0; background:radial-gradient(80% 56% at 100% 106%, ${INDIGO} 0%, transparent 60%)"></div>

  <p class="shout" style="position:absolute; left:66px; right:66px; top:84px; font-size:118px">
    every free<br>shop ends<br>with this.
  </p>

  <p style="position:absolute; left:70px; top:${84 + 118 * 0.92 * 3 + 44}px; font-size:26px; line-height:1.5; opacity:0.84; max-width:560px">
    One line at the foot of the page, in the shop&rsquo;s own palette.<br>It is how the next merchant finds us.
  </p>

  <!-- The device sits fully inside the canvas here, unlike every other poster.
       It has to: the badge is the last thing on the page, so a phone that runs
       off the bottom edge crops off the only reason this frame exists. -->
  <div class="phone" style="width:392px; left:626px; top:520px; transform:rotate(3deg)">
    <span class="screen"><img src="${shot[`${mood}-foot`]}" alt=""></span>
  </div>

  <div class="callout" style="width:558px; left:52px; top:900px; transform:rotate(-3deg)">
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
  width: 1080, height: 1350,
  label: { x: 80, top: 92, size: 118, sub: 27, subTop: 350, mark: 122, stickerTop: 1222 },
  phone: { w: 296, top: 500, lift: 30 },
}), 1080, 1350);

await render("popuup-five-story", fan({
  width: 1080, height: 1920,
  label: { x: 80, top: 250, size: 128, sub: 29, subTop: 540, mark: 132, stickerTop: 700 },
  phone: { w: 460, gap: 0.44, top: 1020, lift: 36 },
}), 1080, 1920);

await render("popuup-five-wide", fan({
  width: 1600, height: 900,
  // Centred, the sticker stacked a third object under the headline and
  // above the deck. In the corner it reads as a mark on the poster.
  label: { x: 160, top: 66, size: 96, sub: 26, subTop: 268, mark: 118, stickerStyle: "left:88px; top:700px; transform:rotate(-3deg)" },
  phone: { w: 262, top: 470, lift: 24 },
}), 1600, 900);

/**
 * Web copies, for the landing page.
 *
 * The landing page needs the same screenshots the posters use, at a size that
 * belongs in a page rather than in a poster. Exporting them here rather than
 * committing a separate set means the page cannot show a template that no
 * longer exists — the thing this whole directory was built to stop.
 *
 * These land in `public/`, so unlike everything else here they are committed.
 */
const WEB = `${ROOT}/public/press`;
await mkdir(WEB, { recursive: true });

for (const shop of SHOPS) {
  const page = await browser.newPage({ viewport: { width: 780, height: 1690 }, deviceScaleFactor: 1 });
  await page.setContent(
    `<body style="margin:0"><img src="${shot[`${shop.mood}-mid`]}" style="width:780px;display:block"></body>`,
  );
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${WEB}/shop-${shop.mood}.jpg`, type: "jpeg", quality: 82 });
  await page.close();
  console.log(`public/press/shop-${shop.mood}.jpg`);
}

// The card a link to popuup unfurls into. 1200x630 is the size every crawler
// agrees on, so the deck is composed at it rather than scaled into it.
await render("og", fan({
  width: 1200, height: 630,
  label: { x: 120, top: 46, size: 78, sub: 22, subTop: 214, mark: 104, stickerStyle: "left:64px; top:470px; transform:rotate(-3deg)" },
  phone: { w: 210, top: 330, lift: 18 },
}), 1200, 630);
await copyFile(`${SCRATCH}/out/og.jpg`, `${ROOT}/public/press/og.jpg`);
console.log("public/press/og.jpg");

await browser.close();
