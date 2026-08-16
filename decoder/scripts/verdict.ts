/**
 * A verdict from a fixture label, without a camera or an API key.
 *
 *   pnpm verdict protein-bar brief-user-a
 *   pnpm verdict protein-bar brief-user-b     # §4's demonstration, both halves
 *   pnpm verdict half-read peanut-listed      # the refusal
 */

import { FIXTURES, type FixtureName } from "@/lib/fixtures";
import { PRESET_NAMES, presetByName } from "@/lib/rules/presets";
import { evaluate } from "@/lib/verdict/evaluate";
import {
  allergenSentence,
  clearSentence,
  confidenceWord,
  incompleteBanner,
  matchHeadline,
} from "@/lib/verdict/language";

const [fixtureName, presetName = "simple-ingredients"] = process.argv.slice(2);

if (!fixtureName || !(fixtureName in FIXTURES)) {
  console.error(
    `usage: pnpm verdict <label> [rules]\n\nlabels: ${Object.keys(FIXTURES).join(", ")}\nrules:  ${PRESET_NAMES.join(", ")}`,
  );
  process.exit(1);
}

const ruleSet = presetByName(presetName);
if (!ruleSet) {
  console.error(`unknown rule set "${presetName}". known: ${PRESET_NAMES.join(", ")}`);
  process.exit(1);
}

const verdict = evaluate(FIXTURES[fixtureName as FixtureName], ruleSet);
const DOT = { blocker: "🔴", flag: "🟡", uncertain: "🟡", clear: "🟢" } as const;

console.log();
console.log(`  ${verdict.match === null ? "— no match score" : `${verdict.match}% MATCH`}`);
console.log(`  ${matchHeadline(verdict)}`);
console.log(`  checked against: ${verdict.ruleSetLabel}${verdict.productName ? ` · ${verdict.productName}` : ""}`);

const banner = incompleteBanner(verdict);
if (banner) console.log(`\n  ⚠️  ${banner}`);
console.log();

for (const notice of verdict.allergens) {
  const mark = notice.state === "listed" ? "⚠️ " : "   ";
  console.log(`  ${mark}${allergenSentence(notice)}`);
}
if (verdict.allergens.length > 0) console.log();

for (const finding of [...verdict.blockers, ...verdict.flags, ...verdict.uncertain]) {
  console.log(`  ${DOT[finding.outcome]} ${finding.ingredient}`);
  console.log(`     ${finding.because}`);
  console.log(`     ${confidenceWord(finding)}${finding.evidence[0] ? ` · ${finding.evidence[0].body}` : ""}`);
  console.log();
}

const cleared = clearSentence(verdict.clearCount, verdict.readComplete);
if (cleared) console.log(`  🟢 ${cleared}\n`);

for (const note of verdict.notes) console.log(`  · ${note}`);
console.log();
