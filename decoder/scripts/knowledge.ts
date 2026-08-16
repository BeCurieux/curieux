/**
 * What the graph knows, and what it does not.
 *
 *   pnpm knowledge
 *
 * BRIEF.md §18 wants the highest-value 300–500 ingredients and says "quality
 * matters more than breadth". §15 says the ontology, not the row count, is the
 * moat. So this prints both: how many entries there are, and — more usefully —
 * which classes nothing reaches yet, because an empty class is a rule somebody
 * can write that will silently never match anything.
 */

import { ALL_CLASSES, KNOWLEDGE, KNOWLEDGE_VERSION, classLabel, entriesInClass } from "@/lib/knowledge";
import { ALL_PRESETS } from "@/lib/rules/presets";

const TARGET = 300;

console.log(
  `\n  ${KNOWLEDGE_VERSION} — ${KNOWLEDGE.length} entries of a target ${TARGET} (${Math.round((KNOWLEDGE.length / TARGET) * 100)}%)\n`,
);

const empty: string[] = [];
console.log("  CLASS                          DIRECT  WITH CHILDREN");
for (const id of ALL_CLASSES) {
  const direct = KNOWLEDGE.filter((e) => e.classes.includes(id)).length;
  const all = entriesInClass(id).length;
  if (all === 0) empty.push(id);
  const mark = all === 0 ? "  ← nothing reaches this class" : "";
  console.log(`  ${id.padEnd(30)} ${String(direct).padStart(5)} ${String(all).padStart(13)}${mark}`);
}

/**
 * The check that matters more than any count: a preset rule whose target
 * matches nothing is a promise the product cannot keep, and it fails silently —
 * the user sees their rule in the list and simply never gets a finding from it.
 */
console.log("\n  PRESET RULES THAT CURRENTLY MATCH NOTHING");
let dead = 0;
for (const preset of ALL_PRESETS) {
  for (const rule of preset.rules) {
    const reach =
      rule.target.kind === "class"
        ? entriesInClass(rule.target.value).length
        : KNOWLEDGE.filter((e) => e.id === rule.target.value).length;
    if (reach === 0) {
      dead += 1;
      console.log(`    ${preset.id} / ${rule.id} → ${rule.target.kind} "${rule.target.value}"`);
    }
  }
}
if (dead === 0) console.log("    none — every preset rule reaches at least one entry");

const names = KNOWLEDGE.reduce((n, e) => n + e.names.length, 0);
const evidence = KNOWLEDGE.flatMap((e) => e.evidence);
const withUrl = evidence.filter((e) => e.url !== null).length;
const uncertain = KNOWLEDGE.filter((e) => e.uncertainty.length > 0).length;

console.log(`\n  ${names} label spellings across ${KNOWLEDGE.length} entries`);
console.log(`  ${ALL_CLASSES.length - empty.length}/${ALL_CLASSES.length} classes reachable`);
console.log(`  ${uncertain} entries carry a declared uncertainty`);
console.log(`  ${withUrl}/${evidence.length} citations carry a verified URL — attaching the rest is founder review work`);
console.log(`  ${ALL_PRESETS.length} presets, ${ALL_PRESETS.reduce((n, p) => n + p.rules.length, 0)} rules\n`);
