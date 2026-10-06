import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// Step 2 of the demo video (scripts/demo-video/README.md): lays each
// screenshot from out/shots in a device frame with its caption, plays the
// scenes one after another in a browser, records it, and encodes
// public/ovyko-demo.mp4 and its poster with ffmpeg.

const HERE = import.meta.dirname;
const ROOT = `${HERE}/../..`;
const OUT = `${HERE}/out`;
const W = 1280;
const H = 720;

type Device = "phone" | "laptop" | "ipad";
type Scene =
  | { kind: "title"; seconds: number }
  | { kind: "end"; seconds: number }
  | {
      kind: "screen";
      shot: string;
      device: Device;
      eyebrow: "For families" | "For your business" | "For instructors";
      text: string;
      seconds: number;
      // Slowly scroll a tall screenshot from top to bottom.
      scroll?: boolean;
    };

const SCENES: Scene[] = [
  { kind: "title", seconds: 5 },
  {
    kind: "screen",
    shot: "parent-home",
    device: "phone",
    eyebrow: "For families",
    text: "Sarah opens Ovyko. Ava’s swimming lesson is on Wednesday.",
    seconds: 5,
  },
  {
    kind: "screen",
    shot: "parent-absence",
    device: "phone",
    eyebrow: "For families",
    text: "Ava can’t make it this week. Sarah taps “Can’t make it”.",
    seconds: 5,
  },
  {
    kind: "screen",
    shot: "parent-makeups",
    device: "phone",
    eyebrow: "For families",
    text: "Ovyko shows only classes at Ava’s level with a real, open place.",
    seconds: 5,
  },
  {
    kind: "screen",
    shot: "parent-booked",
    device: "phone",
    eyebrow: "For families",
    text: "One tap to book the make-up. No phone calls.",
    seconds: 4.5,
  },
  {
    kind: "screen",
    shot: "owner-today",
    device: "laptop",
    eyebrow: "For your business",
    text: "Meanwhile, the owner sees which places can be filled this week.",
    seconds: 5.5,
  },
  {
    kind: "screen",
    shot: "owner-fill",
    device: "laptop",
    eyebrow: "For your business",
    text: "Ovyko finds families whose make-up credit fits each place, and can offer it for you.",
    seconds: 5.5,
  },
  {
    kind: "screen",
    shot: "family-waiting-list",
    device: "phone",
    eyebrow: "For families",
    text: "New families join the waiting list from the school’s own website.",
    seconds: 6,
    scroll: true,
  },
  {
    kind: "screen",
    shot: "owner-demand",
    device: "laptop",
    eyebrow: "For your business",
    text: "Everyone who’s waiting, in one place. A free place goes to the family who’s waited longest.",
    seconds: 7,
    scroll: true,
  },
  {
    kind: "screen",
    shot: "parent-place-offer",
    device: "phone",
    eyebrow: "For families",
    text: "Sarah gets the offer for Leo, and says yes in one tap.",
    seconds: 5,
  },
  {
    kind: "screen",
    shot: "parent-fees",
    device: "phone",
    eyebrow: "For families",
    text: "Fees by card or direct debit, or spread out at no extra cost. Reminders go out on their own.",
    seconds: 5.5,
  },
  {
    kind: "screen",
    shot: "owner-month",
    device: "laptop",
    eyebrow: "For your business",
    text: "Every month, Ovyko shows what it did: places filled, fees collected, hours saved.",
    seconds: 6.5,
    scroll: true,
  },
  {
    kind: "screen",
    shot: "owner-import",
    device: "laptop",
    eyebrow: "For your business",
    text: "Moving in is the easy part: Ovyko reads the export from your current system.",
    seconds: 6.5,
    scroll: true,
  },
  {
    kind: "screen",
    shot: "instructor-home",
    device: "ipad",
    eyebrow: "For instructors",
    text: "Poolside on the school iPad, instructor Mia sees today’s classes and nothing else.",
    seconds: 5,
  },
  {
    kind: "screen",
    shot: "instructor-roll",
    device: "ipad",
    eyebrow: "For instructors",
    text: "Big one-tap attendance, made for wet hands.",
    seconds: 4.5,
  },
  {
    kind: "screen",
    shot: "instructor-progress",
    device: "ipad",
    eyebrow: "For instructors",
    text: "Ava just kicked 10 metres. Mia ticks it off.",
    seconds: 4.5,
  },
  {
    kind: "screen",
    shot: "parent-progress",
    device: "phone",
    eyebrow: "For families",
    text: "That evening, Sarah sees the new skill in Ava’s progress.",
    seconds: 4.5,
  },
  { kind: "end", seconds: 6 },
];

