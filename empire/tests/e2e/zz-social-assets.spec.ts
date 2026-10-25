import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { signIn, takeQuiz } from "./fit-helpers";

// Records the five sales assets in docs/sales/SOCIAL_ASSETS.md from the real
// product screens, frame by frame at 1080×1920, with the approved captions
// burned in, then joins them into MP4s with ffmpeg. Also captures the full
// sample report image. Skipped unless RECORD_SOCIAL=1:
//
//   RECORD_SOCIAL=1 CI=1 npx playwright test tests/e2e/zz-social-assets.spec.ts --project=desktop

test.skip(!process.env.RECORD_SOCIAL, "set RECORD_SOCIAL=1 to record the social assets");
test.setTimeout(600_000);
test.use({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5 });

const OUT = "docs/sales/assets";
const FRAMES = process.env.SOCIAL_FRAMES_DIR ?? "/tmp/hle-social-frames";

class Recorder {
  private n = 0;
  constructor(
    private page: Page,
    private dir: string,
  ) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  async frame(times = 1) {
    const file = path.join(this.dir, `f${String(this.n).padStart(4, "0")}.png`);
    await this.page.screenshot({ path: file });
    this.n += 1;
    for (let i = 1; i < times; i++) {
      execFileSync("cp", [file, path.join(this.dir, `f${String(this.n).padStart(4, "0")}.png`)]);
      this.n += 1;
    }
  }
  /** Hold the current screen for `seconds` (10 frames a second). */
  async hold(seconds: number) {
    await this.frame(Math.round(seconds * 10));
  }
  async caption(text: string | null) {
    await this.page.evaluate((t) => {
      let el = document.getElementById("hle-cap");
      if (!t) return el?.remove();
      if (!el) {
        el = document.createElement("div");
        el.id = "hle-cap";
        el.setAttribute(
          "style",
          "position:fixed;left:5%;right:5%;top:12%;z-index:99999;background:#43252c;color:#f7f2e9;font-family:'Bodoni Moda',Georgia,serif;font-weight:800;font-size:25px;line-height:1.18;padding:14px 16px;border-radius:18px;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.18)",
        );
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
  }
  async scroll(px: number, seconds: number) {
    const steps = Math.round(seconds * 10);
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, px / steps);
      await this.page.waitForTimeout(30);
      await this.frame();
    }
  }
  async endCard(lines: { big: string; small: string[] }) {
    await this.page.evaluate((l) => {
      document.body.innerHTML = `<div style="position:fixed;inset:0;background:#f7f2e9;display:flex;flex-direction:column;justify-content:center;padding:36px;gap:18px;font-family:Inter,system-ui,sans-serif">
        <p style="font:700 11px Inter;letter-spacing:.2em;text-transform:uppercase;color:#b8384c">Her Little Empire</p>
        <h1 style="font-family:'Bodoni Moda',Georgia,serif;font-weight:800;font-size:38px;line-height:1.08;color:#43252c">${l.big}</h1>
        ${l.small.map((s) => `<p style="font-size:17px;line-height:1.4;color:#242122">${s}</p>`).join("")}
        <p style="margin-top:12px;font-family:'Bodoni Moda',Georgia,serif;font-size:18px;color:#43252c">Big plans. Real life.</p></div>`;
    }, lines);
    await this.hold(3);
  }
  render(name: string) {
    mkdirSync(OUT, { recursive: true });
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      "10",
      "-i",
      path.join(this.dir, "f%04d.png"),
      "-vf",
      "fps=30,scale=1080:1920:flags=lanczos,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      path.join(OUT, `${name}.mp4`),
    ]);
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      path.join(this.dir, "f0015.png"),
      "-vf",
      "scale=540:960",
      path.join(OUT, `${name}-cover.jpg`),
    ]);
  }
}

async function noBanner(page: Page) {
  const b = page.getByRole("button", { name: "No thanks" });
  if (await b.isVisible().catch(() => false)) await b.click();
}

test("1. Fit Check: ten minutes, five questions", async ({ page }) => {
  await page.goto("/fit-check");
  await noBanner(page);
  const r = new Recorder(page, `${FRAMES}/1`);
  await r.caption("Most side-income ideas don't fail because they're bad.");
  await r.hold(2.5);
  await r.caption("They fail because they don't fit the week you actually have.");
  await r.scroll(420, 2);
  await r.hold(1.5);
  await r.caption("Score up to three ideas: 0, 1 or 2 on five questions.");
  await r.scroll(260, 1.5);
  await r.hold(2);
  await r.caption("8–10: test it first. 5–7: possible. 0–4: park it.");
  await r.scroll(200, 1);
  await r.hold(2);
  await r.caption("Plus six red flags, including pay-to-join schemes.");
  await r.hold(2.5);
  await r.endCard({
    big: "The free 5-Question Fit Check",
    small: ["Ten minutes. No sign-up.", "Link in bio."],
  });
  r.render("01-fit-check");
});

