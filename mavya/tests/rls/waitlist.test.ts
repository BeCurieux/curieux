import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { totp } from "../totp";
import { anonymous, PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// The founding-schools waitlist (docs/WAITLIST_PAGE.md): anyone can join
// from the website; only platform admins, after two-step sign-in, can read
// it; nobody can read or change it directly.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `waitlist-${run}-password`;
const staffEmail = `waitlist.staff.${run}@example.test`;
const email = `owner.${run}@swimschool.example`;
let authId: string;
let staff: Client;

const join = (c: Client, overrides: Record<string, unknown> = {}) =>
  c.rpc("join_waitlist", {
    p_name: "Wendy Owner",
    p_school: "Wave Swim",
    p_suburb: "Manly",
    p_email: email,
    p_phone: "",
    p_swimmers: "200_500",
    p_current_system: "iclasspro",
    p_next_break: "",
    p_consent: true,
    ...overrides,
  });

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
    user_metadata: { name: "Pat Platform" },
  });
  if (error) throw error;
  authId = data.user.id;
  const { data: profile } = await admin.from("users").select("id").eq("auth_id", authId).single();
  await admin.from("platform_admins").insert({ user_id: profile!.id });
  staff = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await staff.auth.signInWithPassword({ email: staffEmail, password });
});

afterAll(async () => {
  await admin.from("waitlist_signups").delete().ilike("email", `%.${run}@%`);
  await admin.auth.admin.deleteUser(authId);
});

describe("joining the waitlist", () => {
  it("anyone can join from the website, with consent", async () => {
    const visitor = anonymous();
    const noConsent = await join(visitor, { p_consent: false });
    expect(noConsent.error?.hint).toBe("waitlist_invalid");
    const badEmail = await join(visitor, { p_email: "not-an-email" });
    expect(badEmail.error?.hint).toBe("waitlist_invalid");
    const noSchool = await join(visitor, { p_school: "  " });
    expect(noSchool.error?.hint).toBe("waitlist_invalid");
    const badChoice = await join(visitor, { p_swimmers: "lots" });
    expect(badChoice.error?.hint).toBe("waitlist_invalid");
    const ok = await join(visitor);
    expect(ok.error).toBeNull();
  });

  it("joining again updates the details, not a second row", async () => {
    const again = await join(anonymous(), {
      p_email: email.toUpperCase(),
      p_school: "Wave Swim Manly",
      p_next_break: "December",
    });
    expect(again.error).toBeNull();
    const { data } = await admin
      .from("waitlist_signups")
      .select("school, next_break, swimmers")
      .ilike("email", email);
    expect(data).toEqual([
      { school: "Wave Swim Manly", next_break: "December", swimmers: "200_500" },
    ]);
  });

  it("nobody reads or writes it directly, signed in or not", async () => {
    const owner = await signInAs("aquaOwner");
    for (const c of [anonymous(), owner.client, staff]) {
      const { data } = await c.from("waitlist_signups").select("*");
      expect(data ?? []).toEqual([]);
      const insert = await c.from("waitlist_signups").insert({
        name: "x",
        school: "x",
        suburb: "x",
        email: `x.${run}@example.test`,
        consented_at: new Date().toISOString(),
      });
      expect(insert.error?.code).toBe("42501");
    }
  });
});

describe("reading the waitlist", () => {
  it("only platform admins, and only after two-step sign-in", async () => {
    const owner = await signInAs("aquaOwner");
    expect((await owner.client.rpc("waitlist")).error?.code).toBe("42501");
    expect((await anonymous().rpc("waitlist")).error?.code).toBe("42501");
    expect((await staff.rpc("waitlist")).error?.code).toBe("42501");
    const { data: factor } = await staff.auth.mfa.enroll({ factorType: "totp" });
    await staff.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totp(factor!.totp.secret),
    });
    const { data, error } = await staff.rpc("waitlist");
    expect(error).toBeNull();
    expect(data!.find((w) => w.email === email)).toMatchObject({
      name: "Wendy Owner",
      school: "Wave Swim Manly",
      current_system: "iclasspro",
    });
  });
});
