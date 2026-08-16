/**
 * Compare mode, on the command line.
 *
 *   pnpm compare protein-bar rival-bar vegan
 *
 * BRIEF.md §9. The interesting thing to try is the same two bars against
 * different rule sets — the winner changes, which is the entire argument of §4
 * in one command.
 */

import { FIXTURES, type FixtureName } from "@/lib/fixtures";
import { PRESET_NAMES, presetByName } from "@/lib/rules/presets";
import { evaluate } from "@/lib/verdict/evaluate";
import { compare, comparisonHeadline } from "@/lib/verdict/compare";

const [first, second, presetName = "simple-ingredients"] = process.argv.slice(2);

if (!first || !second || !(first in FIXTURES) || !(second in FIXTURES)) {
  console.error(
    `usage: pnpm compare <label-a> <label-b> [rules]\n\nlabels: ${Object.keys(FIXTURES).join(", ")}\nrules:  ${PRESET_NAMES.join(", ")}`,
  );
  process.exit(1);
}

const ruleSet = presetByName(presetName);
if (!ruleSet) {
  console.error(`unknown rule set "${presetName}". known: ${PRESET_NAMES.join(", ")}`);
  process.exit(1);
}

const a = evaluate(FIXTURES[first as FixtureName], ruleSet);
const b = evaluate(FIXTURES[second as FixtureName], ruleSet);
const result = compare(a, b);

const line = (verdict: typeof a, isWinner: boolean) => {
  const score = verdict.match === null ? "  — " : `${String(verdict.match).padStart(3)}%`;
  const blockers =
    verdict.blockers.length === 0
      ? "no blockers"
      : verdict.blockers.length === 1
        ? "1 blocker"
        : `${verdict.blockers.length} blockers`;
  const known = verdict.flags.length + verdict.uncertain.length;
  console.log(
    `  ${isWinner ? "→" : " "} ${score}  ${(verdict.productName ?? "?").padEnd(36)} ${blockers}, ${known} to know`,
  );
};

console.log(`\n  WHICH FITS YOU BETTER?   (${ruleSet.label})\n`);
line(a, result.winner === "a");
line(b, result.winner === "b");

console.log(`\n  ${comparisonHeadline(result)}\n`);
if (result.blockedBy) {
  console.log(`  ${result.blockedBy}\n`);
} else {
  for (const reason of result.reasons) console.log(`  ✓ ${reason}`);
  console.log();
}
