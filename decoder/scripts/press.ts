/**
 * Render the Phase 0 assets.
 *
 *   pnpm press
 *
 * BRIEF.md §22 wants 10–20 pieces of content across several creator accounts,
 * testing four named hypotheses rather than "would you use an ingredient
 * scanner". These are the mock-ups those pieces are filmed against, and the set
 * is chosen to cover the hypotheses rather than to look impressive:
 *
 *   A — personal rules create curiosity
 *   B — two users getting different verdicts is compelling
 *   C — Compare mode creates repeatable content
 *   D — users want to scan products themselves after watching
 *
 * They are mock-ups only in that no phone runs them. Every verdict inside is
 * computed by the real engine from real label text, because a fake door that
 * lies about the product tests a door nobody is buying — and §26 gates the
 * whole build on what these videos do.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FIXTURES, type FixtureName } from "@/lib/fixtures";
import { presetByName } from "@/lib/rules/presets";
import { evaluate } from "@/lib/verdict/evaluate";
import { compare } from "@/lib/verdict/compare";
import { compareCard, matchCard, shareCard, twoPeopleCard } from "@/lib/render/card";

const out = path.join(process.cwd(), "press");
await mkdir(out, { recursive: true });

const written: string[] = [];
async function write(name: string, svg: string, why: string) {
  await writeFile(path.join(out, `${name}.svg`), svg, "utf8");
  written.push(`${name.padEnd(40)} ${why}`);
}

const verdictFor = (fixture: FixtureName, preset: string) => {
  const rules = presetByName(preset);
  if (!rules) throw new Error(`unknown preset ${preset}`);
  return evaluate(FIXTURES[fixture], rules);
};

/* ---- Hypothesis A — personal rules create curiosity ---------------------- */

const SINGLE: { fixture: FixtureName; preset: string; why: string }[] = [
  { fixture: "rainbow-snack", preset: "simple-ingredients", why: "A · §12 Creative 4, the 'healthy' aisle" },
  { fixture: "protein-bar", preset: "simple-ingredients", why: "A · the health-marketed product" },
  { fixture: "pre-workout", preset: "no-artificial-sweeteners", why: "A · §29 Phase 4, the proprietary blend" },
  { fixture: "protein-bar", preset: "vegan", why: "A · §23's vegan creator line" },
  { fixture: "oat-crackers", preset: "simple-ingredients", why: "A · the control — §17 Rule 5, not everything is alarming" },
  { fixture: "half-read", preset: "peanut-listed", why: "A · the refusal — no score, and why" },
  { fixture: "rival-bar", preset: "peanut-listed", why: "A · §8's allergen alert taking over the screen" },
];

for (const shot of SINGLE) {
  const verdict = verdictFor(shot.fixture, shot.preset);
  const stem = `${shot.fixture}--${shot.preset}`;
  await write(`${stem}.result`, matchCard(verdict), shot.why);
  await write(`${stem}.share`, shareCard(verdict), "D · the share card for the above");
}

/* ---- Hypothesis B — two people, one packet ------------------------------- */

await write(
  "two-people--protein-bar",
  twoPeopleCard(verdictFor("protein-bar", "brief-user-a"), verdictFor("protein-bar", "brief-user-b")),
  "B · §4's USER A and USER B, on the same bar",
);

/* ---- Hypothesis C — Compare mode ----------------------------------------- */

for (const preset of ["simple-ingredients", "vegan", "low-added-sugar"]) {
  await write(
    `compare--${preset}`,
    compareCard(compare(verdictFor("protein-bar", preset), verdictFor("rival-bar", preset))),
    `C · §9, the same two bars against different rules`,
  );
}

for (const line of written) console.log(line);
console.log(`\n${written.length} files in press/`);
