/**
 * pnpm rules              validate rules/**\/*.yaml and print a summary
 * pnpm rules:sql          …and write supabase/seed.sql from them
 *
 * Exits non-zero with every problem listed if any file is invalid.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createSnapshot } from "../src/engine/snapshot.js";
import { loadRules, RulesLoadError } from "../src/rules/load.js";
import { seedSql } from "../src/rules/sql.js";

const root = path.resolve(import.meta.dirname, "..");
const sqlFlag = process.argv.indexOf("--sql");
const sqlOut = sqlFlag >= 0 ? process.argv[sqlFlag + 1] : undefined;

try {
  const loaded = await loadRules(path.join(root, "rules"));
  const snapshot = createSnapshot(loaded.map((l) => l.rule));

  const groups = new Map<string, Map<string, number>>();
  for (const rule of snapshot.rules) {
    const key = `${rule.market} ${rule.category}`;
    const counts = groups.get(key) ?? new Map<string, number>();
    counts.set(rule.confidence, (counts.get(rule.confidence) ?? 0) + 1);
    groups.set(key, counts);
  }
  console.log(`Rules snapshot ${snapshot.version}: ${snapshot.rules.length} rules`);
  for (const [key, counts] of groups) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${key.padEnd(18)} ${String(total).padStart(3)}   ${[...counts].map(([c, n]) => `${c} ${n}`).join(", ")}`);
  }
  if (!snapshot.rules.some((r) => r.confidence === "verified")) {
    console.log("\nNo rule is verified yet, so every product scores `not_assessed`. That is correct until the rules are reviewed.");
  }

  if (sqlOut) {
    await writeFile(path.resolve(root, sqlOut), seedSql(snapshot));
    console.log(`\nWrote ${sqlOut}`);
  }
} catch (error) {
  if (error instanceof RulesLoadError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
