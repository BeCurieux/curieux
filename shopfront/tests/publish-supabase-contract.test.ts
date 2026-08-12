/**
 * Does the Supabase adapter name things that exist?
 *
 * `supabase.ts` says of itself: "typechecked against the real client and
 * exercised against nothing." That remains true — this file does not run a
 * query. What it does is close the gap that made the sentence worrying: every
 * table, column, function and constraint in those queries is a *string*, the
 * schema that defines them is a `.sql` file `tsc` has never read, and a column
 * renamed in one place and not the other is invisible until a real project is
 * on the other end.
 *
 * So: parse both, and cross-check. This cannot tell you the queries are
 * *right* — PostgREST semantics, upsert conflict behaviour and `maybeSingle`
 * are not decidable from here, and the RUNBOOK still sends you to a real
 * project. It can tell you they are not misspelled, which for a dozen
 * hand-written queries against a schema in another file is the failure with
 * the shortest odds.
 *
 * Deliberately not mocked and deliberately not clever: if this file ever needs
 * a fake Supabase to run, it has become the thing it was written to avoid.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSqlSchema } from "./helpers/sql-schema";

const SCHEMA = "src/lib/publish/schema.sql";
const ADAPTERS = ["src/lib/publish/supabase.ts", "src/lib/funnel/store.ts"] as const;

const schema = parseSqlSchema(SCHEMA);

/** A `.from("x")` call and everything up to the end of its statement. */
interface Query {
  file: string;
  table: string;
  body: string;
}

function queries(): Query[] {
  const found: Query[] = [];
  for (const file of ADAPTERS) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.from\("(\w+)"\)/g)) {
      const start = match.index + match[0].length;
      // Statements in this codebase are one chained expression terminated by a
      // semicolon at the end of a line. Taking to the next `;\n` overshoots
      // nothing that matters: a stray column name from the following line would
      // still have to exist, so the check errs safe.
      const end = source.indexOf(";\n", start);
      found.push({ file, table: match[1]!, body: source.slice(start, end === -1 ? source.length : end) });
    }
  }
  return found;
}

/** Column names out of a PostgREST select string, keyed by the table they belong to. */
function selectedColumns(table: string, select: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  // Embedded resources: `shop_versions!constraint_name(a, b, c)`.
  const embedded = select.replace(/(\w+)(?:!(\w+))?\(([^)]*)\)/g, (_all, related: string, _hint, inner: string) => {
    for (const column of inner.split(",")) {
      const name = column.trim();
      if (name && name !== "*") pairs.push([related, name]);
    }
    return "";
  });

  for (const column of embedded.split(",")) {
    const name = column.trim();
    if (name && name !== "*") pairs.push([table, name]);
  }
  return pairs;
}

describe("the schema parse itself", () => {
  // Everything below trusts this. A regex that quietly matched nothing would
  // make every other assertion in the file pass while checking nothing at all.
  it("found the tables the schema declares", () => {
    expect([...schema.tables.keys()].sort()).toEqual(["shop_events", "shop_versions", "shops", "stores"]);
  });

  it("found their columns", () => {
    expect(schema.tables.get("stores")).toContain("genome");
    expect(schema.tables.get("shop_versions")).toContain("prompt");
    expect(schema.tables.get("shops")).toContain("current_version_id");
    expect(schema.tables.get("shop_events")).toContain("variant_id");
    for (const [table, columns] of schema.tables) {
      expect(columns.size, `${table} parsed with ${columns.size} columns`).toBeGreaterThan(4);
    }
  });

  it("found the functions and what they return", () => {
    expect([...schema.functions.keys()].sort()).toEqual(["get_published_shop", "shop_funnel"]);
    expect(schema.functions.get("get_published_shop")!.args).toContain("want_slug");
    expect(schema.functions.get("get_published_shop")!.returns).toContain("catalogue");
    expect(schema.functions.get("shop_funnel")!.returns).toContain("session_id");
  });

  it("found the queries to check", () => {
    // Twelve-ish hand-written queries was the number worth worrying about; if
    // this drops to zero the matcher has stopped matching.
    expect(queries().length).toBeGreaterThanOrEqual(10);
  });
});

