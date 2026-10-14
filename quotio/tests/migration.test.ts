import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The migration, read as the thing SupabaseStore delegates to.
 *
 * `SupabaseStore.deleteUser` is one line — `delete from users where id = …` —
 * and everything else going with it is Postgres doing what the foreign keys
 * say. LocalStore deletes each widget by hand and then the sessions and the
 * user; the two produce the same result only for as long as the cascades are
 * there.
 *
 * The contract suite would catch a missing cascade, but only when run against
 * a real project, which is exactly when nobody is looking. This runs on every
 * commit with no infrastructure at all, so dropping an `on delete cascade`
 * fails here rather than in production as a widget still serving a business
 * that closed its account.
 */
const SQL = readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "0001_init.sql"),
  "utf8"
);

/** Every table whose rows are meaningless once their owner is gone. */
const CASCADES: Array<{ table: string; parent: string; why: string }> = [
  { table: "sessions", parent: "users", why: "a live session for a deleted account" },
  { table: "widgets", parent: "users", why: "a widget serving a closed account" },
  { table: "widget_versions", parent: "widgets", why: "history of a deleted widget" },
  { table: "widget_events", parent: "widgets", why: "analytics nobody can reach" },
  { table: "leads", parent: "widgets", why: "somebody's contact details, kept forever" },
  { table: "subscriptions", parent: "users", why: "billing state for nobody" },
];

/** The body of `create table … ( … );` for one table. */
function tableBody(table: string): string {
  const start = SQL.indexOf(`create table if not exists public.${table}`);
  expect(start, `no create table for ${table}`).toBeGreaterThan(-1);
  const end = SQL.indexOf("\n);", start);
  return SQL.slice(start, end === -1 ? undefined : end);
}

describe("the Supabase migration", () => {
  it.each(CASCADES)(
    "cascades $table from $parent, or we leak: $why",
    ({ table, parent }) => {
      const body = tableBody(table);
      const reference = body
        .split("\n")
        .find((line) => line.includes(`references public.${parent}`));

      expect(reference, `${table} has no foreign key to ${parent}`).toBeTruthy();
      expect(reference!.toLowerCase(), `${table} → ${parent} is not ON DELETE CASCADE`).toContain(
        "on delete cascade"
      );
    }
  );

  it("names the metered event column the way SupabaseStore queries it", () => {
    // countInteractionsThisMonth filters on `event_type`, and a rename here
    // would make every account read as zero interactions used — the meter
    // silently stops metering, which is the expensive direction to fail in.
    expect(tableBody("widget_events")).toContain("event_type");
  });

  it("keeps the widget slug unique, since it is the public address", () => {
    expect(tableBody("widgets").toLowerCase()).toMatch(/slug\s+text\s+not null\s+unique/);
  });
});
