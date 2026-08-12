/**
 * Just enough of a Postgres reader to know what `schema.sql` declares.
 *
 * This exists because the Supabase adapter names tables, columns, functions and
 * a foreign-key constraint as strings, and strings do not typecheck. The schema
 * lives in a `.sql` file that `tsc` has never heard of, so a column renamed in
 * one file and not the other is invisible until a real project is on the other
 * end of the query.
 *
 * It is a parser for one file we control, not a SQL implementation. The
 * consumer asserts on the parse itself before trusting it — a regex that
 * silently matched nothing would turn every downstream check green.
 */

import { readFileSync } from "node:fs";

export interface SqlSchema {
  tables: Map<string, Set<string>>;
  /** Function name → its `returns table (...)` column names, and its argument names. */
  functions: Map<string, { returns: Set<string>; args: Set<string> }>;
  constraints: Set<string>;
}

/** Line starters inside a `create table` body that are not column definitions. */
const NOT_A_COLUMN = new Set(["unique", "primary", "constraint", "check", "foreign", "exclude", "like"]);

export function parseSqlSchema(path: string): SqlSchema {
  const sql = readFileSync(path, "utf8");

  const tables = new Map<string, Set<string>>();
  for (const match of sql.matchAll(/create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, name, body] = match;
    const columns = new Set<string>();
    for (const rawLine of body!.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("--")) continue;
      const first = /^(\w+)\b/.exec(line)?.[1];
      if (!first || NOT_A_COLUMN.has(first.toLowerCase())) continue;
      columns.add(first);
    }
    tables.set(name!, columns);
  }

  const functions = new Map<string, { returns: Set<string>; args: Set<string> }>();
  for (const match of sql.matchAll(
    /create (?:or replace )?function public\.(\w+)\s*\(([^)]*)\)\s*returns table\s*\(([\s\S]*?)\)\s*language/g,
  )) {
    const [, name, argList, returnList] = match;
    const args = new Set(
      argList!
        .split(",")
        .map((arg) => /^\s*(\w+)/.exec(arg)?.[1])
        .filter((arg): arg is string => Boolean(arg)),
    );
    const returns = new Set(
      returnList!
        .split(",")
        .map((entry) => /^\s*(\w+)/.exec(entry.trim())?.[1])
        .filter((entry): entry is string => Boolean(entry)),
    );
    functions.set(name!, { returns, args });
  }

  const constraints = new Set<string>();
  for (const match of sql.matchAll(/\badd constraint (\w+)/g)) constraints.add(match[1]!);
  // A unique column gets an implicit constraint named <table>_<column>_key, and
  // PostgREST will accept that as an embedding hint too.
  for (const [table, columns] of tables) {
    for (const column of columns) {
      if (new RegExp(`\\b${column}\\s+[^\\n,]*\\bunique\\b`, "i").test(readFileSync(path, "utf8"))) {
        constraints.add(`${table}_${column}_key`);
      }
    }
  }

  return { tables, functions, constraints };
}
