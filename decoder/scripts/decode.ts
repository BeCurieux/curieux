/**
 * The whole loop, from a photograph.
 *
 *   ANTHROPIC_API_KEY=... pnpm decode ./label.jpg --profile clean-label
 *
 * This is the definition of done for build steps 1–4: a photograph of a real
 * label in, a verdict and a share card out, every flag citing a source, and the
 * same photograph producing the same score every time it is run.
 *
 * The only non-deterministic step is the transcription. Everything after
 * `ParsedLabel` is ordinary code, which is the point of the architecture — when
 * a verdict is wrong, the question "was it the reading or the rules?" has an
 * answer, and `--dump-label` is how you get it.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnthropicVision, MODEL } from "@/lib/parse/anthropic";
import { PROMPT_VERSION, ParseError, parseLabel, type VisionRequest } from "@/lib/parse";
import { PROFILE_NAMES, profileByName } from "@/lib/profile";
import { verdictFor } from "@/lib/verdict/score";
import { allergenSentence, incompleteBanner, scoreHeadline } from "@/lib/verdict/language";
import { shareCard, verdictScreen } from "@/lib/render/card";

const argv = process.argv.slice(2);
const imagePath = argv.find((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

if (!imagePath) {
  console.error(`usage: pnpm decode <image> [--profile <name>] [--out <dir>] [--dump-label]\n\nprofiles: ${PROFILE_NAMES.join(", ")}`);
  process.exit(1);
}

const profile = profileByName(flag("profile") ?? "clean-label");
if (!profile) {
  console.error(`unknown profile. known: ${PROFILE_NAMES.join(", ")}`);
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
    // No verdict is shown. A verdict built on a label that would not validate
    // is the failure this whole design is arranged to avoid, and "we could not
    // read it" is a perfectly good answer.
    console.error(`\n  Could not read this label after ${error.attempts.length} attempts. No verdict shown.\n`);
    process.exit(2);
  }
  throw error;
}

const verdict = verdictFor(result.label, profile);
const elapsed = Date.now() - started;

if (argv.includes("--dump-label")) {
  console.log(JSON.stringify(result.label, null, 2));
  console.log();
}

const shown = verdict.score === null ? "— / no score" : `${verdict.score}/100`;
console.log();
console.log(`  ${shown} — ${scoreHeadline(verdict.score, verdict.category)}`);
console.log(`  for: ${verdict.profileLabel}${verdict.productName ? ` · ${verdict.productName}` : ""}`);
const banner = incompleteBanner(verdict);
if (banner) console.log(`\n  ⚠️  ${banner}`);
console.log();

for (const finding of verdict.allergens) console.log(`  ${allergenSentence(finding)}`);
if (verdict.allergens.length > 0) console.log();

const DOT = { red: "🔴", amber: "🟠", yellow: "🟡" } as const;
for (const f of verdict.flags) {
  console.log(`  ${DOT[f.severity]} ${f.ingredient}`);
  console.log(`     ${f.reason}`);
  if (f.lookFor) console.log(`     Look for: ${f.lookFor}`);
}
console.log();
for (const caveat of verdict.caveats) console.log(`  · ${caveat}`);

const outDir = flag("out");
if (outDir) {
  const stem = path.basename(imagePath, path.extname(imagePath));
  await writeFile(path.join(outDir, `${stem}.screen.svg`), verdictScreen(verdict), "utf8");
  await writeFile(path.join(outDir, `${stem}.share.svg`), shareCard(verdict), "utf8");
  console.log(`\n  wrote ${stem}.screen.svg and ${stem}.share.svg to ${outDir}`);
}

console.log(
  `\n  ${elapsed}ms · ${MODEL} · ${PROMPT_VERSION} · ${verdict.provenance.engineVersion} · ${verdict.provenance.knowledgeVersion} · ${result.provenance.attempts} attempt(s)\n`,
);
