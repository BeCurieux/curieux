/**
 * `pnpm rules` — what the corpus currently covers, and what it does not.
 *
 * Rule coverage is the thing this build traded away by starting from scratch,
 * so it is the thing worth being able to see at a glance rather than
 * estimating. Run it before promising a market to anybody.
 */

import { allPacks, supportedJurisdictions } from "../src/engine/registry.js";
import { CLAIM_CATEGORIES, LAUNCH_JURISDICTIONS, SEVERITY_WEIGHT } from "../src/engine/types.js";
import type { Jurisdiction } from "../src/engine/types.js";
import { TRIGGERS } from "../tests/fixtures/triggers.js";

const packs = allPacks();
const width = 62;

console.log("─".repeat(width));
console.log("The claim corpus");
console.log("─".repeat(width));

for (const pack of packs) {
  console.log("");
  console.log(`${pack.jurisdiction}  ${pack.label}`);
  console.log(`    pack version ${pack.version} · ${pack.rules.length} rules`);
  for (const rule of pack.rules) {
    const fixture = TRIGGERS[rule.id] ? "" : "   ← no fixture";
    console.log(
      `    ${rule.severity.padEnd(6)} −${String(SEVERITY_WEIGHT[rule.severity]).padStart(2)}  ` +
        `${rule.title}${fixture}`,
    );
    console.log(`            ${rule.categories.join(", ")} · ${rule.id}`);
  }
}

console.log("");
console.log("─".repeat(width));
console.log("Coverage by claim category");
for (const category of CLAIM_CATEGORIES) {
  const cells = supportedJurisdictions().map((jurisdiction: Jurisdiction) => {
    const count = packs
      .filter((pack) => pack.jurisdiction === jurisdiction)
      .flatMap((pack) => pack.rules)
      .filter((rule) => rule.categories.includes(category)).length;
    return `${jurisdiction} ${count}`;
  });
  console.log(`    ${category.padEnd(14)} ${cells.join("   ")}`);
}

// `sensory` is the category with no rules, and that is the correct number: a
// sensory claim is the one kind this product should be helping brands write
// more of, not less. It is printed anyway so the zero is a decision on the
// page rather than an omission nobody noticed.

console.log("");
const missing = (["GB", "CA_QC"] as Jurisdiction[]).filter((j) => !supportedJurisdictions().includes(j));
console.log(`Launch set:  ${LAUNCH_JURISDICTIONS.join(", ")}`);
console.log(`Not written: ${missing.join(", ")} — toggles for these do not exist, and a scan against them throws.`);
console.log("─".repeat(width));
