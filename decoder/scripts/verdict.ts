/**
 * A verdict from a fixture label, without a camera or an API key.
 *
 *   pnpm verdict protein-biscuit clean-label
 *   pnpm verdict half-read allergy-household
 *
 * The second one is the one to run first. It is what the product says when it
 * could not read the whole label, and it is the answer the rest of the design
 * is arranged around.
 */

import { FIXTURES, type FixtureName } from "@/lib/fixtures";
import { PROFILE_NAMES, profileByName } from "@/lib/profile";
import { verdictFor } from "@/lib/verdict/score";
import { allergenSentence, clearedSentence, incompleteBanner, scoreHeadline } from "@/lib/verdict/language";

const [fixtureName, profileName = "clean-label"] = process.argv.slice(2);

if (!fixtureName || !(fixtureName in FIXTURES)) {
  console.error(`usage: pnpm verdict <fixture> [profile]\n\nfixtures: ${Object.keys(FIXTURES).join(", ")}\nprofiles: ${PROFILE_NAMES.join(", ")}`);
  process.exit(1);
}

const profile = profileByName(profileName);
if (!profile) {
  console.error(`unknown profile "${profileName}". known: ${PROFILE_NAMES.join(", ")}`);
  process.exit(1);
}

const label = FIXTURES[fixtureName as FixtureName];
const verdict = verdictFor(label, profile);

const DOT = { red: "🔴", amber: "🟠", yellow: "🟡" } as const;

console.log();
const shown = verdict.score === null ? "— / no score" : `${verdict.score}/100`;
console.log(`  ${shown} — ${scoreHeadline(verdict.score, verdict.category)}`);
console.log(`  for: ${verdict.profileLabel}${verdict.productName ? ` · ${verdict.productName}` : ""}`);
const banner = incompleteBanner(verdict);
if (banner) console.log(`\n  ⚠️  ${banner}`);
console.log();

if (verdict.allergens.length > 0) {
  for (const finding of verdict.allergens) console.log(`  ${allergenSentence(finding)}`);
  console.log();
}

for (const flag of verdict.flags) {
  console.log(`  ${DOT[flag.severity]} ${flag.ingredient}`);
  console.log(`     ${flag.reason}`);
  if (flag.lookFor) console.log(`     Look for: ${flag.lookFor}`);
  const meta = [flag.strength, flag.sources[0]?.body].filter(Boolean).join(" · ");
  if (meta) console.log(`     (${meta})`);
  console.log();
}

const cleared = clearedSentence(verdict.clearedCount);
if (cleared) console.log(`  ✅ ${cleared}\n`);

for (const caveat of verdict.caveats) console.log(`  · ${caveat}`);
console.log();
