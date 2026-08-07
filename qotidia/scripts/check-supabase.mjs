// Is the database there, and is it the right shape?
//
// Run this after pasting setup.sql into a new project. It answers the three
// questions that otherwise get answered by a 500 on the first page after
// signing up:
//
//   Are the settings present, under either of the names Supabase has used?
//   Can we reach the project at all?
//   Has the schema been applied, and all of it?
//
// The third is the one worth having. supabase/setup.sql had fallen four
// migrations behind at one point, and a half-applied schema does not
// announce itself — the app starts, the landing page renders, and the first
// thing that touches an archive fails. This names the missing migration
// instead.
//
//   npm run check:supabase
//
// It needs only the publishable key. The secret key is used if present, to
// check one thing the publishable key cannot see, and is never printed.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// .env.local, without adding a dependency for it.
//
// Split on \r?\n rather than \n. Git for Windows converts line endings on
// checkout by default, so a .env.local copied from .env.example there ends
// every line with a carriage return — and JS regex `.` does not match \r,
// so `(.*)$` failed on every single line. This reported "NEXT_PUBLIC_
// SUPABASE_URL is not set" to somebody who had just set it, which is the
// worst thing a diagnostic can do: send you to fix something that was
// already right.
//
// Next itself reads .env.local correctly, so only this script was wrong.
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    // Values are sometimes quoted, and a key that arrives wrapped in quotes
    // fails against the API with an error that says nothing about quotes.
    process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
} catch {
  // No .env.local is a legitimate state; the checks below say so plainly.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (s) => console.log(`  ok   ${s}`);
const bad = (s) => console.log(`  ——   ${s}`);

console.log("\nSettings");
if (!url) {
  bad("NEXT_PUBLIC_SUPABASE_URL is not set — Project Settings → API → Project URL");
  process.exit(1);
}
ok(`project ${new URL(url).hostname.split(".")[0]}`);

if (!publishable) {
  bad("No publishable key — Project Settings → API Keys → publishable (sb_publishable_…)");
  process.exit(1);
}
ok(`publishable key (${publishable.startsWith("sb_") ? "current format" : "legacy anon JWT — still fine"})`);
if (secret) ok("secret key present");
else bad("no secret key — background jobs and the admin paths will not run without it");

// ------------------------------------------------------------- reachable

console.log("\nReachable");
const db = createClient(url, publishable, { auth: { persistSession: false } });

try {
  const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: publishable } });
  if (!res.ok) throw new Error(`auth returned ${res.status}`);
  ok("auth responds");
} catch (e) {
  bad(`cannot reach the project: ${e.message}`);
  // A 403 to the health endpoint is almost never the key — an invalid key
  // returns 401. It is usually a network policy in between, which is a very
  // different thing to go and fix.
  if (/403/.test(e.message)) {
    bad("a 403 here is usually a proxy or network policy, not a bad key —");
    bad("this machine may not be allowed to reach *.supabase.co");
  } else {
    bad("check the Project URL in Project Settings → API");
  }
  process.exit(1);
}

// ---------------------------------------------------------------- schema

// One table per migration that adds one, so a half-applied schema names the
// migration that is missing rather than failing somewhere downstream.
const EXPECTED = [
  ["families", "0001_schema"],
  ["subjects", "0004_subjects"],
  ["family_memberships", "0007_shared_archive"],
  ["email_preferences", "0009_email"],
  ["renewals", "0010_renewals"],
  ["activity_log", "0011_privacy"],
  ["noticed", "0017_noticed"],
  ["subject_inboxes", "0018_inbox"],
  ["memory_subjects", "0019_family_archive"],
];

console.log("\nSchema");
const missing = [];
for (const [table, migration] of EXPECTED) {
  const { error } = await db.from(table).select("*", { head: true, count: "exact" }).limit(1);
  // An empty table is a pass. Only "relation does not exist" is a failure —
  // a permission error means the table is there and RLS is doing its job.
  if (error && /does not exist|schema cache|PGRST205|42P01/i.test(`${error.message}${error.code}`)) {
    missing.push([table, migration]);
  }
}

if (missing.length === 0) {
  ok(`all ${EXPECTED.length} checked tables present`);
} else {
  for (const [table, migration] of missing) bad(`${table} missing — ${migration}.sql has not been run`);
  console.log(
    "\nPaste supabase/setup.sql into the SQL editor (it is the whole schema,\n" +
      "regenerated from the migrations), or run the missing migrations in order."
  );
  process.exit(1);
}

// Whether row-level security is actually on, which is the difference
// between the policies being enforced and being decoration.
//
// Checked by comparing what the secret key can see with what an anonymous
// caller can. It needs both keys and it needs there to be something in the
// archive — with an empty database the two agree at zero and prove nothing,
// which is said rather than glossed over.
if (secret) {
  console.log("\nRow-level security");
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { count: asAdmin } = await admin
    .from("memories")
    .select("id", { head: true, count: "exact" });
  const { count: asAnon } = await db
    .from("memories")
    .select("id", { head: true, count: "exact" });

  if (!asAdmin) {
    bad("nothing in the archive yet, so there is nothing to be refused — re-run after seeding");
  } else if (asAnon && asAnon > 0) {
    bad(`row-level security is OFF: a signed-out caller can read ${asAnon} memories`);
    bad("do not put a real family in this project until that is fixed");
    process.exit(1);
  } else {
    ok(`${asAdmin} memories exist and a signed-out caller can read none of them`);
  }
}

console.log("\nThe database is ready. Next: npm run seed, then npm run dev.\n");
