/**
 * The credit functions, run for real against Postgres.
 *
 * Needs a server to create a scratch database on: set REELKIT_TEST_DATABASE_URL
 * (CI runs a Postgres service). Without it these tests are skipped, not
 * faked — the point of them is the SQL, and a mock of the SQL tests nothing.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const admin = process.env.REELKIT_TEST_DATABASE_URL;
const root = path.resolve(import.meta.dirname, "..");
const dbName = `reelkit_test_${process.pid}`;

let db: pg.Client;
const alice = "00000000-0000-4000-8000-00000000000a";
const bob = "00000000-0000-4000-8000-00000000000b";

async function as<T>(role: string, sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${role}`);
    if (sub) await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub]);
    return await fn();
  } finally {
    await db.query("rollback");
  }
}

const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];

describe.skipIf(!admin)("credits in Postgres", () => {
  beforeAll(async () => {
    const server = new pg.Client({ connectionString: admin });
    await server.connect();
    await server.query(`drop database if exists ${dbName}`);
    await server.query(`create database ${dbName}`);
    await server.end();

    const url = new URL(admin!);
    url.pathname = `/${dbName}`;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    // Roles are cluster-wide; a previous run may have made them already.
    const stub = readFileSync(path.join(root, "supabase/tests/supabase-stub.sql"), "utf8").replace(
      /create role (\w+) nologin( bypassrls)?;/g,
      (_, r, b) => `do $$ begin create role ${r} nologin${b ?? ""}; exception when duplicate_object then null; end $$;`,
    );
    await db.query(stub);
    for (const f of readdirSync(path.join(root, "supabase/migrations")).sort()) {
      await db.query(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
    }
    await db.query(`insert into auth.users (id, email) values ($1, 'alice@example.com'), ($2, 'bob@example.com')`, [alice, bob]);
  });

  afterAll(async () => {
    await db?.end();
    const server = new pg.Client({ connectionString: admin });
    await server.connect();
    await server.query(`drop database if exists ${dbName}`);
    await server.end();
  });

  it("gives every new account its free credits, on the ledger", async () => {
    expect((await one("select credits from accounts where user_id = $1", [alice])).credits).toBe(3);
    const row = await one("select delta, balance_after, reason from credit_ledger where user_id = $1", [alice]);
    expect(row).toEqual({ delta: 3, balance_after: 3, reason: "signup" });
  });

  it("spends down to zero and then refuses", async () => {
    const spent = [];
    for (let i = 0; i < 4; i++) spent.push((await one("select spend_credit($1, $2) as b", [bob, `bob-${i}`])).b);
    expect(spent).toEqual([2, 1, 0, null]);
    expect((await one("select count(*)::int as n from credit_ledger where user_id = $1 and reason = 'spend'", [bob])).n).toBe(3);
  });

  it("refunds a real spend once, and nothing else", async () => {
    expect((await one("select refund_credit($1, 'bob-0') as b", [bob])).b).toBe(1);
    expect((await one("select refund_credit($1, 'bob-0') as b", [bob])).b).toBeNull();
    expect((await one("select refund_credit($1, 'never-spent') as b", [bob])).b).toBeNull();
    expect((await one("select refund_credit($1, 'bob-1') as b", [alice])).b).toBeNull(); // not alice's spend
    expect((await one("select credits from accounts where user_id = $1", [bob])).credits).toBe(1);
  });

  it("counts a Checkout session once however often Stripe sends it", async () => {
    const grant = () => one("select grant_purchase($1, 'cs_test_1', 20, 900, 'usd') as ok", [alice]);
    expect((await grant()).ok).toBe(true);
    expect((await grant()).ok).toBe(false);
    expect((await one("select credits from accounts where user_id = $1", [alice])).credits).toBe(23);
  });

  it("lets two racing deliveries of one session add credits only once", async () => {
    const url = new URL(admin!);
    url.pathname = `/${dbName}`;
    const a = new pg.Client({ connectionString: url.toString() });
    const b = new pg.Client({ connectionString: url.toString() });
    await Promise.all([a.connect(), b.connect()]);
    const before = (await one("select credits from accounts where user_id = $1", [bob])).credits;
    const q = "select grant_purchase($1, 'cs_race', 60, 1900, 'usd') as ok";
    const results = await Promise.all([a.query(q, [bob]), b.query(q, [bob])]);
    await Promise.all([a.end(), b.end()]);
    expect(results.map((r) => r.rows[0].ok).sort()).toEqual([false, true]);
    expect((await one("select credits from accounts where user_id = $1", [bob])).credits).toBe(before + 60);
  });

  it("lets a signed-in user read only their own account, and change nothing", async () => {
    const seen = await as("authenticated", alice, async () => (await db.query("select user_id from accounts")).rows);
    expect(seen).toEqual([{ user_id: alice }]);
    await expect(as("authenticated", alice, () => db.query("update accounts set credits = 999"))).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", alice, () => db.query("select spend_credit($1, 'x')", [alice]))).rejects.toThrow(/permission denied/);
    await expect(
      as("authenticated", alice, () => db.query("select grant_purchase($1, 'cs_free', 1000, 0, 'usd')", [alice])),
    ).rejects.toThrow(/permission denied/);
    await expect(as("anon", null, () => db.query("select * from accounts"))).rejects.toThrow(/permission denied/);
  });

  it("lets the server key spend, refund and grant", async () => {
    const b = await as("service_role", null, async () => (await db.query("select spend_credit($1, 'svc') as b", [alice])).rows[0].b);
    expect(typeof b).toBe("number");
  });
});
