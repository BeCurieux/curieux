import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M7a acceptance (security and rules): docs/M7_PAYMENTS.md. The secret key
// only sets up a school of the tests' own and tidies it away; everything a
// person might try goes through their own session.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `accounts-${run}-password`;
const createdAuthIds: string[] = [];
const tz = "Australia/Sydney";

const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// How many times a class on this ISO weekday meets between two dates.
const lessonsBetween = (weekday: number, from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const iso = ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (iso === weekday) n += 1;
  }
  return n;
};
const today = localDate(new Date());

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

const emails = {
  owner: `accounts.owner.${run}@example.test`,
  lee: `accounts.lee.${run}@example.test`,
  ruiz: `accounts.ruiz.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let lee: Client;
let ruiz: Client;
let leeFamily: string;
let ruizFamily: string;
const classes = { a: "", b: "", c: "" };
const kids = { ava: "", ben: "", cy: "" };
// Monday, Wednesday and Friday classes at $25, $20 and $30 a lesson.
const price = { a: 2500, b: 2000, c: 3000 };
const weekday = { a: 1, b: 3, c: 5 };

const current = { starts: addDays(today, -30), ends: addDays(today, 20) };
const next = { starts: addDays(today, 30), ends: addDays(today, 100) };
let currentTerm: string;
let nextTerm: string;

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Accounts Test Swim",
      slug: `accounts-test-${run}`,
      activity_type: "swimming",
      owner_two_step_required: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;
  const ownerId = await newAccount(emails.owner, "Olive Owner");
  const leeId = await newAccount(emails.lee, "Lena Lee");
  const ruizId = await newAccount(emails.ruiz, "Rafa Ruiz");
  await admin
    .from("staff_memberships")
    .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });

  const { data: loc } = await admin
    .from("locations")
    .insert({ organisation_id: orgId, name: "Accounts Pool" })
    .select("id")
    .single();
  const { data: program } = await admin
    .from("programs")
    .insert({ organisation_id: orgId, name: "Learn to swim" })
    .select("id")
    .single();
  const { data: level } = await admin
    .from("levels")
    .insert({ organisation_id: orgId, program_id: program!.id, name: "Dolphin" })
    .select("id")
    .single();
  const base = {
    organisation_id: orgId,
    location_id: loc!.id,
    program_id: program!.id,
    level_id: level!.id,
    start_time: "16:00",
    duration_minutes: 30,
    capacity: 4,
  };
  const { data: made } = await admin
    .from("classes")
    .insert([
      { ...base, name: "Dolphin 3", weekday: weekday.a },
      { ...base, name: "Dolphin 3 Wed", weekday: weekday.b },
      { ...base, name: "Dolphin 4", weekday: weekday.c },
    ])
    .select("id, name");
  const byName = (n: string) => made!.find((c) => c.name === n)!.id;
  classes.a = byName("Dolphin 3");
  classes.b = byName("Dolphin 3 Wed");
  classes.c = byName("Dolphin 4");

  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Accounts Lee ${run}` },
      { organisation_id: orgId, display_name: `Accounts Ruiz ${run}` },
    ])
    .select("id, display_name");
  leeFamily = fams!.find((f) => f.display_name.includes("Lee"))!.id;
  ruizFamily = fams!.find((f) => f.display_name.includes("Ruiz"))!.id;
  await admin.from("family_members").insert([
    { family_id: leeFamily, user_id: leeId, relationship: "parent", is_primary_guardian: true },
    { family_id: ruizFamily, user_id: ruizId, relationship: "parent", is_primary_guardian: true },
  ]);
  const child = (family: string, first: string) => ({
    organisation_id: orgId,
    family_id: family,
    first_name: first,
    last_name: "Test",
    date_of_birth: "2019-03-01",
  });
  const { data: children } = await admin
    .from("children")
    .insert([child(leeFamily, "Ava"), child(leeFamily, "Ben"), child(ruizFamily, "Cy")])
    .select("id, first_name");
  for (const c of children!) kids[c.first_name.toLowerCase() as keyof typeof kids] = c.id;
  await admin.from("enrolments").insert([
    { organisation_id: orgId, child_id: kids.ava, class_id: classes.a },
    { organisation_id: orgId, child_id: kids.ben, class_id: classes.a },
    { organisation_id: orgId, child_id: kids.cy, class_id: classes.b },
  ]);

  owner = await signIn(emails.owner);
  lee = await signIn(emails.lee);
  ruiz = await signIn(emails.ruiz);

  const t1 = await owner.rpc("save_term", {
    p_org: orgId,
    p_name: "Term 1",
    p_starts_on: current.starts,
    p_ends_on: current.ends,
  });
  currentTerm = t1.data!;
  const t2 = await owner.rpc("save_term", {
    p_org: orgId,
    p_name: "Term 2",
    p_starts_on: next.starts,
    p_ends_on: next.ends,
  });
  nextTerm = t2.data!;
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", `accounts-test-${run}`);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const balance = async (family: string) => {
  const { data } = await admin
    .from("ledger_entries")
    .select("amount_cents")
    .eq("family_id", family);
  return data!.reduce((sum, l) => sum + l.amount_cents, 0);
};

