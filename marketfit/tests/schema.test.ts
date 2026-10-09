/**
 * The migration and the TypeScript agree on the closed sets they both name.
 * A value one side accepts and the other refuses is a write that fails in
 * production and nowhere else.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FACT_SOURCES } from "@/engine/facts.js";
import { MARKETS } from "@/engine/markets.js";
import { CONFIDENCES, MARKET_CODES, RULE_KINDS, SEVERITIES } from "@/engine/rules.js";
import { SCORES } from "@/engine/score.js";
import { createSnapshot } from "@/engine/snapshot.js";
import { seedSql } from "@/rules/sql.js";

const SQL = readFileSync(path.resolve(import.meta.dirname, "../supabase/migrations/20261008000000_marketfit_schema.sql"), "utf8");

function checkList(column: string): string[] {
  const match = new RegExp(`${column} text not null check \\(${column} in \\(([^)]*)\\)\\)`).exec(SQL);
  if (!match) throw new Error(`no check constraint for ${column}`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
}

describe("schema", () => {
  it.each([
    ["kind", RULE_KINDS],
    ["severity", SEVERITIES],
    ["confidence", CONFIDENCES],
    ["score", SCORES],
    ["source", FACT_SOURCES],
  ] as const)("%s matches", (column, values) => {
    expect(checkList(column)).toEqual([...values].sort());
  });

  it("seeds the same markets", () => {
    for (const code of MARKET_CODES) {
      const m = MARKETS[code];
      expect(SQL).toContain(`('${code}', '${m.name}', array[${m.languages.map((l) => `'${l}'`).join(", ")}], '${m.currency}')`);
    }
  });

  it("an empty snapshot retires every rule rather than writing invalid SQL", () => {
    const sql = seedSql(createSnapshot([]));
    expect(sql).not.toContain("insert into");
    expect(sql).toContain("not in ('')");
  });
});
