import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { CHILDREN, CLASSES, ORGS, USERS } from "../../scripts/fixtures";
import { signInAs, SUPABASE_URL, type Session } from "./helpers";

// M6c acceptance (security and rules): docs/M6_MIGRATION_PILOT.md. The
// outbox is the server's alone, so its own checks use the secret key, as the
// app's sender does; everything a person might try goes through their own
// session. What the tests queue they remove.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let aquaOwner: Session;
let burrows: Session;
let martin: Session;
let burrowsId: string;
let martinId: string;
let wednesdayAt7: string;
let absenceMadeHere: string | null = null;
const madeHere: string[] = [];

async function userId(email: string) {
  const { data } = await admin.from("users").select("id").eq("email", email).single();
  return data!.id;
}

async function claim() {
  const { data, error } = await admin.rpc("claim_email_deliveries", { p_limit: 200 });
  if (error) throw error;
  return data!.filter((d) => madeHere.includes(d.id));
}

beforeAll(async () => {
  [aquaOwner, burrows, martin] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("burrowsParent"),
    signInAs("martinParent"),
  ]);
  burrowsId = await userId(USERS.burrowsParent.email);
  martinId = await userId(USERS.martinParent.email);
  // 7:05am Sydney on the day of Dolphin 3 Wednesday's next lesson: Ava's
  // class (Burrows), with Zoe (Martin) reported away from it. The seed
  // reports her away from one lesson, but other tests may take that back,
  // so this makes sure of it for the lesson used here.
  const { data } = await admin
    .from("class_occurrences")
    .select("id, starts_at")
    .eq("class_id", CLASSES.dolphin3Wed.id)
    .eq("status", "scheduled")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(1)
    .single();
  const { data: away } = await admin
    .from("absences")
    .select("id")
    .eq("occurrence_id", data!.id)
    .eq("child_id", CHILDREN.zoe.id)
    .maybeSingle();
  if (!away) {
    const { data: made, error } = await admin
      .from("absences")
      .insert({
        organisation_id: ORGS.aqua.id,
        child_id: CHILDREN.zoe.id,
        occurrence_id: data!.id,
        make_up_eligible: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    absenceMadeHere = made.id;
  }
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(
    new Date(data!.starts_at),
  );
  const offset = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(data!.starts_at))
    .find((p) => p.type === "timeZoneName")!
    .value.replace("GMT", "");
  wednesdayAt7 = new Date(`${day}T07:05:00${offset}`).toISOString();
});

afterAll(async () => {
  if (madeHere.length) await admin.from("email_deliveries").delete().in("id", madeHere);
  if (absenceMadeHere) await admin.from("absences").delete().eq("id", absenceMadeHere);
  await burrows.client.rpc("set_lesson_reminders", { p_on: true });
});

