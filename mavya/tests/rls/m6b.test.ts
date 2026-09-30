import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { ORGS } from "../../scripts/fixtures";
import {
  anonymous,
  PUBLISHABLE_KEY,
  signInAs,
  SUPABASE_URL,
  type Client,
  type Session,
} from "./helpers";

// M6b acceptance (security and rules): docs/M6_MIGRATION_PILOT.md. Every
// check runs as a real signed-in user or an anonymous visitor through the
// public API. The secret key is used only to set up and remove the new
// parent's account, as the join page's server does, and to age an invite:
// never to make a check pass.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let aquaOwner: Session;
let aquaInstructor: Session;
let peakOwner: Session;
let burrows: Session;
let joiner: Client;
let joinerAuthId: string;
let thompson: string;

const email = `joiner.${Date.now()}@example.test`;
const password = "a-long-test-password";

const invite = (s: Session, family: string, to: string) =>
  s.client.rpc("invite_parent", { p_family: family, p_email: to });
const details = (c: Client, code: string) => c.rpc("invite_details", { p_code: code });
const accept = (c: Client, code: string) => c.rpc("accept_invite", { p_code: code });

beforeAll(async () => {
  [aquaOwner, aquaInstructor, peakOwner, burrows] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
    signInAs("burrowsParent"),
  ]);
  const { data } = await aquaOwner.client
    .from("families")
    .select("id")
    .eq("display_name", "Thompson Family")
    .single();
  thompson = data!.id;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Jo Thompson" },
  });
  if (error) throw error;
  joinerAuthId = created.user.id;
  joiner = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await joiner.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(joinerAuthId);
});

describe("inviting", () => {
  let code: string;

  beforeAll(async () => {
    const { data, error } = await invite(aquaOwner, thompson, ` ${email.toUpperCase()} `);
    expect(error).toBeNull();
    code = data!;
  });

  it("gives the owner a code only a hash of which is kept", async () => {
    expect(code).toMatch(/^[0-9a-f]{64}$/);
    const { data } = await aquaOwner.client
      .from("family_invites")
      .select("email, status")
      .eq("family_id", thompson)
      .eq("email", email);
    expect(data).toEqual([{ email, status: "pending" }]);
    const { error } = await aquaOwner.client.from("family_invites").select("code_hash");
    expect(error?.code).toBe("42501");
  });

  it("tells whoever holds the link the school, family and email, and nothing else", async () => {
    const { data } = await details(anonymous(), code);
    expect(data).toEqual([
      { school: "Aqua House", family: "Thompson Family", email, status: "pending" },
    ]);
    expect((await details(anonymous(), "0".repeat(64))).data).toEqual([]);
  });

  it("can't be used by someone signed in with another email", async () => {
    const { error } = await accept(burrows.client, code);
    expect(error?.hint).toBe("invite_wrong_email");
  });

  it("can't be used without signing in", async () => {
    const { error } = await accept(anonymous(), code);
    expect(error?.code).toBe("42501");
  });

  it("lets the right person join, once", async () => {
    const before = await joiner.from("children").select("first_name");
    expect(before.data).toEqual([]);

    const { data, error } = await accept(joiner, code);
    expect(error).toBeNull();
    expect(data).toBe(thompson);
    const after = await joiner.from("children").select("first_name");
    expect(after.data!.map((c) => c.first_name)).toEqual(["Ruby"]);
    const { data: membership } = await joiner
      .from("family_members")
      .select("relationship, is_primary_guardian");
    expect(membership).toEqual([{ relationship: "parent", is_primary_guardian: true }]);

    // The school's owner sees who joined, by name and email only.
    const { data: parents } = await aquaOwner.client.rpc("family_parents", { p_family: thompson });
    expect(parents).toEqual([
      { user_id: expect.any(String), name: "Jo Thompson", email, is_primary_guardian: true },
    ]);

    expect((await details(anonymous(), code)).data![0]!.status).toBe("accepted");
    expect((await accept(joiner, code)).error?.hint).toBe("invite_closed");
  });

  it("isn't needed twice: someone who has joined can't be invited again", async () => {
    const { error } = await invite(aquaOwner, thompson, email);
    expect(error?.hint).toBe("invite_invalid");
  });

  it("refuses an address that isn't one", async () => {
    const { error } = await invite(aquaOwner, thompson, "not-an-email");
    expect(error?.hint).toBe("invite_invalid");
  });

  it("is recorded in the school's activity", async () => {
    const { data } = await aquaOwner.client
      .from("audit_events")
      .select("action, after_json")
      .eq("entity_type", "family_invites")
      .order("created_at");
    const mine = (data ?? []).filter(
      (e) => (e.after_json as { email?: string } | null)?.email === email,
    );
    expect(mine.map((e) => e.action)).toEqual(["insert", "update"]);
    expect((mine[1]!.after_json as { status: string }).status).toBe("accepted");
  });
});

describe("links that no longer work", () => {
  const other = `other.${Date.now()}@example.test`;

  it("a replaced invite stops working", async () => {
    const { data: first } = await invite(aquaOwner, thompson, other);
    const { data: second } = await invite(aquaOwner, thompson, other);
    expect((await details(anonymous(), first!)).data![0]!.status).toBe("revoked");
    expect((await details(anonymous(), second!)).data![0]!.status).toBe("pending");
  });

  it("a cancelled invite stops working", async () => {
    const { data: code } = await invite(aquaOwner, thompson, other);
    const { data: row } = await aquaOwner.client
      .from("family_invites")
      .select("id")
      .eq("email", other)
      .eq("status", "pending")
      .single();
    expect((await aquaOwner.client.rpc("revoke_invite", { p_invite: row!.id })).error).toBeNull();
    expect((await details(anonymous(), code!)).data![0]!.status).toBe("revoked");
  });

  it("an invite older than 14 days stops working", async () => {
    const { data: code } = await invite(aquaOwner, thompson, email.replace("joiner", "late"));
    await admin
      .from("family_invites")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("email", email.replace("joiner", "late"));
    expect((await details(anonymous(), code!)).data![0]!.status).toBe("expired");
  });
});

describe("who can invite", () => {
  it("only the school's own owners", async () => {
    for (const s of [aquaInstructor, peakOwner, burrows]) {
      const { error } = await invite(s, thompson, "someone@example.test");
      expect(error?.code).toBe("42501");
      const { data } = await s.client.from("family_invites").select("id");
      expect(data).toEqual([]);
      const { error: parents } = await s.client.rpc("family_parents", { p_family: thompson });
      expect(parents?.code).toBe("42501");
    }
  });

  it("only the school's owners see how far it is through setting up", async () => {
    const { data, error } = await aquaOwner.client.rpc("setup_progress", { p_org: ORGS.aqua.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ makeup_rules: true });
    expect((data as { families_joined: number }).families_joined).toBeGreaterThanOrEqual(3);
    for (const s of [aquaInstructor, peakOwner, burrows]) {
      const { error: refused } = await s.client.rpc("setup_progress", { p_org: ORGS.aqua.id });
      expect(refused?.code).toBe("42501");
    }
  });
});
