import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M8 acceptance (security and rules): docs/M8_NETWORK.md. M8a: what Ovyko
// did for a school this month, counted from the records, for its owners
// only. M8b: what families want, inside one school.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `m8-${run}-password`;
const slug = `m8-test-${run}`;
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
  owner: `m8.owner.${run}@example.test`,
  teacher: `m8.teacher.${run}@example.test`,
  lee: `m8.lee.${run}@example.test`,
  ruiz: `m8.ruiz.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let teacher: Client;
let lee: Client;
let ruiz: Client;
let leeId: string;
let leeFamily: string;
let ruizFamily: string;
let locId: string;
let level2: string;
let level3: string;
let tuesday: string;
let thursday: string;
const kids = { ava: "", ben: "", cy: "", dee: "" };

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Network Test Swim",
      slug,
      activity_type: "swimming",
      owner_two_step_required: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;
  const ownerId = await newAccount(emails.owner, "Olive Owner");
  const teacherId = await newAccount(emails.teacher, "Tia Teacher");
  leeId = await newAccount(emails.lee, "Lena Lee");
  const ruizId = await newAccount(emails.ruiz, "Rafa Ruiz");
  await admin.from("staff_memberships").insert([
    { user_id: ownerId, organisation_id: orgId, role: "owner" },
    { user_id: teacherId, organisation_id: orgId, role: "instructor" },
  ]);
  const { data: loc } = await admin
    .from("locations")
    .insert({ organisation_id: orgId, name: "Riverside" })
    .select("id")
    .single();
  locId = loc!.id;
  const { data: program } = await admin
    .from("programs")
    .insert({ organisation_id: orgId, name: "Learn to swim" })
    .select("id")
    .single();
  const { data: levels } = await admin
    .from("levels")
    .insert([
      { organisation_id: orgId, program_id: program!.id, name: "Level 2", sort_order: 2 },
      { organisation_id: orgId, program_id: program!.id, name: "Level 3", sort_order: 3 },
    ])
    .select("id, name");
  level2 = levels!.find((l) => l.name === "Level 2")!.id;
  level3 = levels!.find((l) => l.name === "Level 3")!.id;
  const base = {
    organisation_id: orgId,
    location_id: locId,
    program_id: program!.id,
    duration_minutes: 30,
    price_per_lesson_cents: 2500,
  };
  const { data: made } = await admin
    .from("classes")
    .insert([
      {
        ...base,
        name: "Level 2 Tue",
        level_id: level2,
        weekday: 2,
        start_time: "16:30",
        capacity: 1,
      },
      {
        ...base,
        name: "Level 3 Thu",
        level_id: level3,
        weekday: 4,
        start_time: "17:00",
        capacity: 6,
      },
    ])
    .select("id, name");
  tuesday = made!.find((c) => c.name === "Level 2 Tue")!.id;
  thursday = made!.find((c) => c.name === "Level 3 Thu")!.id;

  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Network Lee ${run}` },
      { organisation_id: orgId, display_name: `Network Ruiz ${run}` },
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
    last_name: "Net",
    date_of_birth: "2019-03-01",
  });
  const { data: children } = await admin
    .from("children")
    .insert([
      child(leeFamily, "Ava"),
      child(leeFamily, "Ben"),
      child(ruizFamily, "Cy"),
      child(ruizFamily, "Dee"),
    ])
    .select("id, first_name");
  for (const c of children!) kids[c.first_name.toLowerCase() as keyof typeof kids] = c.id;
  // Dee fills the Tuesday class; Ava and Ben swim on Thursdays.
  await admin.from("enrolments").insert([
    { organisation_id: orgId, child_id: kids.dee, class_id: tuesday },
    { organisation_id: orgId, child_id: kids.ava, class_id: thursday },
    { organisation_id: orgId, child_id: kids.ben, class_id: thursday },
  ]);
  owner = await signIn(emails.owner);
  teacher = await signIn(emails.teacher);
  lee = await signIn(emails.lee);
  ruiz = await signIn(emails.ruiz);
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", slug);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const thisMonth = () => new Date().toISOString().slice(0, 8) + "01";
const month = async () => {
  const { data, error } = await owner.rpc("ovyko_month", { p_org: orgId, p_month: thisMonth() });
  if (error) throw error;
  return data![0]!;
};

async function nextLesson(classId: string) {
  const { data } = await admin
    .from("class_occurrences")
    .select("id")
    .eq("class_id", classId)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(1)
    .single();
  return data!.id;
}

