/**
 * Render the Phase 0 assets.
 *
 *   pnpm press
 *
 * Writes an SVG per fixture-and-profile pair into `press/`. These are what §9's
 * three seeded TikToks are filmed against — and the reason the build order puts
 * the renderer before the app.
 *
 * The set is chosen to cover what the videos need and what the founder needs to
 * look at before filming: the §7 demo, the clean-label demo, the supplement
 * demo, the control that is not alarming, and — deliberately included, because
 * it is the one nobody would choose to film — the badly photographed label that
 * refuses to produce a score.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FIXTURES, type FixtureName } from "@/lib/fixtures";
import { profileByName } from "@/lib/profile";
import { verdictFor } from "@/lib/verdict/score";
import { shareCard, verdictScreen } from "@/lib/render/card";

const SHOTS: { fixture: FixtureName; profile: string; why: string }[] = [
  { fixture: "rainbow-snack", profile: "clean-label", why: "§7 — the 'this says all natural' demo" },
  { fixture: "protein-biscuit", profile: "dairy-egg-household", why: "§4 ICP 1 — an allergen found" },
  { fixture: "protein-biscuit", profile: "clean-label", why: "the healthy-marketed product" },
  { fixture: "pre-workout", profile: "supplements", why: "§4 ICP 5 — the proprietary blend" },
  { fixture: "half-read", profile: "allergy-household", why: "the refusal — no score, and why" },
  { fixture: "oat-crackers", profile: "clean-label", why: "the control — not everything is alarming" },
];

const out = path.join(process.cwd(), "press");
await mkdir(out, { recursive: true });

for (const shot of SHOTS) {
  const profile = profileByName(shot.profile);
  if (!profile) throw new Error(`unknown profile ${shot.profile}`);

  const verdict = verdictFor(FIXTURES[shot.fixture], profile);
  const stem = `${shot.fixture}--${shot.profile}`;

  await writeFile(path.join(out, `${stem}.screen.svg`), verdictScreen(verdict), "utf8");
  await writeFile(path.join(out, `${stem}.share.svg`), shareCard(verdict), "utf8");

  const score = verdict.score === null ? "no score" : `${verdict.score}/100`;
  console.log(`${stem.padEnd(38)} ${score.padStart(9)}   ${shot.why}`);
}

console.log(`\n${SHOTS.length * 2} files in press/`);
