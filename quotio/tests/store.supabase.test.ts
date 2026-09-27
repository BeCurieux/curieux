import { describe, it } from "vitest";

import { SupabaseStore } from "@/lib/db/supabase";
import { describeStoreContract } from "./store-contract";

/**
 * The same contract, against the store production runs on.
 *
 * Skipped unless real credentials are present, because there is no honest way
 * to fake this one. SupabaseStore's whole job is to delegate to Postgres —
 * `deleteUser` is a single delete that relies on six `on delete cascade`
 * clauses in the migration to do the rest. A mocked client would assert that
 * we send the query we already know we send, and would pass just as happily if
 * the cascades were missing. That is worse than no test, because it reads
 * green.
 *
 * To run it, against a scratch project — never one with real data in it, since
 * the suite creates and deletes freely:
 *
 *   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=… \
 *   npx vitest run tests/store.supabase.test.ts
 *
 * The service role key is deliberate: the store runs server-side and bypasses
 * row-level security, so testing with an anon key would exercise a path the
 * product never takes.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key);

if (configured) {
  describeStoreContract("SupabaseStore", {
    // One project, reused: every test creates its own users and widgets, and
    // the assertions are all scoped to ids created inside the test, so runs
    // don't collide with each other.
    make: () => new SupabaseStore(),
  });
} else {
  describe("SupabaseStore satisfies the Store contract", () => {
    it.skip("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run", () => {});
  });
}