describe("M8a: this month with Ovyko", () => {
  it("only the school's owners see it", async () => {
    const outsider = await signInAs("aquaOwner");
    for (const c of [teacher, lee, outsider.client]) {
      const { error } = await c.rpc("ovyko_month", { p_org: orgId, p_month: thisMonth() });
      expect(error?.code).toBe("42501");
    }
  });

  it("counts absences parents report, not ones staff record", async () => {
    const before = (await month()).absences_by_parents;
    const lesson = await nextLesson(thursday);
    const byParent = await lee.rpc("report_absence", { p_occurrence: lesson, p_child: kids.ava });
    expect(byParent.error).toBeNull();
    const byOwner = await owner.rpc("report_absence", { p_occurrence: lesson, p_child: kids.ben });
    expect(byOwner.error).toBeNull();
    expect((await month()).absences_by_parents).toBe(before + 1);
  });

  it("counts fees paid online, and overdue fees paid after a reminder", async () => {
    const before = await month();
    await admin.from("payment_accounts").insert({
      organisation_id: orgId,
      stripe_account_id: `acct_m8${run}`,
      charges_enabled: true,
    });
    await admin.from("online_payments").insert({
      organisation_id: orgId,
      family_id: leeFamily,
      amount_cents: 12000,
      platform_fee_cents: 60,
      status: "paid",
      stripe_account_id: `acct_m8${run}`,
      paid_at: new Date().toISOString(),
    });
    // Ruiz was reminded yesterday, then paid at the desk today.
    await admin.from("email_deliveries").insert({
      kind: "fee_reminder",
      recipient_user_id: leeId,
      organisation_id: orgId,
      status: "sent",
      sent_at: new Date(Date.now() - 86_400_000).toISOString(),
      payload: { family_id: ruizFamily, stage: "overdue", due_on: "2026-01-01" },
    });
    const paid = await owner.rpc("record_payment", {
      p_family: ruizFamily,
      p_amount_cents: 8000,
      p_method: "cash",
      p_paid_on: new Date().toISOString().slice(0, 10),
    });
    expect(paid.error).toBeNull();
    // A payment with no reminder before it isn't "chased".
    await owner.rpc("record_payment", {
      p_family: leeFamily,
      p_amount_cents: 500,
      p_method: "cash",
      p_paid_on: new Date().toISOString().slice(0, 10),
    });
    const after = await month();
    expect(after.paid_online_count).toBe(before.paid_online_count + 1);
    expect(after.paid_online_cents).toBe(before.paid_online_cents + 12000);
    expect(after.reminders_sent).toBe(before.reminders_sent + 1);
    expect(after.chased_paid_families).toBe(before.chased_paid_families + 1);
    expect(after.chased_paid_cents).toBe(before.chased_paid_cents + 8000);
  });

  it("an earlier month has its own figures", async () => {
    const { data } = await owner.rpc("ovyko_month", { p_org: orgId, p_month: "2020-01-01" });
    expect(data![0]).toMatchObject({ absences_by_parents: 0, paid_online_cents: 0 });
  });
});

const wish = (c: Client, child: string, overrides: Record<string, unknown> = {}) =>
  c.rpc("add_place_wish", {
    p_child: child,
    p_level: level2,
    p_location: null as unknown as string,
    p_weekdays: [2],
    p_earliest: "16:30",
    p_latest: "16:30",
    p_note: "",
    ...overrides,
  });

