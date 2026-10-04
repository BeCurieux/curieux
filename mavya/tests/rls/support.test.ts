import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORGS } from "../../scripts/fixtures";
import type { Database } from "@/lib/supabase/database.types";
import { totp } from "../totp";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client, type Session } from "./helpers";

// M6g acceptance (support access): docs/M6_MIGRATION_PILOT.md. A school
// lets Ovyko support in for 48 hours; support sees how the school is set
// up, never who is in it; every look is recorded for the school's owners.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `support-${run}-password`;
const email = `support.staff.${run}@example.test`;
const org = ORGS.aqua.id;
let authId: string;
let userId: string;
let support: Client;
let owner: Session;
let instructor: Session;
let parent: Session;
let otherOwner: Session;

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Sam Support" },
  });
  if (error) throw error;
  authId = data.user.id;
  const { data: profile } = await admin.from("users").select("id").eq("auth_id", authId).single();
  userId = profile!.id;
  await admin.from("platform_admins").insert({ user_id: userId });
  support = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: e } = await support.auth.signInWithPassword({ email, password });
  if (e) throw e;
  [owner, instructor, parent, otherOwner] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("burrowsParent"),
    signInAs("peakOwner"),
  ]);
  await admin.from("support_grants").delete().eq("organisation_id", org);
});

afterAll(async () => {
  await admin.from("support_grants").delete().eq("organisation_id", org);
  await admin.auth.admin.deleteUser(authId);
});

describe("letting support in", () => {
  it("without access, support sees nothing and no school is named", async () => {
    const { data: factor } = await support.auth.mfa.enroll({ factorType: "totp" });
    await support.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totp(factor!.totp.secret),
    });
    expect((await support.rpc("am_platform_admin")).data).toBe(true);
    const { data: schools } = await support.rpc("support_schools");
    expect((schools ?? []).map((s) => s.organisation_id)).not.toContain(org);
    const view = await support.rpc("support_school_view", { p_org: org });
    expect(view.error?.code).toBe("42501");
  });

  it("only the school's owners can let support in or end it", async () => {
    for (const s of [instructor, parent, otherOwner]) {
      const grant = await s.client.rpc("grant_support_access", { p_org: org, p_note: "help" });
      expect(grant.error?.code).toBe("42501");
      const end = await s.client.rpc("end_support_access", { p_org: org });
      expect(end.error?.code).toBe("42501");
      const looks = await s.client.rpc("support_looks", { p_org: org });
      expect(looks.error?.code).toBe("42501");
    }
    // Nobody writes a grant directly, not even an owner.
    const direct = await owner.client.from("support_grants").insert({
      organisation_id: org,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(direct.error?.code).toBe("42501");
  });

  it("an owner lets support in for 48 hours, with a note; it's audited", async () => {
    const before = Date.now();
    const { data, error } = await owner.client.rpc("grant_support_access", {
      p_org: org,
      p_note: "  Our Saturday classes look wrong  ",
    });
    expect(error).toBeNull();
    const hours = (Date.parse(data!) - before) / 3_600_000;
    expect(hours).toBeGreaterThan(47.9);
    expect(hours).toBeLessThan(48.1);
    const { data: grants } = await owner.client
      .from("support_grants")
      .select("note, ended_at")
      .eq("organisation_id", org);
    expect(grants).toEqual([{ note: "Our Saturday classes look wrong", ended_at: null }]);
    const { data: audit } = await admin
      .from("audit_events")
      .select("action")
      .eq("organisation_id", org)
      .eq("entity_type", "support_grants");
    expect(audit).toContainEqual({ action: "insert" });
    // Instructors and parents don't see it.
    for (const s of [instructor, parent]) {
      const { data: rows } = await s.client.from("support_grants").select("id");
      expect(rows ?? []).toEqual([]);
    }
  });

  it("a long note is refused", async () => {
    const { error } = await owner.client.rpc("grant_support_access", {
      p_org: org,
      p_note: "x".repeat(501),
    });
    expect(error?.hint).toBe("support_invalid");
  });
});

