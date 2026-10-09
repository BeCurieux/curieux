/**
 * A fixed set of rules with a version that names its exact content.
 *
 * Every assessment and every generated asset records `rulesVersion`, so a
 * finding can always be traced to the rules that produced it, and a rule
 * change is visible as "assessed under an older version — re-scan". The
 * version is a hash of the rules themselves rather than a counter somebody
 * remembers to bump: two snapshots with the same content have the same
 * version wherever they were loaded, and any edit changes it.
 */

import { createHash } from "node:crypto";
import { ruleId, Rule } from "./rules.js";

export type RulesSnapshot = {
  /** `r-` + the first 16 hex characters of the content hash. */
  version: string;
  rules: readonly Rule[];
};

export function createSnapshot(rules: readonly unknown[]): RulesSnapshot {
  const parsed = rules.map((r) => Rule.parse(r));
  const sorted = [...parsed].sort((a, b) => ruleId(a).localeCompare(ruleId(b)));

  const seen = new Set<string>();
  for (const rule of sorted) {
    const id = ruleId(rule);
    if (seen.has(id)) throw new Error(`Duplicate rule id ${id}.`);
    seen.add(id);
  }

  const hash = createHash("sha256").update(canonicalJson(sorted)).digest("hex");
  return { version: `r-${hash.slice(0, 16)}`, rules: Object.freeze(sorted) };
}

/** JSON with object keys sorted, so key order in a YAML file is not content. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return value === undefined ? "null" : JSON.stringify(value);
}