describe("M8b: what families want", () => {
  const wishes = { ava: "", ben: "", cy: "" };

  it("parents ask for their own children only", async () => {
    const other = await wish(lee, kids.cy);
    expect(other.error?.code).toBe("42501");
    const owners = await wish(owner, kids.ava);
    expect(owners.error?.code).toBe("42501");
    const noDays = await wish(lee, kids.ava, { p_weekdays: [] });
    expect(noDays.error?.hint).toBe("wish_invalid");
    const backwards = await wish(lee, kids.ava, { p_earliest: "17:00", p_latest: "16:00" });
    expect(backwards.error?.hint).toBe("wish_invalid");
    const foreign = await wish(lee, kids.ava, { p_level: "00000000-0000-0000-0000-000000000001" });
    expect(foreign.error?.hint).toBe("wish_invalid");

    for (const [c, k] of [
      [lee, "ava"],
      [lee, "ben"],
      [ruiz, "cy"],
    ] as const) {
      const { data, error } = await wish(c, kids[k], {
        p_note: k === "ava" ? "  After school  " : "",
      });
      expect(error).toBeNull();
      wishes[k] = data!;
    }
  });

  it("families see their own requests; the owner sees all; instructors none", async () => {
    const mine = await lee.from("place_wishes").select("id, note").order("created_at");
    expect(mine.data!.map((w) => w.id).sort()).toEqual([wishes.ava, wishes.ben].sort());
    expect(mine.data!.find((w) => w.id === wishes.ava)!.note).toBe("After school");
    const theirs = await ruiz.from("place_wishes").select("id");
    expect(theirs.data!.map((w) => w.id)).toEqual([wishes.cy]);
    const all = await owner.from("place_wishes").select("id").eq("organisation_id", orgId);
    expect(all.data).toHaveLength(3);
    const none = await teacher.from("place_wishes").select("id");
    expect(none.data ?? []).toEqual([]);
    const direct = await lee.from("place_wishes").insert({
      organisation_id: orgId,
      family_id: leeFamily,
      child_id: kids.ava,
      weekdays: [1],
      earliest: "16:00",
      latest: "17:00",
    });
    expect(direct.error?.code).toBe("42501");
  });

  it("3 children wanting a time with no room is a new class opportunity", async () => {
    for (const c of [teacher, lee]) {
      expect((await c.rpc("class_opportunities", { p_org: orgId })).error?.code).toBe("42501");
    }
    const { data } = await owner.rpc("class_opportunities", { p_org: orgId });
    expect(data).toEqual([
      {
        level_id: level2,
        level_name: "Level 2",
        location_id: locId,
        location_name: "Riverside",
        weekday: 2,
        start_time: "16:30:00",
        children: 3,
      },
    ]);
    const higher = await owner.rpc("class_opportunities", { p_org: orgId, p_min: 4 });
    expect(higher.data).toEqual([]);
    // No places match: the Tuesday class is full.
    const matches = await owner.rpc("wish_matches", { p_org: orgId });
    expect(matches.data).toEqual([]);
  });

  it("once the class has room, it's a place that matches, not an opportunity", async () => {
    await owner.from("classes").update({ capacity: 2 }).eq("id", tuesday);
    const { data: opps } = await owner.rpc("class_opportunities", { p_org: orgId });
    expect(opps).toEqual([]);
    const { data: matches } = await owner.rpc("wish_matches", { p_org: orgId });
    expect(matches!.map((m) => m.wish_id).sort()).toEqual(
      [wishes.ava, wishes.ben, wishes.cy].sort(),
    );
    expect(matches![0]).toMatchObject({ class_id: tuesday, spare: 1, weekday: 2 });
  });

  it("the owner enrols a child from a request; the family is emailed; a full class refuses", async () => {
    const byParent = await lee.rpc("place_from_wish", { p_wish: wishes.ava, p_class: tuesday });
    expect(byParent.error?.code).toBe("42501");
    const placed = await owner.rpc("place_from_wish", { p_wish: wishes.ava, p_class: tuesday });
    expect(placed.error).toBeNull();
    const { data: w } = await lee
      .from("place_wishes")
      .select("status, placed_enrolment_id")
      .eq("id", wishes.ava)
      .single();
    expect(w).toEqual({ status: "placed", placed_enrolment_id: placed.data });
    const { data: mail } = await admin
      .from("email_deliveries")
      .select("kind, recipient_user_id")
      .eq("organisation_id", orgId)
      .eq("kind", "place_confirmed");
    expect(mail).toEqual([{ kind: "place_confirmed", recipient_user_id: leeId }]);
    const again = await owner.rpc("place_from_wish", { p_wish: wishes.ava, p_class: tuesday });
    expect(again.error?.hint).toBe("wish_closed");
    const full = await owner.rpc("place_from_wish", { p_wish: wishes.cy, p_class: tuesday });
    expect(full.error?.hint).toBe("class_full");
    const { data: still } = await ruiz
      .from("place_wishes")
      .select("status")
      .eq("id", wishes.cy)
      .single();
    expect(still!.status).toBe("open");
  });

  it("enrolling a child by hand in that level closes their request too", async () => {
    await owner.from("classes").update({ capacity: 3 }).eq("id", tuesday);
    const { error } = await owner
      .from("enrolments")
      .insert({ organisation_id: orgId, child_id: kids.ben, class_id: tuesday });
    expect(error).toBeNull();
    const { data } = await lee.from("place_wishes").select("status").eq("id", wishes.ben).single();
    expect(data!.status).toBe("placed");
  });

  it("a family withdraws its own request, not another's", async () => {
    const wrong = await lee.rpc("withdraw_place_wish", { p_wish: wishes.cy });
    expect(wrong.error?.code).toBe("42501");
    const right = await ruiz.rpc("withdraw_place_wish", { p_wish: wishes.cy });
    expect(right.error).toBeNull();
    const { data } = await ruiz.from("place_wishes").select("status").eq("id", wishes.cy).single();
    expect(data!.status).toBe("withdrawn");
  });
});
