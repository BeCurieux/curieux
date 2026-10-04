import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { totp } from "../totp";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// Ovyko's own totals (docs/PLATFORM_TOTALS.md): only platform admins, only
// after two-step sign-in, and only numbers. Demo schools are left out.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `platform-${run}-password`;
const email = `platform.admin.${run}@example.test`;
let authId: string;
let userId: string;
let orgId: string;
let staff: Client;

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Pat Platform" },
  });
  if (error) throw error;
  authId = data.user.id;
  const { data: profile } = await admin.from("users").select("id").eq("auth_id", authId).single();
  userId = profile!.id;
  // A real school with a family, a paid online payment and Ovyko's share.
  const { data: org } = await admin
    .from("organisations")
    .insert({ name: "Totals Swim", slug: `totals-${run}`, activity_type: "swimming" })
    .select("id")
    .single();
  orgId = org!.id;
  const { data: fam } = await admin
    .from("families")
    .insert({ organisation_id: orgId, display_name: "Totals Family" })
    .select("id")
    .single();
  await admin.from("payment_accounts").insert({
    organisation_id: orgId,
    stripe_account_id: `acct_totals${run}`,
    charges_enabled: true,
  });
  await admin.from("online_payments").insert({
    organisation_id: orgId,
    family_id: fam!.id,
    amount_cents: 20000,
    platform_fee_cents: 100,
    status: "paid",
    stripe_account_id: `acct_totals${run}`,
    paid_at: new Date().toISOString(),
  });
  staff = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: e } = await staff.auth.signInWithPassword({ email, password });
  if (e) throw e;
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", `totals-${run}`);
  await admin.auth.admin.deleteUser(authId);
});

describe("Ovyko's totals", () => {
  it("are closed to everyone who doesn't run Ovyko", async () => {
    for (const who of ["aquaOwner", "burrowsParent", "aquaInstructor"] as const) {
      const s = await signInAs(who);
      expect((await s.client.rpc("platform_totals")).error?.code).toBe("42501");
      expect((await s.client.rpc("platform_months")).error?.code).toBe("42501");
      expect((await s.client.rpc("am_platform_admin")).data).toBe(false);
    }
    expect((await staff.rpc("platform_totals")).error?.code).toBe("42501");
  });

  it("no one can add themselves as a platform admin", async () => {
    const { error } = await staff.from("platform_admins").insert({ user_id: userId });
    expect(error?.code).toBe("42501");
  });

  it("a platform admin must pass two-step sign-in first", async () => {
    await admin.from("platform_admins").insert({ user_id: userId });
    expect((await staff.rpc("owner_two_step_needed")).data).toBe(true);
    expect((await staff.rpc("platform_totals")).error?.code).toBe("42501");
    const { data: factor } = await staff.auth.mfa.enroll({ factorType: "totp" });
    const { error } = await staff.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totp(factor!.totp.secret),
    });
    expect(error).toBeNull();
    expect((await staff.rpc("owner_two_step_needed")).data).toBe(false);
    expect((await staff.rpc("am_platform_admin")).data).toBe(true);
  });

  it("then sees numbers only, demo schools left out", async () => {
    const { data, error } = await staff.rpc("platform_totals");
    expect(error).toBeNull();
    const t = data![0]!;
    expect(Object.keys(t).sort()).toEqual(
      [
        "children_enrolled",
        "families",
        "fees_charged_365d_cents",
        "monthly_recurring_cents",
        "ovyko_fees_30d_cents",
        "ovyko_fees_365d_cents",
        "paid_online_30d_cents",
        "paid_online_365d_cents",
        "recorded_payments_365d_cents",
        "schools",
        "schools_paying",
        "schools_taking_payments",
        "schools_teaching",
      ].sort(),
    );
    // This test's school is counted; the seeded demo schools are marked as
    // demo, so they aren't. (Other test files add and remove schools at the
    // same time, so exact counts aren't compared.)
    expect(t.schools).toBeGreaterThanOrEqual(1);
    const { data: demo } = await admin
      .from("organisations")
      .select("is_demo")
      .in("slug", ["aqua-house", "peak-gymnastics"]);
    expect(demo).toEqual([{ is_demo: true }, { is_demo: true }]);
    expect(t.paid_online_30d_cents).toBeGreaterThanOrEqual(20000);
    expect(t.ovyko_fees_30d_cents).toBeGreaterThanOrEqual(100);
    const { data: months } = await staff.rpc("platform_months");
    expect(months).toHaveLength(12);
    expect(months!.at(-1)!.paid_online_cents).toBeGreaterThanOrEqual(20000);
  });
});