describe("what support sees", () => {
  it("only after two-step sign-in", async () => {
    const plain = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await plain.auth.signInWithPassword({ email, password });
    const view = await plain.rpc("support_school_view", { p_org: org });
    expect(view.error?.code).toBe("42501");
    expect((await plain.rpc("support_schools")).error?.code).toBe("42501");
  });

  it("the school is listed while it's open", async () => {
    const { data } = await support.rpc("support_schools");
    expect(data).toContainEqual(
      expect.objectContaining({
        organisation_id: org,
        name: "Aqua House",
        note: "Our Saturday classes look wrong",
      }),
    );
  });

  it("how the school is set up, never who is in it", async () => {
    const { data, error } = await support.rpc("support_school_view", { p_org: org });
    expect(error).toBeNull();
    const view = data as Record<string, unknown> & {
      school: { name: string };
      classes: { enrolled: number }[];
      families: { count: number };
    };
    expect(view.school.name).toBe("Aqua House");
    expect(view.classes.length).toBeGreaterThan(0);
    expect(view.classes.some((c) => c.enrolled > 0)).toBe(true);
    expect(view.families.count).toBeGreaterThan(0);

    // No child, parent or family is named anywhere in it.
    const text = JSON.stringify(data);
    const { data: kids } = await admin
      .from("children")
      .select("first_name, last_name")
      .eq("organisation_id", org);
    const { data: fams } = await admin
      .from("families")
      .select("display_name")
      .eq("organisation_id", org);
    const { data: parents } = await admin
      .from("family_members")
      .select("users (name, email), families!inner (organisation_id)")
      .eq("families.organisation_id", org);
    const names = [
      ...(kids ?? []).map((k) => `${k.first_name} ${k.last_name}`),
      ...(fams ?? []).map((f) => f.display_name),
      ...(parents ?? []).flatMap((p) => {
        const u = p.users as unknown as { name: string; email: string } | null;
        return u ? [u.name, u.email] : [];
      }),
    ];
    expect(names.length).toBeGreaterThan(5);
    for (const n of names) expect(text, n).not.toContain(n);
  });

  it("each look is recorded and shown to the owner", async () => {
    const { data } = await owner.client.rpc("support_looks", { p_org: org });
    expect(data!.length).toBeGreaterThanOrEqual(1);
    expect(data![0]!.looked_by).toBe("Sam Support");
  });

  it("support can't change the school", async () => {
    const { data: before } = await admin
      .from("classes")
      .select("id, capacity")
      .eq("organisation_id", org)
      .limit(1)
      .single();
    const upd = await support
      .from("classes")
      .update({ capacity: 99 })
      .eq("id", before!.id)
      .select("id");
    expect(upd.data ?? []).toEqual([]);
    const end = await support.rpc("end_support_access", { p_org: org });
    expect(end.error?.code).toBe("42501");
    const grant = await support.rpc("grant_support_access", {
      p_org: org,
      p_note: null as unknown as string,
    });
    expect(grant.error?.code).toBe("42501");
    const { data: after } = await admin
      .from("classes")
      .select("capacity")
      .eq("id", before!.id)
      .single();
    expect(after!.capacity).toBe(before!.capacity);
  });
});

describe("ending it", () => {
  it("the owner ends it early: support is shut out at once", async () => {
    const { data, error } = await owner.client.rpc("end_support_access", { p_org: org });
    expect(error).toBeNull();
    expect(data).toBe(true);
    const view = await support.rpc("support_school_view", { p_org: org });
    expect(view.error?.code).toBe("42501");
    const { data: schools } = await support.rpc("support_schools");
    expect((schools ?? []).map((s) => s.organisation_id)).not.toContain(org);
  });

  it("access that has run out shuts support out too", async () => {
    await owner.client.rpc("grant_support_access", { p_org: org, p_note: "" });
    await admin
      .from("support_grants")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("organisation_id", org)
      .is("ended_at", null);
    const view = await support.rpc("support_school_view", { p_org: org });
    expect(view.error?.code).toBe("42501");
    // Letting support in again restarts the 48 hours.
    await owner.client.rpc("grant_support_access", { p_org: org, p_note: "" });
    expect((await support.rpc("support_school_view", { p_org: org })).error).toBeNull();
    const { count } = await admin
      .from("support_grants")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", org);
    expect(count).toBe(2);
  });
});