describe("the Supabase adapter against the schema", () => {
  it("only reads tables that exist", () => {
    for (const query of queries()) {
      expect(schema.tables.has(query.table), `${query.file}: no table "${query.table}" in ${SCHEMA}`).toBe(true);
    }
  });

  it("only filters on columns that exist", () => {
    for (const query of queries()) {
      const columns = schema.tables.get(query.table)!;
      for (const match of query.body.matchAll(/\.(?:eq|neq|gt|lt|gte|lte|is|not|order|like|ilike)\("(\w+)"/g)) {
        expect(columns, `${query.file}: ${query.table} has no column "${match[1]}"`).toContain(match[1]!);
      }
    }
  });

  it("only writes columns that exist", () => {
    for (const query of queries()) {
      const columns = schema.tables.get(query.table)!;
      // The object literal handed to insert/update/upsert, or the variable name
      // when it was built up first — `upsertStore` does the latter, so its keys
      // are checked separately below.
      for (const write of query.body.matchAll(/\.(?:insert|update|upsert)\(\s*\{([^}]*)\}/g)) {
        for (const key of write[1]!.matchAll(/(?:^|,)\s*(\w+)\s*:/g)) {
          expect(columns, `${query.file}: ${query.table} has no column "${key[1]}"`).toContain(key[1]!);
        }
      }
      for (const conflict of query.body.matchAll(/onConflict:\s*"(\w+)"/g)) {
        expect(columns, `${query.file}: onConflict names "${conflict[1]}", which ${query.table} does not have`).toContain(
          conflict[1]!,
        );
      }
    }
  });

  it("only selects columns that exist, including through an embedded resource", () => {
    for (const query of queries()) {
      for (const select of query.body.matchAll(/\.select\("([^"]*)"/g)) {
        for (const [table, column] of selectedColumns(query.table, select[1]!)) {
          expect(schema.tables.has(table), `${query.file}: no table "${table}"`).toBe(true);
          expect(schema.tables.get(table), `${query.file}: ${table} has no column "${column}"`).toContain(column);
        }
      }
    }
  });

  it("names a foreign key that exists", () => {
    // `shop_versions!shops_current_version_id_fkey` is the one query that tells
    // PostgREST which of two relationships to follow, and it is spelled by
    // hand. schema.sql adds that constraint by that name in a `do $$` block, so
    // the two are one rename apart from disagreeing silently.
    const source = ADAPTERS.map((file) => readFileSync(file, "utf8")).join("\n");
    const hints = [...source.matchAll(/\w+!(\w+)/g)].map((match) => match[1]!);
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(schema.constraints, `no constraint named "${hint}" in ${SCHEMA}`).toContain(hint);
    }
  });

  it("calls functions that exist, with the argument names they declare", () => {
    for (const file of ADAPTERS) {
      const source = readFileSync(file, "utf8");
      for (const call of source.matchAll(/\.rpc\("(\w+)",\s*\{([^}]*)\}/g)) {
        const [, name, argList] = call;
        const fn = schema.functions.get(name!);
        expect(fn, `${file}: no function "${name}" in ${SCHEMA}`).toBeDefined();
        for (const arg of argList!.matchAll(/(?:^|,)\s*(\w+)\s*:/g)) {
          expect(fn!.args, `${file}: ${name} has no argument "${arg[1]}"`).toContain(arg[1]!);
        }
      }
    }
  });

  it("reads back only what the functions return", () => {
    // `loadBySlug` and `summarise` pull `row.x` off an rpc result. Those column
    // names come from the function's `returns table (...)`, not from a table,
    // so nothing else in this file would catch a drift between them.
    const rpcReturns = [
      { file: "src/lib/publish/supabase.ts", fn: "get_published_shop" },
      { file: "src/lib/funnel/store.ts", fn: "shop_funnel" },
    ];

    for (const { file, fn } of rpcReturns) {
      const source = readFileSync(file, "utf8");
      // The call site, not the first mention: both files name the function in a
      // header comment, and scoping from there reads a paragraph of prose and
      // concludes there is nothing to check.
      const start = source.indexOf(`.rpc("${fn}"`);
      expect(start, `${file}: expected a call to ${fn}`).toBeGreaterThan(-1);
      // To the end of the enclosing method, not a fixed number of bytes and not
      // to the next one. A window wide enough to be safe reads the *following*
      // method's rows and reports their columns as this function's; scoping to
      // "next async" has the same problem when the call is in the last method,
      // where it runs to the end of the file and finds a pure helper's `r.x`.
      const close = source.indexOf("\n    },", start);
      const scope = source.slice(start, close === -1 ? source.length : close);
      const returns = schema.functions.get(fn)!.returns;

      const read = new Set([...scope.matchAll(/\brow\.(\w+)|\br\.(\w+)/g)].map((m) => (m[1] ?? m[2])!));
      expect(read.size, `${file}: no row reads found after ${fn}`).toBeGreaterThan(3);
      for (const column of read) {
        expect(returns, `${file}: ${fn} does not return "${column}"`).toContain(column);
      }
    }
  });
});
