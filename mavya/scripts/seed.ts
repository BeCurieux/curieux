// Seeds the tenancy fixtures: two organisations, their staff, two families
// and their children. Safe to run repeatedly — every write is an upsert.
//
// It signs users up through Supabase Auth's admin API rather than inserting
// into auth.users by hand, so the same script works against a local stack
// and a cloud project, and the sign-up trigger runs exactly as it will for
// a real person.
//
// Every seeded account shares one known password. That is fine on a laptop
// and dangerous anywhere else, so a non-local URL is refused unless
// MAVYA_ALLOW_REMOTE_SEED=1 says otherwise.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { CHILDREN, FAMILIES, ORGS, USERS, type SeedUser } from "./fixtures";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run scripts/local-env.sh first.`);
  return value;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const password = required("SEED_PASSWORD");

const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost"].includes(host) && process.env.MAVYA_ALLOW_REMOTE_SEED !== "1") {
  throw new Error(
    `Refusing to seed ${host}: seeded accounts share a known password. ` +
      "Set MAVYA_ALLOW_REMOTE_SEED=1 if this is really a disposable project.",
  );
}

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function check(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

async function findAuthUserId(email: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`list users: ${error.message}`);
    const match = data.users.find((u) => u.email === email);
    if (match) return match.id;
    if (data.users.length < 200) return undefined;
  }
}

async function ensureUser(user: SeedUser): Promise<string> {
  let authId = await findAuthUserId(user.email);
  if (authId) {
    const { error } = await admin.auth.admin.updateUserById(authId, {
      password,
      user_metadata: { name: user.name },
    });
    if (error) throw new Error(`update ${user.email}: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });
    if (error || !data.user) throw new Error(`create ${user.email}: ${error?.message}`);
    authId = data.user.id;
  }

  // The sign-up trigger created the profile; bring it in line with the fixture.
  const { data: profile, error } = await admin
    .from("users")
    .update({ name: user.name, email: user.email })
    .eq("auth_id", authId)
    .select("id")
    .single();
  if (error || !profile) throw new Error(`profile for ${user.email}: ${error?.message}`);
  return profile.id;
}

// Straight after `supabase db reset` the REST API can still be reloading its
// schema, so wait until it answers before writing anything.
async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { error } = await admin.from("organisations").select("id").limit(1);
    if (!error) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The database API didn't become ready in 30 seconds.");
}

async function main() {
  await waitForApi();
  check(
    await admin.from("organisations").upsert(Object.values(ORGS).map((o) => ({ ...o }))),
    "organisations",
  );
  check(
    await admin.from("families").upsert(Object.values(FAMILIES).map((f) => ({ ...f }))),
    "families",
  );
  check(
    await admin.from("children").upsert(Object.values(CHILDREN).map((c) => ({ ...c }))),
    "children",
  );

  for (const user of Object.values(USERS) as SeedUser[]) {
    const userId = await ensureUser(user);

    if (user.staff) {
      check(
        await admin.from("staff_memberships").upsert(
          {
            user_id: userId,
            organisation_id: ORGS[user.staff.org].id,
            role: user.staff.role,
            status: "active",
          },
          { onConflict: "user_id,organisation_id" },
        ),
        `membership for ${user.email}`,
      );
    }

    if (user.family) {
      check(
        await admin.from("family_members").upsert(
          {
            user_id: userId,
            family_id: FAMILIES[user.family.family].id,
            relationship: user.family.relationship,
            is_primary_guardian: user.family.primary,
          },
          { onConflict: "family_id,user_id" },
        ),
        `family member ${user.email}`,
      );
    }

    console.log(`seeded ${user.email}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
