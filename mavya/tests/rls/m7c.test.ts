import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, SUPABASE_URL, type Client } from "./helpers";

// M7c part 1 acceptance (rules and security): docs/M7_PAYMENTS.md. The
// secret key sets up a school of the tests' own, adds lines with chosen due
// dates, and runs the reminder job for a chosen moment, as the schedule does.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `reminders-${run}-password`;
const createdAuthIds: string[] = [];
const tz = "Australia/Sydney";
const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const today = localDate(new Date());
// The day the reminder job runs in these tests, far from today.
const D = "2027-03-10";
const at = (time: string) => `${D} ${time} ${tz}`;

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
  return profile!.id;
}

async function signIn(email: string): Promise<Client> {
  const c = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

let orgId: string;
let owner: Client;
let lee: Client;
const fam = { lee: "", ruiz: "", kim: "" };
const parent = { lee: "", ruiz: "", kim: "" };

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Reminders Test Swim",
      slug: `reminders-test-${run}`,
      activity_type: "swimming",
      owner_two_step_required: false,
      timezone: tz,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;
  const ownerId = await newAccount(`reminders.owner.${run}@example.test`, "Olive Owner");
  await admin
    .from("staff_memberships")
    .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
  for (const k of ["lee", "ruiz", "kim"] as const) {
    parent[k] = await newAccount(`reminders.${k}.${run}@example.test`, `${k} Parent`);
    const { data: f } = await admin
      .from("families")
      .insert({ organisation_id: orgId, display_name: `Reminders ${k} ${run}` })
      .select("id")
      .single();
    fam[k] = f!.id;
    await admin.from("family_members").insert({
      family_id: fam[k],
      user_id: parent[k],
      relationship: "parent",
      is_primary_guardian: true,
    });
  }
  owner = await signIn(`reminders.owner.${run}@example.test`);
  lee = await signIn(`reminders.lee.${run}@example.test`);

  const charge = (family: string, cents: number, due: string) => ({
    organisation_id: orgId,
    family_id: family,
    kind: "charge",
    amount_cents: cents,
    description: "Fees",
    due_on: due,
  });
  // Lee owes three charges: due in a week, today and a week ago (on day D).
  // Ruiz paid theirs, and a cancelled charge doesn't count. Kim owes one
  // charge overdue as of today, and one not yet due.
  const { data: lines, error: e } = await admin
    .from("ledger_entries")
    .insert([
      charge(fam.lee, 5000, addDays(D, 7)),
      charge(fam.lee, 3000, D),
      charge(fam.lee, 2000, addDays(D, -7)),
      charge(fam.ruiz, 4000, addDays(D, -14)),
      charge(fam.ruiz, 1000, addDays(D, -7)),
      charge(fam.kim, 1500, addDays(today, -3)),
      charge(fam.kim, 500, addDays(today, 10)),
    ])
    .select("id, family_id, amount_cents");
  if (e) throw e;
  await owner.rpc("record_payment", {
    p_family: fam.ruiz,
    p_amount_cents: 4000,
    p_method: "cash",
    p_paid_on: today,
  });
  const cancelMe = lines!.find((l) => l.family_id === fam.ruiz && l.amount_cents === 1000)!;
  await owner.rpc("cancel_ledger_entry", { p_entry: cancelMe.id, p_reason: "Waived" });
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", `reminders-test-${run}`);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const reminders = async () => {
  const { data } = await admin
    .from("email_deliveries")
    .select("recipient_user_id, payload")
    .eq("kind", "fee_reminder")
    .eq("organisation_id", orgId);
  return data!;
};

describe("fee reminders", () => {
  it("are off until the school switches them on", async () => {
    expect((await admin.rpc("queue_fee_reminders_at", { p_now: at("09:30") })).data).toBe(0);
    expect(await reminders()).toEqual([]);
  });

  it("only owners switch them, and it's audited", async () => {
    const { error } = await lee.rpc("set_fee_reminders", { p_org: orgId, p_on: true });
    expect(error?.code).toBe("42501");
    expect((await owner.rpc("set_fee_reminders", { p_org: orgId, p_on: true })).error).toBeNull();
    const { data: audit } = await admin
      .from("audit_events")
      .select("after_json")
      .eq("organisation_id", orgId)
      .eq("entity_type", "organisations");
    expect(audit).toEqual([{ after_json: { fee_reminders: true } }]);
  });

  it("go at 9am school time: a week before, on the day, and after; once each", async () => {
    expect((await admin.rpc("queue_fee_reminders_at", { p_now: at("08:30") })).data).toBe(0);
    expect((await admin.rpc("queue_fee_reminders_at", { p_now: at("09:30") })).data).toBe(3);
    expect((await admin.rpc("queue_fee_reminders_at", { p_now: at("09:45") })).data).toBe(0);
    const sent = await reminders();
    expect(sent.every((r) => r.recipient_user_id === parent.lee)).toBe(true);
    expect(
      sent
        .map((r) => r.payload as { stage: string; due_on: string })
        .map((p) => `${p.stage} ${p.due_on}`)
        .sort(),
    ).toEqual([`due ${D}`, `overdue ${addDays(D, -7)}`, `soon ${addDays(D, 7)}`]);
  });

  it("go two weeks after, and not to families who've paid or had it cancelled", async () => {
    const later = `${addDays(D, 7)} 09:30 ${tz}`;
    // Lee's charges due D (now a week late) and D-7 (two weeks); D+7 is due today.
    expect((await admin.rpc("queue_fee_reminders_at", { p_now: later })).data).toBe(3);
    const paid = await admin.rpc("queue_fee_reminders_at", {
      p_now: `${addDays(D, 14)} 09:30 ${tz}`,
    });
    // Only Lee again (D+7 a week late, D two weeks late); Ruiz owes nothing.
    expect(paid.data).toBe(2);
    expect((await reminders()).every((r) => r.recipient_user_id === parent.lee)).toBe(true);
  });

  it("the sender checks what's owing just before sending; it's the server's alone", async () => {
    const { data } = await admin.rpc("family_dues", { p_family: fam.kim });
    expect(data).toEqual([{ owing_cents: 2000, overdue_cents: 1500, reminders_on: true }]);
    expect((await owner.rpc("family_dues", { p_family: fam.kim })).error?.code).toBe("42501");
  });
});

describe("what's overdue", () => {
  it("owners see each family's overdue amount: owed and due before today", async () => {
    const { data } = await owner.rpc("family_balances", { p_org: orgId });
    const row = (f: string) => data!.find((r) => r.family_id === f);
    expect(row(fam.kim)).toMatchObject({ balance_cents: 2000, overdue_cents: 1500 });
    // Lee's charges are all due in 2027.
    expect(row(fam.lee)).toMatchObject({ balance_cents: 10000, overdue_cents: 0 });
    expect(row(fam.ruiz)).toBeUndefined();
  });

  it("a payment counts against the oldest charges first", async () => {
    await owner.rpc("record_payment", {
      p_family: fam.kim,
      p_amount_cents: 1000,
      p_method: "cash",
      p_paid_on: today,
    });
    const { data } = await owner.rpc("family_balances", { p_org: orgId });
    expect(data!.find((r) => r.family_id === fam.kim)).toMatchObject({
      balance_cents: 1000,
      overdue_cents: 500,
    });
  });
});