describe("the outbox", () => {
  it("gets an email for every notification", async () => {
    const { data: n, error } = await admin
      .from("notifications")
      .insert({
        recipient_user_id: burrowsId,
        organisation_id: ORGS.aqua.id,
        type: "skill_achieved",
        payload_json: { child_id: CHILDREN.ava.id },
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data: d } = await admin
      .from("email_deliveries")
      .select("id, kind, recipient_user_id, status, payload")
      .eq("notification_id", n!.id)
      .single();
    madeHere.push(d!.id);
    expect(d).toMatchObject({
      kind: "skill_achieved",
      recipient_user_id: burrowsId,
      status: "pending",
      payload: {},
    });
  });

  it("hands each email to the sender once", async () => {
    const first = await claim();
    expect(first.map((d) => d.status)).toEqual(["sending"]);
    expect(await claim()).toEqual([]);
    const { error } = await admin.rpc("finish_email_delivery", {
      p_id: first[0]!.id,
      p_outcome: "sent",
      p_provider_id: "test-1",
    });
    expect(error).toBeNull();
    expect(await claim()).toEqual([]);
    const { data } = await admin
      .from("email_deliveries")
      .select("status, sent_at, provider_id")
      .eq("id", first[0]!.id)
      .single();
    expect(data).toMatchObject({ status: "sent", provider_id: "test-1" });
    expect(data!.sent_at).not.toBeNull();
  });

  it("tries a failed email again later, then gives up after 5 attempts", async () => {
    const { data: d } = await admin
      .from("email_deliveries")
      .insert({ kind: "skill_achieved", recipient_user_id: burrowsId })
      .select("id")
      .single();
    madeHere.push(d!.id);
    for (let attempt = 1; attempt <= 5; attempt++) {
      await admin
        .from("email_deliveries")
        .update({ next_attempt_at: new Date().toISOString() })
        .eq("id", d!.id);
      const [taken] = await claim();
      expect(taken!.attempts).toBe(attempt);
      await admin.rpc("finish_email_delivery", { p_id: d!.id, p_outcome: "failed", p_error: "x" });
    }
    const { data } = await admin
      .from("email_deliveries")
      .select("status, attempts")
      .eq("id", d!.id)
      .single();
    expect(data).toEqual({ status: "failed", attempts: 5 });
  });

  it("skips an email more than a day late instead of sending it", async () => {
    const { data: d } = await admin
      .from("email_deliveries")
      .insert({
        kind: "skill_achieved",
        recipient_user_id: burrowsId,
        created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    madeHere.push(d!.id);
    expect(await claim()).toEqual([]);
    const { data } = await admin.from("email_deliveries").select("status").eq("id", d!.id).single();
    expect(data!.status).toBe("skipped");
  });

  it("is the server's alone", async () => {
    for (const s of [aquaOwner, burrows]) {
      const read = await s.client.from("email_deliveries").select("id");
      expect(read.error?.code).toBe("42501");
      expect((await s.client.rpc("claim_email_deliveries", { p_limit: 1 })).error?.code).toBe(
        "42501",
      );
      expect(
        (await s.client.rpc("queue_lesson_reminders_at", { p_now: wednesdayAt7 })).error?.code,
      ).toBe("42501");
    }
  });
});

describe("lesson-day reminders", () => {
  async function queue() {
    const { data, error } = await admin.rpc("queue_lesson_reminders_at", { p_now: wednesdayAt7 });
    if (error) throw error;
    const { data: rows } = await admin
      .from("email_deliveries")
      .select("id, recipient_user_id, payload")
      .eq("kind", "lesson_reminder")
      .like("dedupe_key", `%:${ORGS.aqua.id}:%`);
    for (const r of rows ?? []) if (!madeHere.includes(r.id)) madeHere.push(r.id);
    return { queued: data!, rows: rows ?? [] };
  }

  it("go to parents with a lesson that day, once, leaving out a child reported away", async () => {
    const { rows } = await queue();
    const ava = rows.find((r) => r.recipient_user_id === burrowsId);
    expect(ava?.payload).toMatchObject({
      lessons: [{ child_id: CHILDREN.ava.id }],
    });
    expect(rows.find((r) => r.recipient_user_id === martinId)).toBeUndefined();
    expect((await queue()).queued).toBe(0);
  });

  it("aren't queued for someone who turned them off", async () => {
    await admin.from("email_deliveries").delete().in("id", madeHere);
    madeHere.length = 0;
    expect((await burrows.client.rpc("set_lesson_reminders", { p_on: false })).error).toBeNull();
    const { rows } = await queue();
    expect(rows.find((r) => r.recipient_user_id === burrowsId)).toBeUndefined();
    const { data } = await burrows.client.from("users").select("lesson_reminders").single();
    expect(data!.lesson_reminders).toBe(false);
  });

  it("can only be switched for yourself", async () => {
    // set_lesson_reminders takes no person: it only ever changes the caller.
    expect((await martin.client.rpc("set_lesson_reminders", { p_on: false })).error).toBeNull();
    const { data } = await admin
      .from("users")
      .select("lesson_reminders")
      .eq("id", burrowsId)
      .single();
    expect(data!.lesson_reminders).toBe(false);
    await martin.client.rpc("set_lesson_reminders", { p_on: true });
    const { data: claire } = await admin
      .from("users")
      .select("lesson_reminders")
      .eq("id", martinId)
      .single();
    expect(claire!.lesson_reminders).toBe(true);
  });
});