const fontUrl = (pkg: string, file: string) =>
  `file://${ROOT}/node_modules/@fontsource-variable/${pkg}/files/${file}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const WORDMARK = `<span class="mark"><i style="background:#f38a78"></i><i style="background:#b8a7e8"></i><i style="background:#a7d9c8"></i><b>ovyko</b></span>`;

// Device sizes on the 1280×720 frame.
const FRAME: Record<Device, { w: number; h: number; radius: number; pad: number }> = {
  phone: { w: 300, h: 640, radius: 44, pad: 10 },
  ipad: { w: 450, h: 640, radius: 30, pad: 14 },
  laptop: { w: 1040, h: 560, radius: 14, pad: 0 },
};

function sceneHtml(scene: Scene, i: number): string {
  if (scene.kind === "title")
    return `<section class="scene title" data-i="${i}">
      <div class="copy">${WORDMARK}
        <h1>Fill classes.<br>Retain families.<br><em>Do less admin.</em></h1>
        <p>A week at a swim school, handled in Ovyko by a parent, the owner and an instructor.</p>
      </div></section>`;
  if (scene.kind === "end")
    return `<section class="scene end" data-i="${i}">
      <div class="copy">${WORDMARK}
        <h1>Now welcoming<br>founding schools</h1>
        <p>Swim schools, gymnastics, dance and martial arts: recurring weekly classes with levels.</p>
        <div class="links"><span class="pill">hello@ovyko.com.au</span><span>www.ovyko.com.au</span></div>
        <small>Ovyko is made by Sounding Labs · ABN 38 813 430 864 · Example data, not real families.</small>
      </div></section>`;
  const f = FRAME[scene.device];
  const img = `file://${OUT}/shots/${scene.shot}.png`;
  const inner = scene.device === "laptop" ? f.h - 34 : f.h - 2 * f.pad;
  const chrome =
    scene.device === "laptop"
      ? `<div class="bar"><i></i><i></i><i></i><span>www.ovyko.com.au</span></div>`
      : "";
  return `<section class="scene screen ${scene.device}" data-i="${i}">
    <div class="copy">${WORDMARK}
      <p class="eyebrow">${scene.eyebrow}</p>
      <h2>${esc(scene.text)}</h2>
    </div>
    <div class="device" style="width:${f.w}px;height:${f.h}px;border-radius:${f.radius}px;padding:${f.pad}px">
      ${chrome}
      <div class="glass" style="height:${inner}px;border-radius:${Math.max(f.radius - f.pad, 6)}px">
        <img src="${img}" class="${scene.scroll ? "scroll" : ""}" style="--d:${scene.seconds}s" />
      </div>
    </div></section>`;
}