describe("prices", () => {
  it("an owner sets a class's price per lesson; parents can't", async () => {
    for (const [key, id] of Object.entries(classes) as [keyof typeof classes, string][]) {
      const { error } = await owner
        .from("classes")
        .update({ price_per_lesson_cents: price[key] })
        .eq("id", id);
      expect(error).toBeNull();
    }
    await lee.from("classes").update({ price_per_lesson_cents: 1 }).eq("id", classes.a);
    const { data } = await admin
      .from("classes")
      .select("price_per_lesson_cents")
      .eq("id", classes.a)
      .single();
    expect(data!.price_per_lesson_cents).toBe(price.a);
  });
});

describe("term fees", () => {
  it("charge continuing children, charge movers for their new class, skip leavers", async () => {
    await owner.rpc("prepare_term_asks", { p_term: nextTerm });
    const { data: asks } = await admin
      .from("reenrolment_asks")
      .select("id, child_id")
      .eq("term_id", nextTerm);
    const ask = (child: string) => asks!.find((a) => a.child_id === child)!.id;
    await owner.rpc("offer_term_move", { p_ask: ask(kids.ava), p_class: classes.c });
    await owner.rpc("answer_term_ask", { p_ask: ask(kids.ava), p_answer: "move" });
    await owner.rpc("answer_term_ask", { p_ask: ask(kids.ben), p_answer: "leave" });

    const { data, error } = await owner.rpc("create_term_fees", { p_term: nextTerm });
    expect(error).toBeNull();
    expect(data).toBe(2);
    const { data: fees } = await admin
      .from("ledger_entries")
      .select("child_id, class_id, lessons, unit_cents, amount_cents, description, due_on")
      .eq("term_id", nextTerm);
    const fee = (child: string) => fees!.find((f) => f.child_id === child);
    const avaLessons = lessonsBetween(weekday.c, next.starts, next.ends);
    expect(fee(kids.ava)).toMatchObject({
      class_id: classes.c,
      lessons: avaLessons,
      unit_cents: price.c,
      amount_cents: avaLessons * price.c,
      description: "Term 2 · Dolphin 4",
      // Due on the term's first day (M7c).
      due_on: next.starts,
    });
    expect(fee(kids.ben)).toBeUndefined();
    const cyLessons = lessonsBetween(weekday.b, next.starts, next.ends);
    expect(fee(kids.cy)).toMatchObject({ class_id: classes.b, amount_cents: cyLessons * price.b });
  });

  it("running it again doubles nothing", async () => {
    expect((await owner.rpc("create_term_fees", { p_term: nextTerm })).data).toBe(0);
  });

  it("a term under way is charged only for the lessons left", async () => {
    const { data } = await owner.rpc("create_term_fees", { p_term: currentTerm });
    expect(data).toBe(3);
    const { data: fee } = await admin
      .from("ledger_entries")
      .select("lessons, amount_cents, due_on")
      .eq("term_id", currentTerm)
      .eq("child_id", kids.cy)
      .single();
    const left = lessonsBetween(weekday.b, today, current.ends);
    // Under way: due the day it's added (M7c).
    expect(fee).toEqual({ lessons: left, amount_cents: left * price.b, due_on: today });
  });

  it("only the school's owners create fees", async () => {
    for (const c of [lee, (await signInAs("peakOwner")).client]) {
      expect((await c.rpc("create_term_fees", { p_term: nextTerm })).error?.code).toBe("42501");
    }
  });
});

