import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { ORGS, USERS } from "../../scripts/fixtures";
import { totp } from "../totp";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client, type Session } from "./helpers";

// M6d part 2 acceptance (security and rules): docs/M6_MIGRATION_PILOT.md.
// The secret key only sets up a school and family of the tests' own and
// tidies them away; everything a person might try goes through their own
// session.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `two-step-${run}-password`;
const createdAuthIds: string[] = [];

async function newAccount(email: string, name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  createdAuthIds.push(data.user.id);
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  return { authId: data.user.id, userId: profile!.id };
}

function client(): Client {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

afterAll(async () => {
  await admin.from("organisations").delete().like("slug", "two-step-test-%");
  await admin.from("families").delete().like("display_name", "Privacy Test %");
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

describe("two-step sign-in for owners", () => {
  const ownerEmail = `two-step.owner.${run}@example.test`;
  let orgId: string;
  let factorSecret: string;

  beforeAll(async () => {
    const { data: org, error } = await admin
      .from("organisations")
      .insert({ name: "Two Step Swim", slug: `two-step-test-${run}`, activity_type: "swimming" })
      .select("id, owner_two_step_required")
      .single();
    if (error) throw error;
    expect(org!.owner_two_step_required).toBe(true);
    orgId = org!.id;
    const { userId } = await newAccount(ownerEmail, "Tess Owner");
    await admin
      .from("staff_memberships")
      .insert({ user_id: userId, organisation_id: orgId, role: "owner" });
    await admin.from("families").insert({ organisation_id: orgId, display_name: "Ng Family" });
  });

  it("gives an owner nothing of the school's on a password alone", async () => {
    const c = await signIn(ownerEmail);
    expect((await c.rpc("owner_two_step_needed")).data).toBe(true);
    expect((await c.from("organisations").select("id")).data).toEqual([]);
    expect((await c.from("families").select("id")).data).toEqual([]);
    const { data: fam } = await admin
      .from("families")
      .select("id")
      .eq("organisation_id", orgId)
      .single();
    expect((await c.rpc("export_family", { p_family: fam!.id })).error?.code).toBe("42501");
    // They can still see their own membership, so the app knows to ask.
    expect((await c.from("staff_memberships").select("role")).data).toEqual([{ role: "owner" }]);
  });

  it("opens the school once the authenticator's code is entered", async () => {
    const c = await signIn(ownerEmail);
    const { data: factor, error } = await c.auth.mfa.enroll({ factorType: "totp" });
    expect(error).toBeNull();
    factorSecret = factor!.totp.secret;
    const wrong = await c.auth.mfa.challengeAndVerify({ factorId: factor!.id, code: "000000" });
    expect(wrong.error).not.toBeNull();
    expect((await c.from("families").select("id")).data).toEqual([]);
    const right = await c.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totp(factorSecret),
    });
    expect(right.error).toBeNull();
    expect((await c.rpc("owner_two_step_needed")).data).toBe(false);
    expect((await c.from("families").select("display_name")).data).toEqual([
      { display_name: "Ng Family" },
    ]);
  });

  it("asks again at the next sign-in", async () => {
    const c = await signIn(ownerEmail);
    expect((await c.rpc("owner_two_step_needed")).data).toBe(true);
    expect((await c.from("families").select("id")).data).toEqual([]);
    const { data: factors } = await c.auth.mfa.listFactors();
    expect(factors!.totp).toHaveLength(1);
  });

  it("isn't asked of the demo schools' owners, or of instructors and parents", async () => {
    for (const who of ["aquaOwner", "aquaInstructor", "burrowsParent"] as const) {
      const s = await signInAs(who);
      expect((await s.client.rpc("owner_two_step_needed")).data, who).toBe(false);
    }
  });

  it("can't be switched off by an owner", async () => {
    const s = await signInAs("aquaOwner");
    const { error, data } = await s.client
      .from("organisations")
      .update({ owner_two_step_required: true })
      .eq("id", orgId)
      .select("id");
    expect(error?.code === "42501" || (data ?? []).length === 0).toBe(true);
  });
});

describe("a family's data", () => {
  let aquaOwner: Session;
  let familyId: string;
  let childId: string;
  let leavingAuthId: string;
  let martinUserId: string;

  beforeAll(async () => {
    aquaOwner = await signInAs("aquaOwner");
    const { data: fam } = await admin
      .from("families")
      .insert({
        organisation_id: ORGS.aqua.id,
        display_name: `Privacy Test ${run}`,
        primary_contact_email: "quilla.parent@example.test",
      })
      .select("id")
      .single();
    familyId = fam!.id;
    const { data: child } = await admin
      .from("children")
      .insert({
        organisation_id: ORGS.aqua.id,
        family_id: familyId,
        first_name: "Quillaby",
        last_name: "Privacytest",
        date_of_birth: "2019-04-02",
      })
      .select("id")
      .single();
    childId = child!.id;
    // One parent only in this family; one also in another (Claire Martin).
    const leaving = await newAccount(`privacy.parent.${run}@example.test`, "Pia Privacytest");
    leavingAuthId = leaving.authId;
    const { data: martin } = await admin
      .from("users")
      .select("id")
      .eq("email", USERS.martinParent.email)
      .single();
    martinUserId = martin!.id;
    const linked = await admin.from("family_members").insert([
      {
        family_id: familyId,
        user_id: leaving.userId,
        relationship: "mother",
        is_primary_guardian: true,
      },
      {
        family_id: familyId,
        user_id: martinUserId,
        relationship: "aunt",
        is_primary_guardian: false,
      },
    ]);
    if (linked.error) throw linked.error;
    await aquaOwner.client.rpc("save_child_health", {
      p_child: childId,
      p_allergies: "Bee stings",
      p_medical_notes: "",
    });
    await aquaOwner.client.rpc("add_child_restriction", {
      p_child: childId,
      p_person: "Rex Privacytest",
      p_kind: "no_contact",
      p_details: "Order 77",
    });
  });

  it("an owner exports everything about it, and that's audited", async () => {
    const { data, error } = await aquaOwner.client.rpc("export_family", { p_family: familyId });
    expect(error).toBeNull();
    const text = JSON.stringify(data);
    for (const expected of [
      "Quillaby",
      "Bee stings",
      "Rex Privacytest",
      "Order 77",
      `privacy.parent.${run}@example.test`,
      "quilla.parent@example.test",
    ]) {
      expect(text).toContain(expected);
    }
    const { data: audit } = await aquaOwner.client
      .from("audit_events")
      .select("action, after_json")
      .eq("entity_id", familyId)
      .eq("action", "export");
    expect(audit).toEqual([{ action: "export", after_json: { children: 1 } }]);
    const looks = await aquaOwner.client.rpc("child_safety_views", { p_child: childId });
    expect(looks.data!.some((v) => v.viewer_role === "owner")).toBe(true);
  });

  it("nobody else can export or delete it", async () => {
    for (const who of ["aquaInstructor", "martinParent", "peakOwner"] as const) {
      const s = await signInAs(who);
      expect((await s.client.rpc("export_family", { p_family: familyId })).error?.code, who).toBe(
        "42501",
      );
      const del = await s.client.rpc("delete_family", {
        p_family: familyId,
        p_confirm: `Privacy Test ${run}`,
      });
      expect(del.error?.code, who).toBe("42501");
    }
  });

  it("deleting needs the family's name typed", async () => {
    const { error } = await aquaOwner.client.rpc("delete_family", {
      p_family: familyId,
      p_confirm: "Privacy Test",
    });
    expect(error?.hint).toBe("delete_unconfirmed");
    const { data } = await admin.from("families").select("id").eq("id", familyId);
    expect(data).toHaveLength(1);
  });

  it("deletes the family, its children and their records, and wipes them from the audit trail", async () => {
    const { data, error } = await aquaOwner.client.rpc("delete_family", {
      p_family: familyId,
      p_confirm: ` privacy test ${run} `,
    });
    expect(error).toBeNull();
    // Only the parent who belongs nowhere else; Claire stays.
    expect(data).toEqual([leavingAuthId]);

    expect((await admin.from("families").select("id").eq("id", familyId)).data).toEqual([]);
    expect((await admin.from("children").select("id").eq("id", childId)).data).toEqual([]);
    expect(
      (await admin.from("child_health").select("child_id").eq("child_id", childId)).data,
    ).toEqual([]);
    expect(
      (await admin.from("child_restrictions").select("id").eq("child_id", childId)).data,
    ).toEqual([]);
    expect(
      (await admin.from("family_members").select("id").eq("user_id", martinUserId)).data,
    ).toHaveLength(1);

    const { data: audit } = await admin
      .from("audit_events")
      .select("entity_type, action, before_json, after_json")
      .eq("organisation_id", ORGS.aqua.id)
      .in("entity_id", [familyId, childId]);
    expect(JSON.stringify(audit)).not.toMatch(/Quillaby|Privacytest|Bee stings|quilla\.parent/);
    expect(audit).toContainEqual(
      expect.objectContaining({
        entity_type: "family_deletion",
        action: "delete",
        after_json: { children: 1, parents: 2, accounts_removed: 1 },
      }),
    );
    const { data: all } = await admin
      .from("audit_events")
      .select("before_json, after_json")
      .gte("created_at", new Date(run - 1_000).toISOString());
    expect(JSON.stringify(all)).not.toMatch(/Quillaby|Bee stings|Order 77/);
  });
});
