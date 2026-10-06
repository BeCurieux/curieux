import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M8c acceptance (security and rules): docs/M8_NETWORK.md. Free places
// offered to waiting families. Runs in a school of its own, removed at the
// end.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `offers-${run}-password`;
const slug = `offers-test-${run}`;
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
  owner: `offers.owner.${run}@example.test`,
  teacher: `offers.teacher.${run}@example.test`,
  lee: `offers.lee.${run}@example.test`,
  ruiz: `offers.ruiz.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let teacher: Client;
let lee: Client;
let ruiz: Client;
let leeId: string;
let tuesday: string;
let deeEnrolment: string;
const kids = { ava: "", cy: "", dee: "", kit: "" };
const wishes = { ava: "", cy: "", kit: "" };

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Offers Test Swim",
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
  const { data: program } = await admin
    .from("programs")
    .insert({ organisation_id: orgId, name: "Learn to swim" })
    .select("id")
    .single();
  const { data: level } = await admin
    .from("levels")
    .insert({ organisation_id: orgId, program_id: program!.id, name: "Level 2", sort_order: 2 })
    .select("id")
    .single();
  const { data: klass } = await admin
    .from("classes")
    .insert({
      organisation_id: orgId,
      location_id: loc!.id,
      program_id: program!.id,
      level_id: level!.id,
      name: "Level 2 Tue",
      weekday: 2,
      start_time: "16:30",
      duration_minutes: 30,
      capacity: 1,
    })
    .select("id")
    .single();
  tuesday = klass!.id;

  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Offers Lee ${run}` },
      { organisation_id: orgId, display_name: `Offers Ruiz ${run}` },
      // Imported, no parent has joined yet.
      { organisation_id: orgId, display_name: `Offers Kim ${run}` },
    ])
    .select("id, display_name");
  const fam = (name: string) => fams!.find((f) => f.display_name.includes(name))!.id;
  await admin.from("family_members").insert([
    { family_id: fam("Lee"), user_id: leeId, relationship: "parent", is_primary_guardian: true },
    { family_id: fam("Ruiz"), user_id: ruizId, relationship: "parent", is_primary_guardian: true },
  ]);
  const child = (family: string, first: string) => ({
    organisation_id: orgId,
    family_id: fam(family),
    first_name: first,
    last_name: "Offer",
    date_of_birth: "2019-03-01",
  });
  const { data: children } = await admin
    .from("children")
    .insert([child("Lee", "Ava"), child("Ruiz", "Cy"), child("Ruiz", "Dee"), child("Kim", "Kit")])
    .select("id, first_name");
  for (const c of children!) kids[c.first_name.toLowerCase() as keyof typeof kids] = c.id;
  // Dee has the Tuesday class's only place.
  const { data: enrolment } = await admin
    .from("enrolments")
    .insert({ organisation_id: orgId, child_id: kids.dee, class_id: tuesday })
    .select("id")
    .single();
  deeEnrolment = enrolment!.id;

  owner = await signIn(emails.owner);
  teacher = await signIn(emails.teacher);
  lee = await signIn(emails.lee);
  ruiz = await signIn(emails.ruiz);

  // Ava asked first, then Cy; Kit's family asked at the desk.
  const ask = (c: Client, child: string) =>
    c.rpc("add_place_wish", {
      p_child: child,
      p_level: level!.id,
      p_location: null as unknown as string,
      p_weekdays: [2],
      p_earliest: "16:00",
      p_latest: "17:00",
      p_note: "",
    });
  wishes.ava = (await ask(lee, kids.ava)).data!;
  wishes.cy = (await ask(ruiz, kids.cy)).data!;
  const { data: kit } = await admin
    .from("place_wishes")
    .insert({
      organisation_id: orgId,
      family_id: fam("Kim"),
      child_id: kids.kit,
      level_id: level!.id,
      weekdays: [2],
      earliest: "16:00",
      latest: "17:00",
    })
    .select("id")
    .single();
  wishes.kit = kit!.id;
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", slug);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const offerOf = async (wish: string) =>
  (
    await admin
      .from("place_offers")
      .select("id, status, offered_by, enrolment_id")
      .eq("wish_id", wish)
      .order("created_at", { ascending: false })
      .limit(1)
  ).data?.[0];

