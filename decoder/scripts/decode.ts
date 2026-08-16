/**
 * The whole loop, from a photograph.
 *
 *   ANTHROPIC_API_KEY=... pnpm decode ./label.jpg --rules vegan --out ./out
 *
 * The only non-deterministic step is the transcription. Everything after
 * `ParsedLabel` is ordinary code, which is BRIEF.md §7's architecture and the
 * reason `--dump-label` is worth having: when a verdict looks wrong, "was it the
 * reading or the rules?" has an answer, and §25 makes that distinction a
 * tracked metric rather than a debugging convenience.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnthropicVision, MODEL } from "@/lib/parse/anthropic";
import { PROMPT_VERSION, ParseError, parseLabel, type VisionRequest } from "@/lib/parse";
import { PRESET_NAMES, presetByName } from "@/lib/rules/presets";
import { evaluate } from "@/lib/verdict/evaluate";
import { allergenSentence, confidenceWord, incompleteBanner, matchHeadline } from "@/lib/verdict/language";
import { matchCard, shareCard } from "@/lib/render/card";

const argv = process.argv.slice(2);
const imagePath = argv.find((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

if (!imagePath) {
  console.error(`usage: pnpm decode <image> [--rules <name>] [--out <dir>] [--dump-label]\n\nrules: ${PRESET_NAMES.join(", ")}`);
  process.exit(1);
}

const ruleSet = presetByName(flag("rules") ?? "simple-ingredients");
if (!ruleSet) {
  console.error(`unknown rule set. known: ${PRESET_NAMES.join(", ")}`);
  process.exit(1);
}

const MEDIA: Record<string, VisionRequest["mediaType"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const mediaType = MEDIA[path.extname(imagePath).toLowerCase()];
if (!mediaType) {
  console.error(`unsupported image type: ${path.extname(imagePath)}`);
  process.exit(1);
}

if (!process.env["ANTHROPIC_API_KEY"]) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const started = Date.now();
const imageBase64 = (await readFile(imagePath)).toString("base64");

let result;
try {
  result = await parseLabel({ imageBase64, mediaType }, new AnthropicVision());
} catch (error) {
  if (error instanceof ParseError) {
    // No verdict is shown. §8 Step 2 — never silently guess — and a verdict
    // built on a label that would not validate is the failure the architecture
    // exists to avoid.
    console.error(`\n  Couldn't read this label after ${error.attempts.length} attempts. No verdict shown.\n`);
    process.exit(2);
  }
  throw error;
}

const verdict = evaluate(result.label, ruleSet);
const elapsed = Date.now() - started;

if (argv.includes("--dump-label")) {
  console.log(JSON.stringify(result.label, null, 2));
  console.log();
}

console.log();
console.log(`  ${verdict.match === null ? "— no match score" : `${verdict.match}% MATCH`}`);
console.log(`  ${matchHeadline(verdict)}`);
console.log(`  checked against: ${verdict.ruleSetLabel}${verdict.productName ? ` · ${verdict.productName}` : ""}`);

const banner = incompleteBanner(verdict);
if (banner) console.log(`\n  ⚠️  ${banner}`);
console.log();

for (const notice of verdict.allergens) console.log(`  ${notice.state === "listed" ? "⚠️ " : "   "}${allergenSentence(notice)}`);
if (verdict.allergens.length > 0) console.log();

const DOT = { blocker: "🔴", flag: "🟡", uncertain: "🟡", clear: "🟢" } as const;
for (const finding of [...verdict.blockers, ...verdict.flags, ...verdict.uncertain]) {
  console.log(`  ${DOT[finding.outcome]} ${finding.ingredient}`);
  console.log(`     ${finding.because}`);
  console.log(`     ${confidenceWord(finding)}`);
}
console.log();
for (const note of verdict.notes) console.log(`  · ${note}`);

const outDir = flag("out");
if (outDir) {
  const stem = path.basename(imagePath, path.extname(imagePath));
  await writeFile(path.join(outDir, `${stem}.result.svg`), matchCard(verdict), "utf8");
  await writeFile(path.join(outDir, `${stem}.share.svg`), shareCard(verdict), "utf8");
  console.log(`\n  wrote ${stem}.result.svg and ${stem}.share.svg to ${outDir}`);
}

console.log(
  `\n  ${elapsed}ms · ${MODEL} · ${PROMPT_VERSION} · ${verdict.provenance.engineVersion} · ${verdict.provenance.knowledgeVersion} · ${result.provenance.attempts} attempt(s)\n`,
);