function page(): string {
  const timeline = SCENES.map((s) => s.seconds);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Jakarta; src: url(${fontUrl("plus-jakarta-sans", "plus-jakarta-sans-latin-wght-normal.woff2")}); font-weight: 200 800; }
  @font-face { font-family: Bricolage; src: url(${fontUrl("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2")}); font-weight: 200 800; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #f8f6fb; font-family: Jakarta, sans-serif; color: #1f2230; }
  .scene { position: absolute; inset: 0; display: flex; align-items: center; gap: 56px; padding: 0 72px;
    opacity: 0; transition: opacity .45s ease;
    background: radial-gradient(circle at 92% 8%, #efe8fb 0, transparent 38%), radial-gradient(circle at 6% 96%, #fbe9e4 0, transparent 34%), #f8f6fb; }
  .scene.on { opacity: 1; }
  .mark { display: inline-flex; align-items: center; gap: 5px; }
  .mark i { width: 13px; height: 13px; border-radius: 50%; display: inline-block; }
  .mark b { font-family: Bricolage; font-weight: 600; font-size: 26px; margin-left: 6px; letter-spacing: -.02em; }
  .copy { flex: 1; display: flex; flex-direction: column; gap: 18px; }
  .on .copy > *:not(.mark) { animation: rise .7s cubic-bezier(.2,.7,.2,1) both; }
  .on .copy > *:nth-child(3) { animation-delay: .12s; }
  .on .copy > *:nth-child(4) { animation-delay: .24s; }
  .on .copy > *:nth-child(5) { animation-delay: .36s; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  .eyebrow { margin-top: 26px; text-transform: uppercase; letter-spacing: .08em; font-size: 15px; font-weight: 700; color: #b54a33; }
  h2 { font-family: Bricolage; font-weight: 600; font-size: 40px; line-height: 1.12; letter-spacing: -.02em; max-width: 460px; }
  /* Laptop screens are wide: the screen on top, the caption under it. */
  .screen.laptop { flex-direction: column-reverse; justify-content: center; gap: 22px; padding: 0 120px; }
  .screen.laptop .copy { flex: none; width: 100%; flex-direction: row; align-items: baseline; gap: 18px; }
  .screen.laptop .mark { display: none; }
  .screen.laptop .eyebrow { margin-top: 0; flex: none; }
  .laptop h2 { font-size: 26px; max-width: none; }
  .title h1, .end h1 { font-family: Bricolage; font-weight: 600; font-size: 76px; line-height: 1.02; letter-spacing: -.03em; margin-top: 18px; }
  .title h1 em { font-style: normal; color: #e0644e; }
  .title p, .end p { font-size: 22px; color: #3d4050; max-width: 700px; }
  .end { background: #1f2230; color: #fff; }
  .end p { color: #d7d8e0; }
  .end .links { display: flex; gap: 22px; align-items: center; font-size: 22px; font-weight: 600; }
  .end .pill { background: #f38a78; color: #1f2230; padding: 10px 22px; border-radius: 999px; }
  .end small { margin-top: 14px; color: #a3a5b4; font-size: 14px; }
  .device { flex: none; background: #1f2230; box-shadow: 0 40px 80px -40px rgba(31,34,48,.55); position: relative; }
  .laptop .device { background: #fff; border: 1px solid #e7e2ec; overflow: hidden; }
  .bar { height: 34px; display: flex; align-items: center; gap: 7px; padding: 0 14px; background: #f1ecf8; }
  .bar i { width: 11px; height: 11px; border-radius: 50%; background: #d9d2e6; }
  .bar span { margin-left: 18px; font-size: 12px; color: #626575; background: #fff; padding: 3px 14px; border-radius: 6px; }
  .glass { overflow: hidden; background: #fff; }
  .glass img { width: 100%; display: block; }
  .on .device { animation: slide .8s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes slide { from { opacity: 0; transform: translateX(40px) scale(.98); } to { opacity: 1; transform: none; } }
  .on img.scroll { animation: scroll var(--d) ease-in-out both; animation-delay: .9s; }
  @keyframes scroll { 0%, 8% { transform: translateY(0); } 92%, 100% { transform: translateY(calc(-100% + var(--h, 0px))); } }
  </style></head><body>
  ${SCENES.map(sceneHtml).join("\n")}
  <script>
    const times = ${JSON.stringify(timeline)};
    const scenes = [...document.querySelectorAll(".scene")];
    // Each scrolling screenshot stops at its own bottom edge.
    for (const img of document.querySelectorAll("img.scroll"))
      img.style.setProperty("--h", img.parentElement.clientHeight + "px");
    window.play = () => new Promise((done) => {
      let i = 0;
      const next = () => {
        scenes.forEach((s, j) => s.classList.toggle("on", j === i));
        if (i === scenes.length) return done();
        setTimeout(() => { i++; i === scenes.length ? done() : next(); }, times[i] * 1000);
      };
      next();
    });
  </script></body></html>`;
}

async function main() {
  const shots = readdirSync(`${OUT}/shots`);
  for (const s of SCENES)
    if (s.kind === "screen" && !shots.includes(`${s.shot}.png`))
      throw new Error(`Missing out/shots/${s.shot}.png: run the capture step first.`);
  rmSync(`${OUT}/video`, { recursive: true, force: true });
  mkdirSync(`${OUT}/video`, { recursive: true });
  writeFileSync(`${OUT}/scenes.html`, page());

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: `${OUT}/video`, size: { width: W, height: H } },
  });
  const started = Date.now();
  const tab = await context.newPage();
  await tab.goto(`file://${OUT}/scenes.html`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForLoadState("networkidle");
  await tab.waitForTimeout(500);
  const offset = (Date.now() - started) / 1000;
  await tab.evaluate(() => (window as unknown as { play: () => Promise<void> }).play());
  await tab.waitForTimeout(400);
  await context.close();
  await browser.close();

  const webm = readdirSync(`${OUT}/video`).find((f) => f.endsWith(".webm"))!;
  const total = SCENES.reduce((n, s) => n + s.seconds, 0);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-ss",
    offset.toFixed(2),
    "-i",
    `${OUT}/video/${webm}`,
    "-t",
    total.toFixed(2),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    `${ROOT}/public/ovyko-demo.mp4`,
  ]);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-ss",
    "2.5",
    "-i",
    `${ROOT}/public/ovyko-demo.mp4`,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    `${ROOT}/public/ovyko-demo-poster.jpg`,
  ]);
  const size = readFileSync(`${ROOT}/public/ovyko-demo.mp4`).length;
  console.log(`public/ovyko-demo.mp4: ${total}s, ${(size / 1e6).toFixed(1)} MB`);
}

await main();