describe("payments, credits and cancelling", () => {
  it("records a payment taken elsewhere; not one dated in the future", async () => {
    const future = await owner.rpc("record_payment", {
      p_family: ruizFamily,
      p_amount_cents: 5000,
      p_method: "bank_transfer",
      p_paid_on: addDays(today, 2),
    });
    expect(future.error?.hint).toBe("ledger_invalid");
    const before = await balance(ruizFamily);
    const { error } = await owner.rpc("record_payment", {
      p_family: ruizFamily,
      p_amount_cents: 5000,
      p_method: "bank_transfer",
      p_paid_on: today,
      p_note: "Paid by transfer",
    });
    expect(error).toBeNull();
    expect(await balance(ruizFamily)).toBe(before - 5000);
  });

  it("adds a credit and a charge, with a reason", async () => {
    const before = await balance(leeFamily);
    const credit = await owner.rpc("add_account_line", {
      p_family: leeFamily,
      p_kind: "credit",
      p_amount_cents: 1000,
      p_reason: "Sibling discount",
      p_child: kids.ben,
    });
    expect(credit.error).toBeNull();
    const charge = await owner.rpc("add_account_line", {
      p_family: leeFamily,
      p_kind: "charge",
      p_amount_cents: 1500,
      p_reason: "Swim cap",
    });
    expect(charge.error).toBeNull();
    expect(await balance(leeFamily)).toBe(before + 500);
    // A charge falls due the day it's added; a credit has no due date (M7c).
    const { data: due } = await admin
      .from("ledger_entries")
      .select("id, due_on")
      .in("id", [credit.data!, charge.data!]);
    expect(due!.find((l) => l.id === credit.data)!.due_on).toBeNull();
    expect(due!.find((l) => l.id === charge.data)!.due_on).toBe(today);
    const noReason = await owner.rpc("add_account_line", {
      p_family: leeFamily,
      p_kind: "credit",
      p_amount_cents: 100,
      p_reason: " ",
    });
    expect(noReason.error?.hint).toBe("ledger_invalid");
    const otherChild = await owner.rpc("add_account_line", {
      p_family: leeFamily,
      p_kind: "credit",
      p_amount_cents: 100,
      p_reason: "Wrong child",
      p_child: kids.cy,
    });
    expect(otherChild.error?.hint).toBe("ledger_invalid");
  });

  it("cancels a line once, by adding its opposite", async () => {
    const { data: cap } = await admin
      .from("ledger_entries")
      .select("id")
      .eq("description", "Swim cap")
      .single();
    const before = await balance(leeFamily);
    const { data: cancellation, error } = await owner.rpc("cancel_ledger_entry", {
      p_entry: cap!.id,
      p_reason: "Added by mistake",
    });
    expect(error).toBeNull();
    expect(await balance(leeFamily)).toBe(before - 1500);
    const again = await owner.rpc("cancel_ledger_entry", { p_entry: cap!.id, p_reason: "Again" });
    expect(again.error?.hint).toBe("already_cancelled");
    const ofCancellation = await owner.rpc("cancel_ledger_entry", {
      p_entry: cancellation!,
      p_reason: "Undo",
    });
    expect(ofCancellation.error?.hint).toBe("already_cancelled");
  });

  it("no one changes or deletes a line, or adds one directly", async () => {
    const { data: line } = await admin
      .from("ledger_entries")
      .select("id, amount_cents")
      .eq("family_id", leeFamily)
      .limit(1)
      .single();
    await owner.from("ledger_entries").update({ amount_cents: 1 }).eq("id", line!.id);
    await owner.from("ledger_entries").delete().eq("id", line!.id);
    const { data: still } = await admin
      .from("ledger_entries")
      .select("amount_cents")
      .eq("id", line!.id)
      .single();
    expect(still!.amount_cents).toBe(line!.amount_cents);
    const insert = await owner.from("ledger_entries").insert({
      organisation_id: orgId,
      family_id: leeFamily,
      kind: "credit",
      amount_cents: -100000,
      description: "Free money",
    });
    expect(insert.error?.code).toBe("42501");
    // Not even the server's own key can change a line.
    const forced = await admin
      .from("ledger_entries")
      .update({ amount_cents: 1 })
      .eq("id", line!.id);
    expect(forced.error).not.toBeNull();
  });

  it("only owners record money", async () => {
    for (const c of [lee, (await signInAs("peakOwner")).client]) {
      const pay = await c.rpc("record_payment", {
        p_family: leeFamily,
        p_amount_cents: 100000,
        p_method: "cash",
        p_paid_on: today,
      });
      expect(pay.error?.code).toBe("42501");
      const credit = await c.rpc("add_account_line", {
        p_family: leeFamily,
        p_kind: "credit",
        p_amount_cents: 100000,
        p_reason: "Sneaky",
      });
      expect(credit.error?.code).toBe("42501");
    }
  });
});

describe("who sees an account", () => {
  it("each parent sees only their own family's lines", async () => {
    const { data: mine } = await lee.from("ledger_entries").select("family_id");
    expect(mine!.length).toBeGreaterThan(0);
    expect(new Set(mine!.map((l) => l.family_id))).toEqual(new Set([leeFamily]));
    const { data: theirs } = await ruiz.from("ledger_entries").select("family_id");
    expect(new Set(theirs!.map((l) => l.family_id))).toEqual(new Set([ruizFamily]));
  });

  it("instructors and other schools see none", async () => {
    for (const who of ["aquaInstructor", "peakOwner", "martinParent"] as const) {
      const s = await signInAs(who);
      const { data } = await s.client
        .from("ledger_entries")
        .select("id")
        .eq("organisation_id", orgId);
      expect(data, who).toEqual([]);
    }
  });

  it("the owner sees who owes what, largest first", async () => {
    const { data, error } = await owner.rpc("family_balances", { p_org: orgId });
    expect(error).toBeNull();
    const expected = [
      { family_id: leeFamily, balance_cents: await balance(leeFamily) },
      { family_id: ruizFamily, balance_cents: await balance(ruizFamily) },
    ].sort((x, y) => y.balance_cents - x.balance_cents);
    expect(data!.map((r) => ({ family_id: r.family_id, balance_cents: r.balance_cents }))).toEqual(
      expected,
    );
    expect((await lee.rpc("family_balances", { p_org: orgId })).error?.code).toBe("42501");
  });

  it("every line is audited", async () => {
    const { data } = await admin
      .from("audit_events")
      .select("action")
      .eq("organisation_id", orgId)
      .eq("entity_type", "ledger_entries");
    expect(data!.length).toBeGreaterThanOrEqual(8);
  });
});
