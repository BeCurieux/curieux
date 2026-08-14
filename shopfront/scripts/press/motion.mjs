/**
 * The scroll-through: somebody types a line, and a shop scrolls past.
 *
 * A still can show the prompt and the shop side by side; it cannot show one
 * becoming the other, and that is the entire product. This renders the whole
 * thing deterministically — a `render(t)` in the page, driven a frame at a
 * time from here — rather than recording a live browser, so the timing is a
 * number rather than a race and a re-run gives the identical file.
 *
 * The page does not really scroll. It is the full-page capture translated
 * behind a mask, which is smooth at any frame rate and does not depend on a
 * dev server keeping up.
 *
 * Output is WebM/VP8. The ffmpeg in this container is Playwright's build,
 * compiled with `--disable-everything` plus webm — no H.264, no GIF. Frames
 * go in as JPEG because the mjpeg decoder is the only one it has. Converting
 * to MP4 is one command anywhere with a normal ffmpeg:
 *
 *   ffmpeg -i popuup-playful.webm -c:v libx264 -pix_fmt yuv420p popuup-playful.mp4
 */

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { launch } from "./browser.mjs";
import { wordmark } from "./wordmark.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRATCH = `${ROOT}/.cache/press`;
const OUT = `${SCRATCH}/out`;

const FPS = 25;
const WIDTH = 1080;
const HEIGHT = 1920;

/** The cuts, in seconds. Everything else is derived from these. */
const BEAT = {
  hold: 0.5,       // an empty field, so the first frame is not mid-word
  type: 2.4,       // the prompt appearing a character at a time
  read: 0.7,       // long enough to finish reading it
  rise: 0.9,       // the field moves up, the phone comes in under it
  scroll: 4.6,     // the shop, top to bottom
  rest: 1.1,       // the foot of the page, where the badge is
};
const DURATION = Object.values(BEAT).reduce((a, b) => a + b, 0);

const SUBJECTS = [
  { mood: "playful", prompt: "a gift edit for a two-year-old who ruins everything", ground: "#6C2BF5", lit: "#A88BFF" },
  { mood: "utility", prompt: "the starter kit for someone setting up their first workshop", ground: "#6C2BF5", lit: "#A88BFF" },
];

const ffmpeg = ["/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux", "ffmpeg"].find((p) => p === "ffmpeg" || existsSync(p));
if (!ffmpeg) throw new Error("No ffmpeg.");

const b64 = async (p, t) => `data:${t};base64,${(await readFile(p)).toString("base64")}`;
const display = await b64(`${ROOT}/node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2`, "font/woff2");
const sans = await b64(`${ROOT}/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2`, "font/woff2");
const frames = JSON.parse(await readFile(`${SCRATCH}/frames.json`, "utf8"));

const PHONE = 640;
const SCREEN = PHONE - 26;
const SCREEN_H = Math.round(SCREEN * (frames.viewport.height / frames.viewport.width));