test("2. FIT Finder: which side income fits your real week?", async ({ page }) => {
  // A free account: the video shows exactly what free users get.
  await signIn(page);
  await page.goto("/fit");
  await noBanner(page);
  const r = new Recorder(page, `${FRAMES}/2`);
  await r.caption("Which side income fits your real week?");
  await r.hold(2.5);
  await page.goto("/studio/fit");
  await r.caption("Twenty plain questions about your time, budget, skills and limits.");
  await r.hold(3);
  await takeQuiz(page, "Sam");
  await r.caption("Scored against 23 researched ideas, each one dated.");
  await r.hold(2.5);
  await r.caption("Your top three, free, with one line on why each fits.");
  await r.scroll(500, 3);
  await r.hold(2);
  await r.endCard({
    big: "The FIT Finder",
    small: ["Your top three, free, with why each fits.", "Link in bio."],
  });
  r.render("02-fit-finder");
});

test("3. Day 14: not enough evidence is a real answer", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");
  await page.getByRole("button", { name: "Local only: give me the Income Fit Test" }).click();
  await takeQuiz(page, "Sam");
  await noBanner(page);
  await page.getByRole("heading", { name: "Go, adjust or stop." }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, -120);
  const r = new Recorder(page, `${FRAMES}/3`);
  await r.caption("Day 14. Did it work?");
  await r.hold(2.5);
  await r.caption("Fewer than five real conversations isn't a no.");
  await r.scroll(260, 2);
  await r.hold(1.5);
  await r.caption("It's not enough evidence yet. So you run one more round.");
  await r.hold(2.5);
  await r.caption("Go, adjust, stop, or not enough evidence yet. Decided before you start.");
  await r.scroll(300, 2);
  await r.hold(1.5);
  await r.endCard({
    big: "The Income Fit Test · US$19",
    small: [
      "Your top three of 23 researched ideas, and a dated 14-day plan to test one cheaply.",
      "Full refund within 14 days of purchase, no questions asked.",
      "Link in bio.",
    ],
  });
  r.render("03-day-14");
});

test("4. Calculator: a ROAS above 1 can still be a loss", async ({ page }) => {
  await page.goto("/ads/tools/calculator");
  await noBanner(page);
  await page.getByLabel(/^Ad spend/).scrollIntoViewIfNeeded();
  const r = new Recorder(page, `${FRAMES}/4`);
  await r.caption("My ads made more than they cost. So why am I losing money?");
  await r.hold(2.5);
  await r.caption("Hypothetical: a A$49 download, A$140 of ads, 3 sales.");
  const spend = page.getByLabel(/^Ad spend/);
  await spend.fill("");
  for (const ch of "140") {
    await spend.press(ch);
    await r.frame(3);
  }
  const orders = page.getByLabel(/^Sales from ads/);
  await orders.fill("");
  await r.frame(3);
  await orders.press("3");
  await r.hold(1.5);
  await page.getByText("A ROAS above 1 can still be a loss").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, -200);
  await r.caption("ROAS 1.05. But break-even here is 1.17.");
  await r.hold(2.5);
  await r.caption("After ads: −A$14.51. And 3 sales isn't enough evidence either way.");
  await r.hold(3);
  await r.endCard({
    big: "The free ads calculator",
    small: [
      "Know your break-even before you boost.",
      "Your numbers stay in your browser.",
      "Link in bio.",
    ],
  });
  r.render("04-roas-calculator");
});

test("5. What US$19 gets you", async ({ page }) => {
  await page.goto("/income-fit-test");
  await noBanner(page);
  const r = new Recorder(page, `${FRAMES}/5`);
  await r.caption("What US$19 gets you.");
  await r.hold(2);
  await r.caption("Your top three of 23 researched ideas.");
  await r.scroll(900, 3);
  await r.caption("A calculator, the rules for five countries, a dated 14-day plan.");
  await r.scroll(1400, 4);
  await r.caption("What it won't do: promise you an income.");
  await page.getByRole("heading", { name: "What it won't do" }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, -150);
  await r.hold(2.5);
  await r.caption("Full refund within 14 days of purchase, no questions asked.");
  await r.hold(2.5);
  await r.endCard({
    big: "The Income Fit Test · US$19",
    small: ["Full refund within 14 days of purchase, no questions asked.", "Link in bio."],
  });
  r.render("05-what-you-get");
});

test("sample report image", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await signIn(page);
  await page.goto("/account");
  await page.getByRole("button", { name: "Local only: give me the Income Fit Test" }).click();
  await takeQuiz(page, "Sam");
  const png = `${FRAMES}/sample-report.png`;
  mkdirSync(FRAMES, { recursive: true });
  await page.screenshot({ path: png, fullPage: true });
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    png,
    "-vf",
    "scale=900:-1",
    "-q:v",
    "4",
    "public/images/income-fit-test/sample-report.jpg",
  ]);
});
