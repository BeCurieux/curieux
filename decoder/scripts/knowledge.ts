/**
 * What the knowledge base knows, and what it does not.
 *
 *   pnpm knowledge
 *
 * BRIEF.md §11 wants ~300 entries. This prints where the seed actually stands,
 * per axis, so the gap is a number somebody has to look at rather than an
 * impression. The same habit as the rest of the repository: a cap that
 * announces itself beats a cap that is discovered.
 */

import { KNOWLEDGE, KNOWLEDGE_VERSION } from "@/lib/knowledge";
import { Allergen, Avoidance, Intolerance, LifeStage, Protocol } from "@/lib/schema";

const TARGET = 300;

const counts = new Map<string, number>();
const sourced = new Map<string, number>();

for (const entry of KNOWLEDGE) {
  for (const concern of entry.concerns) {
    const key = `${concern.axis.kind}/${concern.axis.value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (concern.sources.length > 0) sourced.set(key, (sourced.get(key) ?? 0) + 1);
  }
}

const AXES: [string, readonly string[]][] = [
  ["allergen", Allergen.options],
  ["intolerance", Intolerance.options],
  ["avoidance", Avoidance.options],
  ["protocol", Protocol.options],
  ["life-stage", LifeStage.options],
];

console.log(`\n  ${KNOWLEDGE_VERSION} — ${KNOWLEDGE.length} entries of a target ${TARGET} (${Math.round((KNOWLEDGE.length / TARGET) * 100)}%)\n`);

for (const [kind, values] of AXES) {
  console.log(`  ${kind}`);
  for (const value of values) {
    const key = `${kind}/${value}`;
    const n = counts.get(key) ?? 0;
    const s = sourced.get(key) ?? 0;
    const gap = n === 0 ? "  ← nothing knows about this axis" : "";
    console.log(`    ${value.padEnd(26)} ${String(n).padStart(3)} concerns  ${String(s).padStart(3)} sourced${gap}`);
  }
  console.log();
}

const names = KNOWLEDGE.reduce((n, e) => n + e.names.length, 0);
const withUrl = KNOWLEDGE.flatMap((e) => e.concerns.flatMap((c) => c.sources)).filter((s) => s.url !== null).length;
const totalSources = KNOWLEDGE.flatMap((e) => e.concerns.flatMap((c) => c.sources)).length;

console.log(`  ${names} label spellings matched across ${KNOWLEDGE.length} entries`);
console.log(`  ${KNOWLEDGE.filter((e) => e.umbrella).length} umbrella terms`);
console.log(`  ${withUrl}/${totalSources} citations carry a verified URL — attaching the rest is founder review work\n`);
