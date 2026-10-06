import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M6e acceptance (security and rules): docs/M6_MIGRATION_PILOT.md. The
// secret key only sets up a school of the tests' own, runs the term-start
// job at a chosen moment and tidies away; everything a person might try
// goes through their own session.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `terms-${run}-password`;
const createdAuthIds: string[] = [];
const tz = "Australia/Sydney";

// Dates as the school sees them (YYYY-MM-DD).
const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
  owner: `terms.owner.${run}@example.test`,
  lee: `terms.lee.${run}@example.test`,
  ruiz: `terms.ruiz.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let lee: Client;
let ruiz: Client;
let leeUserId: string;
let ruizUserId: string;
const classes: Record<"a" | "b" | "c" | "d", string> = { a: "", b: "", c: "", d: "" };
const kids: Record<"ava" | "ben" | "cy", string> = { ava: "", ben: "", cy: "" };
let ruizFamily: string;

// Term 1 is under way; term 2 starts in 30 days, after a 9-day break.
const term1 = { starts: addDays(today, -30), ends: addDays(today, 20) };
const term2 = { starts: addDays(today, 30), ends: addDays(today, 100) };
let term1Id: string;
let term2Id: string;

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Term Test Swim",
      slug: `term-test-${run}`,
      activity_type: "swimming",
      owner_two_step_required: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;

  const ownerId = await newAccount(emails.owner, "Olive Owner");
  leeUserId = await newAccount(emails.lee, "Lena Lee");
  ruizUserId = await newAccount(emails.ruiz, "Rafa Ruiz");
  await admin
    .from("staff_memberships")
    .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });

  const { data: loc } = await admin
    .from("locations")
    .insert({ organisation_id: orgId, name: "Term Pool" })
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
  };
  const { data: made, error: classError } = await admin
    .from("classes")
    .insert([
      { ...base, name: "Dolphin 3", weekday: 1, capacity: 3 },
      { ...base, name: "Dolphin 3 Wed", weekday: 3, capacity: 2 },
      { ...base, name: "Dolphin 4", weekday: 5, capacity: 1 },
      { ...base, name: "Dolphin 4 Sat", weekday: 6, capacity: 1 },
    ])
    .select("id, name");
  if (classError) throw classError;
  const byName = (n: string) => made!.find((c) => c.name === n)!.id;
  classes.a = byName("Dolphin 3");
  classes.b = byName("Dolphin 3 Wed");
  classes.c = byName("Dolphin 4");
  classes.d = byName("Dolphin 4 Sat");

  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Term Test Lee ${run}` },
      { organisation_id: orgId, display_name: `Term Test Ruiz ${run}` },
    ])
    .select("id, display_name");
  const leeFamily = fams!.find((f) => f.display_name.includes("Lee"))!.id;
  ruizFamily = fams!.find((f) => f.display_name.includes("Ruiz"))!.id;
  await admin.from("family_members").insert([
    { family_id: leeFamily, user_id: leeUserId, relationship: "parent", is_primary_guardian: true },
    {
      family_id: ruizFamily,
      user_id: ruizUserId,
      relationship: "parent",
      is_primary_guardian: true,
    },
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

  const { error: enrolError } = await admin.from("enrolments").insert([
    { organisation_id: orgId, child_id: kids.ava, class_id: classes.a },
    { organisation_id: orgId, child_id: kids.ben, class_id: classes.a },
    { organisation_id: orgId, child_id: kids.cy, class_id: classes.b },
  ]);
  if (enrolError) throw enrolError;

  owner = await signIn(emails.owner);
  lee = await signIn(emails.lee);
  ruiz = await signIn(emails.ruiz);
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", `term-test-${run}`);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

async function askFor(child: string) {
  const { data } = await admin
    .from("reenrolment_asks")
    .select("id, answer, outcome, offered_class_id")
    .eq("term_id", term2Id)
    .eq("child_id", child)
    .single();
  return data!;
}

describe("terms", () => {
  it("an owner adds the school's terms", async () => {
    const one = await owner.rpc("save_term", {
      p_org: orgId,
      p_name: "Term 1",
      p_starts_on: term1.starts,
      p_ends_on: term1.ends,
    });
    expect(one.error).toBeNull();
    term1Id = one.data!;
    const two = await owner.rpc("save_term", {
      p_org: orgId,
      p_name: "Term 2",
      p_starts_on: term2.starts,
      p_ends_on: term2.ends,
    });
    expect(two.error).toBeNull();
    term2Id = two.data!;
  });

  it("refuses overlapping or back-to-front terms", async () => {
    const overlap = await owner.rpc("save_term", {
      p_org: orgId,
      p_name: "Overlap",
      p_starts_on: addDays(term1.ends, -2),
      p_ends_on: addDays(term1.ends, 5),
    });
    expect(overlap.error?.hint).toBe("term_overlap");
    const backwards = await owner.rpc("save_term", {
      p_org: orgId,
      p_term: term1Id,
      p_name: "Term 1",
      p_starts_on: term1.ends,
      p_ends_on: term1.starts,
    });
    expect(backwards.error?.hint).toBe("term_invalid");
  });

  it("only the school's owners change terms", async () => {
    for (const [who, c] of [
      ["parent", lee],
      ["another school's owner", (await signInAs("peakOwner")).client],
      ["another school's instructor", (await signInAs("aquaInstructor")).client],
    ] as const) {
      const add = await c.rpc("save_term", {
        p_org: orgId,
        p_name: "Sneaky",
        p_starts_on: addDays(today, 200),
        p_ends_on: addDays(today, 210),
      });
      expect(add.error?.code, who).toBe("42501");
      expect((await c.rpc("delete_term", { p_term: term2Id })).error?.code, who).toBe("42501");
      const on = await c.rpc("set_lessons_in_term_only", { p_org: orgId, p_on: true });
      expect(on.error?.code, who).toBe("42501");
    }
  });
});

describe("lessons in term only", () => {
  const upcoming = async (classId: string) => {
    const { data } = await admin
      .from("class_occurrences")
      .select("starts_at")
      .eq("class_id", classId)
      .eq("status", "scheduled")
      .gt("starts_at", new Date().toISOString());
    return data!.map((o) => localDate(new Date(o.starts_at)));
  };
  const inTerm = (day: string) =>
    (day >= term1.starts && day <= term1.ends) || (day >= term2.starts && day <= term2.ends);

  it("all year by default, so the break has lessons", async () => {
    expect((await upcoming(classes.a)).some((d) => !inTerm(d))).toBe(true);
  });

  it("when the school chooses term only, lessons are only inside terms", async () => {
    const { error } = await owner.rpc("set_lessons_in_term_only", { p_org: orgId, p_on: true });
    expect(error).toBeNull();
    const days = await upcoming(classes.a);
    expect(days.length).toBeGreaterThan(0);
    expect(days.filter((d) => !inTerm(d))).toEqual([]);

    const { data: audit } = await admin
      .from("audit_events")
      .select("after_json")
      .eq("organisation_id", orgId)
      .eq("entity_type", "organisations");
    expect(audit).toContainEqual({ after_json: { lessons_in_term_only: true } });
  });

  it("turning it off puts the break's lessons back", async () => {
    await owner.rpc("set_lessons_in_term_only", { p_org: orgId, p_on: false });
    expect((await upcoming(classes.a)).some((d) => !inTerm(d))).toBe(true);
    await owner.rpc("set_lessons_in_term_only", { p_org: orgId, p_on: true });
  });
});

describe("asking families about next term", () => {
  it("getting ready shows families nothing yet", async () => {
    const { data, error } = await owner.rpc("prepare_term_asks", { p_term: term2Id });
    expect(error).toBeNull();
    expect(data).toBe(3);
    expect((await lee.rpc("my_term_asks")).data).toEqual([]);
  });

  it("an owner offers a move up, holding the place", async () => {
    const ava = await askFor(kids.ava);
    expect(
      (await owner.rpc("offer_term_move", { p_ask: ava.id, p_class: classes.c })).error,
    ).toBeNull();
    // Dolphin 4 has one place, now held for Ava.
    const ben = await askFor(kids.ben);
    const full = await owner.rpc("offer_term_move", { p_ask: ben.id, p_class: classes.c });
    expect(full.error?.hint).toBe("class_full");
    const same = await owner.rpc("offer_term_move", { p_ask: ben.id, p_class: classes.a });
    expect(same.error?.hint).toBe("move_invalid");
    const cy = await askFor(kids.cy);
    expect(
      (await owner.rpc("offer_term_move", { p_ask: cy.id, p_class: classes.d })).error,
    ).toBeNull();
    expect(
      (await lee.rpc("offer_term_move", { p_ask: ben.id, p_class: classes.d })).error?.code,
    ).toBe("42501");
  });

  it("asks families once the reply-by date makes sense, and emails each parent", async () => {
    const late = await owner.rpc("ask_families", { p_term: term2Id, p_reply_by: term2.starts });
    expect(late.error?.hint).toBe("reply_by_invalid");
    const { data, error } = await owner.rpc("ask_families", {
      p_term: term2Id,
      p_reply_by: addDays(term1.ends, -7),
    });
    expect(error).toBeNull();
    expect(data).toBe(2);
    const { data: queued } = await admin
      .from("email_deliveries")
      .select("recipient_user_id, payload")
      .eq("organisation_id", orgId)
      .eq("kind", "reenrolment_ask");
    expect(queued!.map((q) => q.recipient_user_id).sort()).toEqual([leeUserId, ruizUserId].sort());
    // Ids only in the email's payload, never names.
    expect(queued![0]!.payload).toEqual({ term_id: term2Id });
  });

  it("each parent sees only their own children's questions", async () => {
    const { data: mine } = await lee.rpc("my_term_asks");
    expect(mine!.map((a) => a.child_first_name).sort()).toEqual(["Ava", "Ben"]);
    const ava = mine!.find((a) => a.child_first_name === "Ava")!;
    expect(ava).toMatchObject({
      term_name: "Term 2",
      class_name: "Dolphin 3",
      offered_class_name: "Dolphin 4",
      answer: null,
    });
    expect((await ruiz.rpc("my_term_asks")).data!.map((a) => a.child_first_name)).toEqual(["Cy"]);
    const { data: seen } = await ruiz.from("reenrolment_asks").select("child_id");
    expect(seen).toEqual([{ child_id: kids.cy }]);
    const other = await signInAs("martinParent");
    expect((await other.client.from("reenrolment_asks").select("id")).data).toEqual([]);
    expect(
      (await other.client.from("terms").select("id").eq("organisation_id", orgId)).data,
    ).toEqual([]);
    expect((await other.client.rpc("my_term_asks")).data).toEqual([]);
  });

  it("parents answer for their own children only", async () => {
    const cy = await askFor(kids.cy);
    expect(
      (await lee.rpc("answer_term_ask", { p_ask: cy.id, p_answer: "leave" })).error?.code,
    ).toBe("42501");
    const ben = await askFor(kids.ben);
    const noOffer = await lee.rpc("answer_term_ask", { p_ask: ben.id, p_answer: "move" });
    expect(noOffer.error?.hint).toBe("answer_invalid");
    const ava = await askFor(kids.ava);
    expect(
      (await lee.rpc("answer_term_ask", { p_ask: ava.id, p_answer: "move" })).error,
    ).toBeNull();
    // The owner records Ben's answer, given at the pool.
    expect(
      (await owner.rpc("answer_term_ask", { p_ask: ben.id, p_answer: "leave" })).error,
    ).toBeNull();
  });

  it("the owner sees each class's answers and places next term", async () => {
    const { data, error } = await owner.rpc("term_summary", { p_term: term2Id });
    expect(error).toBeNull();
    const row = (id: string) => data!.find((r) => r.class_id === id)!;
    expect(row(classes.a)).toMatchObject({
      moving_out: 1,
      leaving: 1,
      waiting: 0,
      free_next_term: 3,
    });
    expect(row(classes.b)).toMatchObject({ waiting: 1, free_next_term: 1 });
    expect(row(classes.c)).toMatchObject({ moving_in: 1, free_next_term: 0 });
    expect((await lee.rpc("term_summary", { p_term: term2Id })).error?.code).toBe("42501");
  });

  it("reminds only families who haven't answered", async () => {
    const { data } = await owner.rpc("remind_term_families", { p_term: term2Id });
    expect(data).toBe(1);
    const { data: queued } = await admin
      .from("email_deliveries")
      .select("recipient_user_id")
      .eq("organisation_id", orgId)
      .eq("kind", "reenrolment_reminder");
    expect(queued).toEqual([{ recipient_user_id: ruizUserId }]);
  });

  it("asks, answers and offers are audited", async () => {
    const { data } = await admin
      .from("audit_events")
      .select("action")
      .eq("organisation_id", orgId)
      .eq("entity_type", "reenrolment_asks");
    expect(data!.filter((e) => e.action === "update").length).toBeGreaterThanOrEqual(4);
  });
});

describe("the new term's first day", () => {
  it("applies the answers; a move that no longer fits keeps the old place", async () => {
    const cy = await askFor(kids.cy);
    expect(
      (await ruiz.rpc("answer_term_ask", { p_ask: cy.id, p_answer: "move" })).error,
    ).toBeNull();
    // Since, the owner filled Cy's new class by hand.
    const { data: dee } = await admin
      .from("children")
      .insert({
        organisation_id: orgId,
        family_id: ruizFamily,
        first_name: "Dee",
        last_name: "Test",
        date_of_birth: "2018-01-01",
      })
      .select("id")
      .single();
    await admin
      .from("enrolments")
      .insert({ organisation_id: orgId, child_id: dee!.id, class_id: classes.d });

    // Not yet: the day before the term.
    const before = await admin.rpc("apply_terms_at", {
      p_now: `${addDays(term2.starts, -1)}T12:00:00+10:00`,
    });
    expect(before.error).toBeNull();
    expect((await askFor(kids.ava)).outcome).toBeNull();

    const { error } = await admin.rpc("apply_terms_at", {
      p_now: `${term2.starts}T01:00:00+10:00`,
    });
    expect(error).toBeNull();

    const places = async (child: string) => {
      const { data } = await admin
        .from("enrolments")
        .select("class_id, status, ends_at")
        .eq("child_id", child)
        .order("starts_at");
      return data!;
    };
    expect(await places(kids.ava)).toEqual([
      { class_id: classes.a, status: "ended", ends_at: addDays(term2.starts, -1) },
      { class_id: classes.c, status: "active", ends_at: null },
    ]);
    expect(await places(kids.ben)).toEqual([
      { class_id: classes.a, status: "ended", ends_at: addDays(term2.starts, -1) },
    ]);
    expect(await places(kids.cy)).toEqual([
      { class_id: classes.b, status: "active", ends_at: null },
    ]);
    expect((await askFor(kids.ava)).outcome).toBe("moved");
    expect((await askFor(kids.ben)).outcome).toBe("left");
    expect((await askFor(kids.cy)).outcome).toBe("move_failed");
  });

  it("answers are final once the term has started", async () => {
    const ben = await askFor(kids.ben);
    const late = await lee.rpc("answer_term_ask", { p_ask: ben.id, p_answer: "stay" });
    expect(late.error?.hint).toBe("term_started");
    const again = await owner.rpc("ask_families", {
      p_term: term2Id,
      p_reply_by: addDays(today, 1),
    });
    expect(again.error?.hint).toBe("term_started");
  });

  it("a term families were asked about can't be moved or removed", async () => {
    const moved = await owner.rpc("save_term", {
      p_org: orgId,
      p_term: term2Id,
      p_name: "Term 2",
      p_starts_on: addDays(term2.starts, 1),
      p_ends_on: term2.ends,
    });
    expect(moved.error?.hint).toBe("term_locked");
    expect((await owner.rpc("delete_term", { p_term: term2Id })).error?.hint).toBe("term_locked");
  });
});