describe("offering a place", () => {
  it("nothing can be offered while the class is full", async () => {
    const { error } = await owner.rpc("offer_place", { p_wish: wishes.ava, p_class: tuesday });
    expect(error?.hint).toBe("class_full");
  });

  it("the owner offers a free place; only that family sees it, and is emailed", async () => {
    await admin.from("enrolments").update({ status: "ended" }).eq("id", deeEnrolment);
    const { data, error } = await owner.rpc("offer_place", {
      p_wish: wishes.ava,
      p_class: tuesday,
    });
    expect(error).toBeNull();
    const mine = await lee.rpc("my_place_offers");
    expect(mine.data).toEqual([
      expect.objectContaining({
        offer_id: data,
        child_first_name: "Ava",
        class_name: "Level 2 Tue",
        level_name: "Level 2",
        location_name: "Riverside",
        weekday: 2,
        start_time: "16:30:00",
      }),
    ]);
    expect((await ruiz.rpc("my_place_offers")).data).toEqual([]);
    expect((await ruiz.from("place_offers").select("id")).data).toEqual([]);
    expect((await teacher.from("place_offers").select("id")).data).toEqual([]);
    const { data: emailsQueued } = await admin
      .from("email_deliveries")
      .select("recipient_user_id")
      .eq("kind", "place_offered")
      .eq("payload->>offer_id", data!);
    expect(emailsQueued).toEqual([{ recipient_user_id: leeId }]);
  });

  it("the held place can't be taken by anyone else", async () => {
    const byHand = await owner
      .from("enrolments")
      .insert({ organisation_id: orgId, child_id: kids.cy, class_id: tuesday });
    expect(byHand.error?.message).toBe("This class is full.");
    const matches = await owner.rpc("wish_matches", { p_org: orgId });
    expect(matches.data).toEqual([]);
    const second = await owner.rpc("offer_place", { p_wish: wishes.cy, p_class: tuesday });
    expect(second.error?.hint).toBe("class_full");
  });

  it("only the family can answer it", async () => {
    const offer = (await offerOf(wishes.ava))!;
    for (const c of [ruiz, owner, teacher]) {
      const { error } = await c.rpc("answer_place_offer", { p_offer: offer.id, p_accept: true });
      expect(error?.code).toBe("42501");
    }
  });

  it("no thanks keeps the request open; with the switch off, nothing more is offered", async () => {
    const offer = (await offerOf(wishes.ava))!;
    const { error } = await lee.rpc("answer_place_offer", { p_offer: offer.id, p_accept: false });
    expect(error).toBeNull();
    expect((await offerOf(wishes.ava))!.status).toBe("declined");
    const { data: wish } = await lee
      .from("place_wishes")
      .select("status")
      .eq("id", wishes.ava)
      .single();
    expect(wish!.status).toBe("open");
    expect(await offerOf(wishes.cy)).toBeUndefined();
  });

  it("with the switch on, the next family in line is offered it, never the same class twice", async () => {
    expect(
      (await teacher.rpc("set_auto_place_offers", { p_org: orgId, p_on: true })).error?.code,
    ).toBe("42501");
    expect(
      (await owner.rpc("set_auto_place_offers", { p_org: orgId, p_on: true })).error,
    ).toBeNull();
    const cy = (await offerOf(wishes.cy))!;
    expect(cy).toMatchObject({ status: "offered", offered_by: null });
    // Ava said no to this class; Kit's family hasn't joined Ovyko.
    expect((await offerOf(wishes.ava))!.status).toBe("declined");
    expect(await offerOf(wishes.kit)).toBeUndefined();
    const { data: audit } = await owner
      .from("audit_events")
      .select("after_json")
      .eq("entity_id", orgId)
      .eq("entity_type", "organisations");
    expect(audit!.map((a) => a.after_json)).toContainEqual({ auto_place_offers: true });
  });

  it("accepting enrols the child and closes their request", async () => {
    const offer = (await offerOf(wishes.cy))!;
    const { data: enrolment, error } = await ruiz.rpc("answer_place_offer", {
      p_offer: offer.id,
      p_accept: true,
    });
    expect(error).toBeNull();
    const { data: placed } = await ruiz
      .from("enrolments")
      .select("child_id, class_id, status")
      .eq("id", enrolment!)
      .single();
    expect(placed).toEqual({ child_id: kids.cy, class_id: tuesday, status: "active" });
    expect((await offerOf(wishes.cy))!).toMatchObject({
      status: "accepted",
      enrolment_id: enrolment,
    });
    const { data: wish } = await ruiz
      .from("place_wishes")
      .select("status")
      .eq("id", wishes.cy)
      .single();
    expect(wish!.status).toBe("placed");
    const again = await ruiz.rpc("answer_place_offer", { p_offer: offer.id, p_accept: true });
    expect(again.error?.hint).toBe("offer_closed");
  });

  it("an offer that lapses frees the place, and accepting it then does nothing", async () => {
    await admin.from("classes").update({ capacity: 2 }).eq("id", tuesday);
    const { data: id } = await owner.rpc("offer_place", { p_wish: wishes.ava, p_class: tuesday });
    await admin
      .from("place_offers")
      .update({ created_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-03T00:00:00Z" })
      .eq("id", id!);
    const { data, error } = await lee.rpc("answer_place_offer", { p_offer: id!, p_accept: true });
    expect(error).toBeNull();
    expect(data).toBeNull();
    const { data: lapsed } = await admin
      .from("place_offers")
      .select("status")
      .eq("id", id!)
      .single();
    expect(lapsed!.status).toBe("expired");
    const { count } = await admin
      .from("enrolments")
      .select("id", { count: "exact", head: true })
      .eq("child_id", kids.ava);
    expect(count).toBe(0);
  });

  it("the owner can withdraw an offer; the family can't answer it then", async () => {
    const { data: id } = await owner.rpc("offer_place", { p_wish: wishes.ava, p_class: tuesday });
    expect((await lee.rpc("withdraw_place_offer", { p_offer: id! })).error?.code).toBe("42501");
    expect((await owner.rpc("withdraw_place_offer", { p_offer: id! })).error).toBeNull();
    const answer = await lee.rpc("answer_place_offer", { p_offer: id!, p_accept: true });
    expect(answer.error?.hint).toBe("offer_closed");
  });

  it("a family who hasn't joined can't be offered a place", async () => {
    const { error } = await owner.rpc("offer_place", { p_wish: wishes.kit, p_class: tuesday });
    expect(error?.hint).toBe("offer_invalid");
  });

  it("withdrawing a request takes its open offer with it", async () => {
    const { data: id } = await owner.rpc("offer_place", { p_wish: wishes.ava, p_class: tuesday });
    expect((await lee.rpc("withdraw_place_wish", { p_wish: wishes.ava })).error).toBeNull();
    const { data: offer } = await admin
      .from("place_offers")
      .select("status")
      .eq("id", id!)
      .single();
    expect(offer!.status).toBe("withdrawn");
  });

  it("nobody writes offers directly", async () => {
    const { error } = await owner.from("place_offers").insert({
      organisation_id: orgId,
      wish_id: wishes.kit,
      family_id: kids.kit,
      child_id: kids.kit,
      class_id: tuesday,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error?.code).toBe("42501");
  });
});

describe("other schools", () => {
  it("see nothing and can't offer", async () => {
    const peak = await signInAs("peakOwner");
    expect((await peak.client.from("place_offers").select("id")).data).toEqual([]);
    const { error } = await peak.client.rpc("offer_place", {
      p_wish: wishes.kit,
      p_class: tuesday,
    });
    expect(error?.code).toBe("42501");
  });
});