const document_ = (subject, page) => {
  const scale = SCREEN / (frames.viewport.width * frames.scale);
  const pageHeight = Math.round(page.height * scale);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Display; src: url(${display}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: Sans; src: url(${sans}) format("woff2"); font-weight: 300 700; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${WIDTH}px; height:${HEIGHT}px; overflow:hidden; background:${subject.ground};
    font-family: Sans, sans-serif; -webkit-font-smoothing: antialiased; color:#fff; }
  #lit { position:absolute; inset:0; background:radial-gradient(110% 56% at 16% -4%, ${subject.lit} 0%, transparent 62%); }
  #shout { position:absolute; left:72px; right:72px; top:96px; font-family:Display; font-weight:900;
    font-variation-settings:"SOFT" 100, "WONK" 1, "opsz" 144; letter-spacing:-0.032em; line-height:0.92; font-size:118px; }
  #field { position:absolute; left:72px; right:96px; background:#fff; border-radius:36px; padding:34px 38px;
    box-shadow:0 26px 50px -22px rgba(20,4,60,0.55); }
  #label { font-size:19px; font-weight:600; letter-spacing:0.24em; text-transform:uppercase; color:${subject.ground}; margin-bottom:16px; }
  #line { font-size:34px; line-height:1.24; color:#130A3D; min-height:1.24em; }
  #tail-wrap { white-space:nowrap; }
  #caret { display:inline-block; width:4px; height:0.86em; background:${subject.ground}; margin-left:7px; transform:translateY(0.13em); }
  #phone { position:absolute; left:${(WIDTH - PHONE) / 2}px; width:${PHONE}px; background:#0B0B0D; padding:13px;
    border-radius:60px; box-shadow:0 2px 0 rgba(255,255,255,0.16) inset, 0 40px 70px -22px rgba(20,4,60,0.6); }
  #screen { position:relative; width:${SCREEN}px; height:${SCREEN_H}px; border-radius:47px; overflow:hidden; background:#fff; }
  #screen img { position:absolute; left:0; top:0; width:${SCREEN}px; display:block; }
  #sticker { position:absolute; left:50%; background:#fff; border-radius:999px; display:flex; align-items:center; gap:18px;
    padding:20px 36px; box-shadow:0 22px 44px -18px rgba(20,4,60,0.6); }
  #sticker span:first-child { font-size:27px; font-weight:600; color:#130A3D; }
  </style></head><body>
  <div id="lit"></div>
  <p id="shout">one line in.<br>a whole<br>shop out.</p>
  <div id="field"><p id="label">Make me a shop for</p><p id="line"><span id="head"></span><span id="tail-wrap"><span id="tail"></span><span id="caret"></span></span></p></div>
  <div id="phone"><div id="screen"><img id="page" src="${page.src}"></div></div>
  <div id="sticker"><span>Made with</span><span style="display:block; width:150px">${wordmark({ id: "uu-motion" })}</span></div>

  <script>
  const PROMPT = ${JSON.stringify(subject.prompt)};
  const BEAT = ${JSON.stringify(BEAT)};
  const PAGE_HEIGHT = ${pageHeight};
  const SCREEN_H = ${SCREEN_H};

  const clamp = (v) => Math.max(0, Math.min(1, v));
  // Everything eases the same way. Mixed easings on one move read as a bug.
  const ease = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

  const at = {};
  let acc = 0;
  for (const [name, seconds] of Object.entries(BEAT)) { at[name] = acc; acc += seconds; }

  window.render = (t) => {
    // Typing. Characters, not a width transition — a width transition on text
    // looks like a loading bar, and this has to look like a person.
    const typing = clamp((t - at.type) / BEAT.type);
    const shown = PROMPT.slice(0, Math.round(PROMPT.length * typing));
    // The word being typed and the caret stay on one line together. Left to
    // wrap independently the caret dropped onto a line of its own every time
    // the text filled a line exactly, which reads as a stray character.
    const split = shown.lastIndexOf(" ");
    document.getElementById("head").textContent = split < 0 ? "" : shown.slice(0, split + 1);
    document.getElementById("tail").textContent = split < 0 ? shown : shown.slice(split + 1);

    // The caret blinks only once the typing stops, which is what a real one does.
    const done = t > at.read;
    document.getElementById("caret").style.opacity = done && Math.floor((t - at.read) * 2) % 2 ? 0 : 1;

    // The field lifts and the phone arrives under it, on the same curve.
    const rise = ease(clamp((t - at.rise) / BEAT.rise));
    document.getElementById("field").style.top = (620 - 500 * rise) + "px";
    document.getElementById("shout").style.opacity = 1 - rise;
    document.getElementById("phone").style.top = (HEIGHT_PX - rise * (HEIGHT_PX - 470)) + "px";

    // The scroll. It ends at the foot of the page, so the last thing on screen
    // is the badge — which is the point of the whole sequence.
    const travel = Math.max(0, PAGE_HEIGHT - SCREEN_H);
    const scrolled = ease(clamp((t - at.scroll) / BEAT.scroll));
    document.getElementById("page").style.top = (-travel * scrolled) + "px";

    document.getElementById("sticker").style.opacity = clamp((t - at.rest + 0.4) / 0.5);
    document.getElementById("sticker").style.top = (HEIGHT_PX - 150 - 30 * clamp((t - at.rest + 0.4) / 0.5)) + "px";
    document.getElementById("sticker").style.transform = "translateX(-50%) rotate(-3deg)";
  };
  const HEIGHT_PX = ${HEIGHT};
  window.render(0);
  </script></body></html>`;
};

await mkdir(OUT, { recursive: true });
const browser = await launch();

for (const subject of SUBJECTS) {
  const src = await b64(`${SCRATCH}/page-${subject.mood}.png`, "image/png");
  // The capture's own pixel height, so the scroll stops exactly at the foot
  // rather than at a number that happened to look right for one shop.
  const height = await (async () => {
    const buffer = await readFile(`${SCRATCH}/page-${subject.mood}.png`);
    return buffer.readUInt32BE(20);
  })();

  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const file = `${SCRATCH}/motion-${subject.mood}.html`;
  await writeFile(file, document_(subject, { src, height }));
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);

  const out = `${OUT}/popuup-${subject.mood}.webm`;
  const encoder = spawn(ffmpeg, [
    // `-i -` is not the same thing here: this build has the pipe protocol but
    // not fd, so the dash form dies with "Protocol not found". And the mjpeg
    // decoder has to be named — left to probe, image2pipe accepted the frames
    // and then wrote a file with no stream in it.
    "-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
    "-c:v", "libvpx", "-b:v", "4M", "-crf", "18", "-an", out,
  ], { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  let died = null;
  encoder.stderr.on("data", (chunk) => { stderr += chunk; });
  // Without this the loop happily screenshots several hundred frames into a
  // pipe nobody is reading, and reports the failure four minutes late.
  encoder.on("close", (code) => { if (code !== 0) died = code; });
  encoder.stdin.on("error", () => { died ??= "EPIPE"; });

  const total = Math.round(DURATION * FPS);
  for (let frame = 0; frame < total; frame += 1) {
    if (died !== null) throw new Error(`ffmpeg exited (${died}):\n${stderr.slice(-800)}`);
    await page.evaluate((t) => window.render(t), frame / FPS);
    const shot = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!encoder.stdin.write(shot)) await new Promise((r) => encoder.stdin.once("drain", r));
  }
  encoder.stdin.end();
  await new Promise((resolveExit, reject) => {
    encoder.on("close", (code) => (code === 0 ? resolveExit() : reject(new Error(stderr.slice(-800)))));
  });

  await page.close();
  console.log(`popuup-${subject.mood}.webm  ${total} frames  ${DURATION.toFixed(1)}s`);
}

await browser.close();
