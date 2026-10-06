import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M8e acceptance (security and rules): docs/M8_NETWORK.md. Families who
// might leave, from the school's own records. Runs in a school of its own,
// removed at the end.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `retention-${run}-password`;
const slug = `retention-test-${run}`;
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
  owner: `retention.owner.${run}@example.test`,
  teacher: `retention.teacher.${run}@example.test`,
  parent: `retention.parent.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let teacher: Client;
let parent: Client;
const fam: Record<string, string> = {};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Retention Test Swim",
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
  const parentId = await newAccount(emails.parent, "Pia Parent");
  await admin.from("staff_memberships").insert([
    { user_id: ownerId, organisation_id: orgId, role: "owner" },
    { user_id: teacherId, organisation_id: orgId, role: "instructor" },
  ]);
  const { data: loc } = await admin
    .from("locations")
    .insert({ organisation_id: orgId, name: "Riverside" })
    .select("id")
    .single();
  const { data: program } = await admin
    .from("programs")
    .insert({ organisation_id: orgId, name: "Learn to swim" })
    .select("id")
    .single();
  const { data: level } = await admin
    .from("levels")
    .insert({ organisation_id: orgId, program_id: program!.id, name: "Level 1", sort_order: 1 })
    .select("id")
    .single();
  const { data: klass } = await admin
    .from("classes")
    .insert({
      organisation_id: orgId,
      location_id: loc!.id,
      program_id: program!.id,
      level_id: level!.id,
      name: "Level 1 Mon",
      weekday: 1,
      start_time: "16:00",
      duration_minutes: 30,
      capacity: 10,
    })
    .select("id")
    .single();

  // Six families: one per warning sign, and one with none.
  const names = ["Absent", "Lapsed", "Leaving", "Paused", "Owing", "Fine"];
  const { data: fams } = await admin
    .from("families")
    .insert(
      names.map((n) => ({
        organisation_id: orgId,
        display_name: `${n} Family`,
        primary_contact_name: `${n} Parent`,
        primary_contact_phone: "0400 000 000",
        primary_contact_email: `${n.toLowerCase()}.${run}@example.test`,
      })),
    )
    .select("id, display_name");
  for (const f of fams!) fam[f.display_name.split(" ")[0]!] = f.id;
  await admin.from("family_members").insert({
    family_id: fam.Fine!,
    user_id: parentId,
    relationship: "parent",
    is_primary_guardian: true,
  });
  const { data: kids } = await admin
    .from("children")
    .insert(
      names.map((n) => ({
        organisation_id: orgId,
        family_id: fam[n]!,
        first_name: `${n}kid`,
        last_name: "Test",
        date_of_birth: "2019-01-01",
      })),
    )
    .select("id, first_name");
  const kid = (n: string) => kids!.find((k) => k.first_name === `${n}kid`)!.id;
  const { data: enrolments } = await admin
    .from("enrolments")
    .insert(names.map((n) => ({ organisation_id: orgId, child_id: kid(n), class_id: klass!.id })))
    .select("id, child_id");
  await admin.from("enrolments").update({ status: "paused" }).eq("child_id", kid("Paused"));

  // Three lessons in the last 6 weeks the Absent child missed (one a
  // fortnight before that doesn't count), and one the Fine child missed.
  const lessons = await admin
    .from("class_occurrences")
    .insert(
      [7, 14, 21, 60].map((n) => ({
        organisation_id: orgId,
        class_id: klass!.id,
        starts_at: daysAgo(n).toISOString(),
        ends_at: new Date(daysAgo(n).getTime() + 30 * 60_000).toISOString(),
        status: "completed",
      })),
    )
    .select("id, starts_at");
  const byAge = lessons.data!.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  await admin
    .from("absences")
    .insert(
      byAge
        .slice(0, 2)
        .map((o) => ({ organisation_id: orgId, child_id: kid("Absent"), occurrence_id: o.id })),
    );
  await admin.from("attendance").insert([
    {
      organisation_id: orgId,
      occurrence_id: byAge[2]!.id,
      child_id: kid("Absent"),
      status: "absent",
    },
    {
      organisation_id: orgId,
      occurrence_id: byAge[3]!.id,
      child_id: kid("Absent"),
      status: "absent",
    },
    {
      organisation_id: orgId,
      occurrence_id: byAge[0]!.id,
      child_id: kid("Fine"),
      status: "absent",
    },
  ]);

  // Two make-up credits that ran out unused.
  await admin.from("makeup_credits").insert(
    [5, 10].map((n) => ({
      organisation_id: orgId,
      child_id: kid("Lapsed"),
      reason: "absence",
      issued_at: daysAgo(n + 60).toISOString(),
      expires_at: daysAgo(n).toISOString(),
      status: "expired",
    })),
  );

  // "Not next term".
  const { data: term } = await admin
    .from("terms")
    .insert({
      organisation_id: orgId,
      name: "Next Term",
      starts_on: isoDay(new Date(Date.now() + 40 * 86_400_000)),
      ends_on: isoDay(new Date(Date.now() + 100 * 86_400_000)),
    })
    .select("id")
    .single();
  const leaving = enrolments!.find((e) => e.child_id === kid("Leaving"))!;
  await admin.from("reenrolment_asks").insert({
    organisation_id: orgId,
    term_id: term!.id,
    enrolment_id: leaving.id,
    child_id: kid("Leaving"),
    class_id: klass!.id,
    answer: "leave",
    answered_at: new Date().toISOString(),
  });

  // $180 due a month ago, and $50 due last week (not yet 2 weeks overdue).
  await admin.from("ledger_entries").insert([
    {
      organisation_id: orgId,
      family_id: fam.Owing!,
      kind: "charge",
      amount_cents: 18000,
      description: "Term fee",
      due_on: isoDay(daysAgo(30)),
    },
    {
      organisation_id: orgId,
      family_id: fam.Fine!,
      kind: "charge",
      amount_cents: 5000,
      description: "Term fee",
      due_on: isoDay(daysAgo(7)),
    },
  ]);

  owner = await signIn(emails.owner);
  teacher = await signIn(emails.teacher);
  parent = await signIn(emails.parent);
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", slug);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const list = async () => {
  const { data, error } = await owner.rpc("families_at_risk", { p_org: orgId });
  if (error) throw error;
  return data!;
};

describe("families who might leave", () => {
  it("lists each family with a warning sign, with its reasons, and not the others", async () => {
    const rows = await list();
    const by = Object.fromEntries(rows.map((r) => [r.family_name, r.reasons]));
    expect(Object.keys(by).sort()).toEqual(
      ["Absent Family", "Lapsed Family", "Leaving Family", "Owing Family", "Paused Family"].sort(),
    );
    expect(by["Absent Family"]).toEqual([{ kind: "absences", child: "Absentkid", count: 3 }]);
    expect(by["Lapsed Family"]).toEqual([
      { kind: "credits_expired", child: "Lapsedkid", count: 2 },
    ]);
    expect(by["Leaving Family"]).toEqual([
      { kind: "leaving", child: "Leavingkid", term: "Next Term" },
    ]);
    expect(by["Paused Family"]).toEqual([
      { kind: "paused", child: "Pausedkid", class: "Level 1 Mon" },
    ]);
    expect(by["Owing Family"]).toEqual([{ kind: "overdue", cents: 18000 }]);
    // Leaving next term is the strongest sign: first.
    expect(rows[0]!.family_name).toBe("Leaving Family");
    expect(rows[0]).toMatchObject({ phone: "0400 000 000", contact_name: "Leaving Parent" });
  });

  it("following up takes a family off the list for 30 days, and is recorded", async () => {
    const { error } = await owner.rpc("follow_up_family", {
      p_family: fam.Absent!,
      p_note: "Called, had a cold",
    });
    expect(error).toBeNull();
    expect((await list()).map((r) => r.family_name)).not.toContain("Absent Family");
    const { data: notes } = await owner
      .from("retention_followups")
      .select("note")
      .eq("family_id", fam.Absent!);
    expect(notes).toEqual([{ note: "Called, had a cold" }]);
    // A month later, still missing lessons: back on the list.
    await admin
      .from("retention_followups")
      .update({ created_at: daysAgo(31).toISOString() })
      .eq("family_id", fam.Absent!);
    expect((await list()).map((r) => r.family_name)).toContain("Absent Family");
  });

  it("only the school's owners see it or follow up", async () => {
    const peak = (await signInAs("peakOwner")).client;
    for (const c of [teacher, parent, peak]) {
      expect((await c.rpc("families_at_risk", { p_org: orgId })).error?.code).toBe("42501");
      expect((await c.rpc("follow_up_family", { p_family: fam.Owing! })).error?.code).toBe("42501");
      expect((await c.from("retention_followups").select("id")).data).toEqual([]);
    }
    const tooLong = await owner.rpc("follow_up_family", {
      p_family: fam.Owing!,
      p_note: "x".repeat(201),
    });
    expect(tooLong.error?.hint).toBe("followup_invalid");
  });
});
