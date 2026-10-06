import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { anonymous, PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M8d acceptance (security and rules): docs/M8_NETWORK.md. One school's
// waiting-list page for new families. Runs in a school of its own, removed
// at the end.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `wlpage-${run}-password`;
const slug = `wlpage-test-${run}`;
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
  owner: `wlpage.owner.${run}@example.test`,
  teacher: `wlpage.teacher.${run}@example.test`,
  parent: `wlpage.parent.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let teacher: Client;
let parent: Client;
let levelId: string;
let locationId: string;
const visitor = anonymous();

const enquiry = (extra: Record<string, unknown> = {}) => ({
  p_slug: slug,
  p_parent_name: "Nina New",
  p_email: "Nina.New@Example.test",
  p_phone: "0400 000 111",
  p_child_first_name: "Ollie",
  p_child_last_name: "New",
  p_date_of_birth: "2020-04-04",
  p_level: levelId,
  p_location: null as unknown as string,
  p_weekdays: [2, 4],
  p_earliest: "15:30",
  p_latest: "17:00",
  p_note: "After school",
  p_consent: true,
  ...extra,
});

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Waitlist Page Swim",
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
  locationId = loc!.id;
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
  levelId = level!.id;
  // A family already at the school, whose parent has joined Ovyko.
  const { data: fam } = await admin
    .from("families")
    .insert({
      organisation_id: orgId,
      display_name: "Parent Family",
      primary_contact_email: emails.parent,
    })
    .select("id")
    .single();
  await admin.from("family_members").insert({
    family_id: fam!.id,
    user_id: parentId,
    relationship: "parent",
    is_primary_guardian: true,
  });
  owner = await signIn(emails.owner);
  teacher = await signIn(emails.teacher);
  parent = await signIn(emails.parent);
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", slug);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const enquiries = async () =>
  (
    await owner
      .from("waitlist_enquiries")
      .select("id, email")
      .eq("organisation_id", orgId)
      .order("created_at")
  ).data!;

describe("the page", () => {
  it("shows nothing and takes nothing while it's off", async () => {
    expect((await visitor.rpc("waitlist_page", { p_slug: slug })).data).toBeNull();
    const { error } = await visitor.rpc("join_school_waitlist", enquiry());
    expect(error?.hint).toBe("join_closed");
  });

  it("only owners turn it on; then it shows the school's levels and locations", async () => {
    expect((await teacher.rpc("set_waitlist_page", { p_org: orgId, p_on: true })).error?.code).toBe(
      "42501",
    );
    expect((await owner.rpc("set_waitlist_page", { p_org: orgId, p_on: true })).error).toBeNull();
    const { data } = await visitor.rpc("waitlist_page", { p_slug: slug });
    expect(data).toEqual({
      school: "Waitlist Page Swim",
      levels: [{ id: levelId, name: "Level 1", program: "Learn to swim" }],
      locations: [{ id: locationId, name: "Riverside" }],
    });
  });

  it("anyone can send an enquiry; bad ones are refused", async () => {
    expect((await visitor.rpc("join_school_waitlist", enquiry())).error).toBeNull();
    for (const bad of [
      { p_consent: false },
      { p_weekdays: [] },
      { p_date_of_birth: "2099-01-01" },
      { p_earliest: "18:00", p_latest: "16:00" },
      { p_level: "00000000-0000-0000-0000-000000000001" },
      { p_email: "not-an-email" },
    ]) {
      const { error } = await visitor.rpc("join_school_waitlist", enquiry(bad));
      expect(error?.hint).toBe("join_invalid");
    }
    const mine = await enquiries();
    expect(mine).toEqual([{ id: expect.any(String), email: "nina.new@example.test" }]);
  });

  it("an email can have at most 3 open enquiries at a school", async () => {
    await visitor.rpc("join_school_waitlist", enquiry({ p_child_first_name: "Pip" }));
    await visitor.rpc("join_school_waitlist", enquiry({ p_child_first_name: "Quinn" }));
    const fourth = await visitor.rpc(
      "join_school_waitlist",
      enquiry({ p_child_first_name: "Rae" }),
    );
    expect(fourth.error?.hint).toBe("join_invalid");
    expect(await enquiries()).toHaveLength(3);
  });
});

describe("who sees enquiries", () => {
  it("only the school's owners", async () => {
    expect((await visitor.from("waitlist_enquiries").select("id")).data ?? []).toEqual([]);
    for (const c of [teacher, parent, (await signInAs("peakOwner")).client]) {
      expect((await c.from("waitlist_enquiries").select("id")).data).toEqual([]);
    }
    const direct = await owner.from("waitlist_enquiries").insert({
      organisation_id: orgId,
      parent_name: "Sneaky",
      email: "s@example.test",
      child_first_name: "S",
      child_last_name: "S",
      date_of_birth: "2020-01-01",
      weekdays: [1],
      earliest: "16:00",
      latest: "16:00",
    });
    expect(direct.error?.code).toBe("42501");
  });
});

describe("adding and removing", () => {
  it("adding makes the family, child and request, and the enquiry goes", async () => {
    const [first] = await enquiries();
    expect((await teacher.rpc("add_waitlist_enquiry", { p_enquiry: first!.id })).error?.code).toBe(
      "42501",
    );
    const { data, error } = await owner.rpc("add_waitlist_enquiry", { p_enquiry: first!.id });
    expect(error).toBeNull();
    const added = data as { family_id: string; email: string; joined: boolean };
    expect(added).toMatchObject({ email: "nina.new@example.test", joined: false });
    const { data: family } = await owner
      .from("families")
      .select("display_name, primary_contact_name, primary_contact_email, primary_contact_phone")
      .eq("id", added.family_id)
      .single();
    expect(family).toEqual({
      display_name: "New Family",
      primary_contact_name: "Nina New",
      primary_contact_email: "nina.new@example.test",
      primary_contact_phone: "0400 000 111",
    });
    const { data: wishes } = await owner
      .from("place_wishes")
      .select("weekdays, earliest, latest, level_id, note, status, children (first_name)")
      .eq("family_id", added.family_id);
    expect(wishes).toEqual([
      {
        weekdays: [2, 4],
        earliest: "15:30:00",
        latest: "17:00:00",
        level_id: levelId,
        note: "After school",
        status: "open",
        children: { first_name: "Ollie" },
      },
    ]);
    expect(await enquiries()).toHaveLength(2);
    const { data: audit } = await owner
      .from("audit_events")
      .select("after_json")
      .eq("entity_type", "waitlist_enquiries")
      .eq("entity_id", first!.id);
    expect(audit).toEqual([{ after_json: { added_to_family: added.family_id } }]);
  });

  it("a second child from the same email joins the same family", async () => {
    const [next] = await enquiries();
    const { data } = await owner.rpc("add_waitlist_enquiry", { p_enquiry: next!.id });
    const { count } = await owner
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("family_id", (data as { family_id: string }).family_id);
    expect(count).toBe(2);
  });

  it("a family already in Ovyko doesn't need inviting", async () => {
    await visitor.rpc("join_school_waitlist", enquiry({ p_email: emails.parent }));
    const row = (await enquiries()).find((e) => e.email === emails.parent)!;
    const { data } = await owner.rpc("add_waitlist_enquiry", { p_enquiry: row.id });
    expect(data).toMatchObject({ joined: true });
  });

  it("removing deletes the enquiry; only owners can", async () => {
    const [last] = await enquiries();
    expect(
      (await teacher.rpc("remove_waitlist_enquiry", { p_enquiry: last!.id })).error?.code,
    ).toBe("42501");
    expect((await owner.rpc("remove_waitlist_enquiry", { p_enquiry: last!.id })).error).toBeNull();
    expect(await enquiries()).toEqual([]);
  });
});
