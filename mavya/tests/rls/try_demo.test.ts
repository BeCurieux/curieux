import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { anonymous, signInAs, SUPABASE_URL, PUBLISHABLE_KEY, type Client } from "./helpers";

// Try it yourself acceptance (security and rules): docs/TRY_IT_YOURSELF.md.
// Each visitor's pretend school is theirs alone, and nothing in it reaches
// the real world. Every school and sign-in made here is removed at the end.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = `try-${Date.now()}-password`;
const authIds: string[] = [];
const orgIds: string[] = [];
const visitorHash = () => randomUUID().replaceAll("-", "");

async function visitorAccount(): Promise<{ profileId: string; email: string }> {
  const email = `try-${randomUUID()}@demo.ovyko.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Alex" },
  });
  if (error) throw error;
  authIds.push(data.user.id);
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  return { profileId: profile!.id, email };
}

async function demoSchool(visitor = visitorHash()) {
  const account = await visitorAccount();
  const { data, error } = await admin.rpc("create_demo_school", {
    p_user: account.profileId,
    p_visitor: visitor,
  });
  if (error) throw error;
  orgIds.push(data);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  if (signInError) throw signInError;
  return { orgId: data, owner: client, profileId: account.profileId };
}

let first: { orgId: string; owner: Client; profileId: string };
let second: { orgId: string; owner: Client; profileId: string };

beforeAll(async () => {
  first = await demoSchool();
  second = await demoSchool();
});

afterAll(async () => {
  // The same clean-up the hourly job does, run now.
  await admin
    .from("organisations")
    .update({ demo_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .in("id", orgIds);
  await admin.rpc("forget_demo_schools");
  for (const id of authIds) await admin.auth.admin.deleteUser(id);
});

describe("making a pretend school", () => {
  it("only the website, with the secret key, can make one", async () => {
    const { profileId } = await visitorAccount();
    for (const c of [anonymous(), first.owner, (await signInAs("aquaOwner")).client]) {
      const { error } = await c.rpc("create_demo_school", {
        p_user: profileId,
        p_visitor: visitorHash(),
      });
      expect(error?.code).toBe("42501");
    }
  });

  it("is filled with classes, families, a waiting list and warning signs", async () => {
    const { owner, orgId } = first;
    const count = async (table: "classes" | "families" | "place_wishes" | "attendance") =>
      (
        await owner
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId)
      ).count;
    expect(await count("classes")).toBe(6);
    expect(await count("families")).toBe(13);
    expect(await count("place_wishes")).toBe(3);
    expect(await count("attendance")).toBeGreaterThan(20);
    const { data: risk } = await owner.rpc("families_at_risk", { p_org: orgId });
    expect(risk!.map((f) => f.family_name).sort()).toEqual([
      "Harper Family",
      "Nguyen Family",
      "Rossi Family",
    ]);
    const { data: org } = await owner
      .from("organisations")
      .select("name, is_demo, demo_expires_at")
      .eq("id", orgId)
      .single();
    expect(org).toMatchObject({ name: "Seaside Swim School", is_demo: true });
    const hours = (new Date(org!.demo_expires_at!).getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it("each visitor sees only their own school", async () => {
    const { data } = await second.owner
      .from("families")
      .select("id")
      .eq("organisation_id", first.orgId);
    expect(data).toEqual([]);
    const { error } = await second.owner.rpc("families_at_risk", { p_org: first.orgId });
    expect(error?.code).toBe("42501");
  });

  it("one visitor can make five a day", async () => {
    const visitor = visitorHash();
    for (let i = 0; i < 5; i++) await demoSchool(visitor);
    const { profileId } = await visitorAccount();
    const { error } = await admin.rpc("create_demo_school", {
      p_user: profileId,
      p_visitor: visitor,
    });
    expect(error?.hint).toBe("demo_busy");
  });
});

describe("nothing reaches the real world", () => {
  it("no invites, so no one gets an email", async () => {
    const { data: fam } = await first.owner
      .from("families")
      .select("id")
      .eq("organisation_id", first.orgId)
      .limit(1)
      .single();
    const { error } = await first.owner.rpc("invite_parent", {
      p_family: fam!.id,
      p_email: "someone.real@example.test",
    });
    expect(error?.hint).toBe("demo_off");
  });

  it("no public waiting-list page", async () => {
    const { error } = await first.owner.rpc("set_waitlist_page", {
      p_org: first.orgId,
      p_on: true,
    });
    expect(error?.hint).toBe("demo_off");
  });

  it("no payments or plan, even written with the secret key", async () => {
    const account = await admin
      .from("payment_accounts")
      .insert({ organisation_id: first.orgId, stripe_account_id: "acct_demo123" });
    expect(account.error?.hint).toBe("demo_off");
    const plan = await admin.from("school_subscriptions").insert({
      organisation_id: first.orgId,
      stripe_customer_id: "cus_demo123",
    });
    expect(plan.error?.hint).toBe("demo_off");
  });
});

describe("a day later", () => {
  it("the school and everything in it is deleted", async () => {
    await admin
      .from("organisations")
      .update({ demo_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", second.orgId);
    expect((await admin.rpc("forget_demo_schools")).error).toBeNull();
    const { count: orgs } = await admin
      .from("organisations")
      .select("id", { count: "exact", head: true })
      .eq("id", second.orgId);
    const { count: families } = await admin
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", second.orgId);
    expect([orgs, families]).toEqual([0, 0]);
    // The other school, still in its day, is untouched.
    const { count: kept } = await admin
      .from("organisations")
      .select("id", { count: "exact", head: true })
      .eq("id", first.orgId);
    expect(kept).toBe(1);
  });
});
