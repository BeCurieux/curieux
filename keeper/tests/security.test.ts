// Security regression checks (§31): statically verify the migrations keep
// every user-owned table under RLS and every storage bucket private.
// (Live cross-user access tests run against a real Supabase instance in CI.)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const schemaSql = readFileSync(join(migrationsDir, "0001_schema.sql"), "utf8");
const rlsSql = readFileSync(join(migrationsDir, "0002_rls.sql"), "utf8");
const storageSql = readFileSync(join(migrationsDir, "0003_storage.sql"), "utf8");
const subjectsSql = readFileSync(join(migrationsDir, "0004_subjects.sql"), "utf8");

const createdTables = [...schemaSql.matchAll(/create table (\w+)/g)].map((m) => m[1]);

describe("RLS coverage (§4)", () => {
  it("creates the expected core tables", () => {
    for (const table of [
      "profiles", "families", "family_members", "children", "memories",
      "media_assets", "memory_people", "memory_tags", "memory_clusters",
      "cluster_memories", "follow_up_questions", "little_things", "books",
      "book_sections", "book_pages", "book_content_blocks", "book_approvals",
      "print_orders", "jobs",
    ]) {
      expect(createdTables, `missing table ${table}`).toContain(table);
    }
  });

  it("enables row level security on every created table", () => {
    for (const table of createdTables) {
      expect(rlsSql, `RLS not enabled on ${table}`).toMatch(
        new RegExp(`alter table ${table}\\s+enable row level security`)
      );
    }
  });

  it("scopes every user-facing policy through ownership", () => {
    // Every policy must reference auth.uid() directly or an owns_* helper.
    const policies = [...rlsSql.matchAll(/create policy[^;]+;/gs)].map((m) => m[0]);
    expect(policies.length).toBeGreaterThan(10);
    for (const policy of policies) {
      expect(policy, `unscoped policy: ${policy.slice(0, 60)}`).toMatch(/auth\.uid\(\)|owns_\w+\(/);
    }
  });

  it("jobs table has no user policies (service role only)", () => {
    expect(rlsSql).not.toMatch(/create policy[^;]*on jobs/s);
  });
});

describe("RLS survives the subjects rename (0004)", () => {
  // Renaming children→subjects moved every policy's ownership check onto a new
  // helper. A policy left behind on the old helper would silently fail open.
  it("recreates a policy for every table whose scoping column was renamed", () => {
    for (const table of [
      "subjects", "memories", "memory_clusters",
      "follow_up_questions", "little_things", "books",
    ]) {
      expect(subjectsSql, `no policy recreated for ${table}`).toMatch(
        new RegExp(`create policy "${table} all" on ${table}`)
      );
    }
  });

  it("scopes every recreated policy through ownership", () => {
    const policies = [...subjectsSql.matchAll(/create policy[^;]+;/gs)].map((m) => m[0]);
    expect(policies.length).toBeGreaterThanOrEqual(6);
    for (const policy of policies) {
      expect(policy, `unscoped policy: ${policy.slice(0, 60)}`).toMatch(/auth\.uid\(\)|owns_\w+\(/);
    }
  });

  it("drops the stale child helper so nothing can call it", () => {
    expect(subjectsSql).toMatch(/drop function if exists owns_child\(uuid\)/);
  });

  it("keeps a date of birth mandatory for children only", () => {
    expect(subjectsSql).toMatch(/child_requires_dob/);
    expect(subjectsSql).toMatch(/subject_type <> 'child' or date_of_birth is not null/);
  });
});

describe("storage privacy (§4)", () => {
  it("all buckets are private", () => {
    const buckets = [...storageSql.matchAll(/values \('(\w+)', '\w+', (\w+)\)/g)];
    expect(buckets.length).toBeGreaterThanOrEqual(2);
    for (const [, name, isPublic] of buckets) {
      expect(isPublic, `bucket ${name} must be private`).toBe("false");
    }
  });

  it("media object access is scoped to the owner's folder", () => {
    const mediaPolicies = [...storageSql.matchAll(/create policy "media[^;]+;/gs)];
    expect(mediaPolicies.length).toBe(4); // select/insert/update/delete
    for (const [policy] of mediaPolicies) {
      expect(policy).toContain("auth.uid()::text");
    }
  });

  it("renders bucket grants no user policies", () => {
    expect(storageSql).not.toMatch(/create policy "renders/);
  });
});

describe("provenance constraint at the database layer (§14)", () => {
  it("book_content_blocks enforces sources for AI factual text in SQL", () => {
    expect(schemaSql).toMatch(/ai_text_requires_sources check/);
    expect(schemaSql).toMatch(/jsonb_array_length\(source_ids\) > 0/);
  });
});
