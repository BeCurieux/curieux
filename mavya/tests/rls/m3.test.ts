import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { CHILDREN, CLASSES, LEVELS, ORGS, SKILLS, USERS } from "../../scripts/fixtures";
import { signInAs, type Session } from "./helpers";

// M3 acceptance (security): docs/M3_ATTENDANCE_PROGRESS.md. Every check runs
// as a real signed-in user through the public API. Writes use children the
// end-to-end demo path doesn't depend on, and put things back where a rerun
// needs them.

let aquaOwner: Session;
let aquaInstructor: Session;
let aquaCasual: Session;
let peakOwner: Session;
let peakInstructor: Session;
let burrows: Session;
let chen: Session;

// The lesson each class had most recently, and its next one.
let wedLesson: string;
let wedNextLesson: string;
let gymLesson: string;

async function lessons(classId: string) {
  const { data, error } = await aquaOwner.client
    .from("class_occurrences")
    .select("id, starts_at")
    .eq("class_id", classId)
    .order("starts_at");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  [aquaOwner, aquaInstructor, aquaCasual, peakOwner, peakInstructor, burrows, chen] =
    await Promise.all([
      signInAs("aquaOwner"),
      signInAs("aquaInstructor"),
      signInAs("aquaCasual"),
      signInAs("peakOwner"),
      signInAs("peakInstructor"),
      signInAs("burrowsParent"),
      signInAs("chenParent"),
    ]);
  const now = Date.now();
  const wed = await lessons(CLASSES.dolphin3Wed.id);
  wedLesson = wed.filter((l) => Date.parse(l.starts_at) < now).at(-1)!.id;
  wedNextLesson = wed.find((l) => Date.parse(l.starts_at) > now + 2 * 60 * 60 * 1000)!.id;
  const { data: gym } = await peakOwner.client
    .from("class_occurrences")
    .select("id, starts_at")
    .eq("class_id", CLASSES.gymLevel2Sat.id)
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();
  gymLesson = gym!.id;
});

const attend = (s: Session, occurrence: string, child: string, status = "present") =>
  s.client.rpc("record_attendance", {
    p_occurrence_id: occurrence,
    p_child_id: child,
    p_status: status,
  });

const assess = (s: Session, child: string, skill: string, status: string) =>
  s.client.rpc("record_progress", { p_child_id: child, p_skill_id: skill, p_status: status });

describe("attendance", () => {
  it("the class's instructor marks a child in it, and the change is audited", async () => {
    expect(
      (await attend(aquaInstructor, wedLesson, CHILDREN.oliver.id, "absent")).error,
    ).toBeNull();
    expect(
      (await attend(aquaInstructor, wedLesson, CHILDREN.oliver.id, "present")).error,
    ).toBeNull();
    const { data } = await aquaInstructor.client
      .from("attendance")
      .select("status")
      .eq("occurrence_id", wedLesson)
      .eq("child_id", CHILDREN.oliver.id)
      .single();
    expect(data!.status).toBe("present");

    const { data: audit } = await aquaOwner.client
      .from("audit_events")
      .select("entity_type, after_json, users (email)")
      .eq("entity_type", "attendance")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect((audit!.users as { email: string } | null)?.email).toBe(USERS.aquaInstructor.email);
  });

  it("is refused for a child not in the class", async () => {
    const { error } = await attend(aquaInstructor, wedLesson, CHILDREN.leo.id);
    expect(error?.hint).toBe("not_in_class");
  });

  it("is refused for a lesson that hasn't opened", async () => {
    const { error } = await attend(aquaInstructor, wedNextLesson, CHILDREN.oliver.id);
    expect(error?.hint).toBe("lesson_not_open");
  });

  it("is refused to staff who don't teach the class, and across organisations", async () => {
    expect((await attend(aquaCasual, wedLesson, CHILDREN.oliver.id)).error?.code).toBe("42501");
    expect((await attend(peakInstructor, wedLesson, CHILDREN.oliver.id)).error?.code).toBe("42501");
    expect((await attend(peakOwner, wedLesson, CHILDREN.oliver.id)).error?.code).toBe("42501");
    expect((await attend(aquaInstructor, gymLesson, CHILDREN.mei.id)).error?.code).toBe("42501");
  });

  it("is refused to parents, even for their own child", async () => {
    expect((await attend(burrows, wedLesson, CHILDREN.ava.id)).error?.code).toBe("42501");
  });

  it("the owner can mark too", async () => {
    expect((await attend(peakOwner, gymLesson, CHILDREN.mei.id)).error).toBeNull();
  });

  it("is read only by the owner, the class's instructor and the child's family", async () => {
    const seen = async (s: Session) =>
      (
        await s.client
          .from("attendance")
          .select("child_id")
          .eq("occurrence_id", wedLesson)
          .eq("child_id", CHILDREN.oliver.id)
      ).data ?? [];
    expect(await seen(aquaOwner)).toHaveLength(1);
    expect(await seen(aquaInstructor)).toHaveLength(1);
    expect(await seen(aquaCasual)).toHaveLength(0);
    expect(await seen(peakOwner)).toHaveLength(0);
    expect(await seen(burrows)).toHaveLength(0);
    // Chen sees Mei's, and nothing of Aqua House's.
    const { data: chens } = await chen.client.from("attendance").select("child_id");
    expect(new Set((chens ?? []).map((r) => r.child_id))).toEqual(new Set([CHILDREN.mei.id]));
  });
});

describe("progress", () => {
  it("parents read only their own children's progress and levels' skills", async () => {
    const { data: progress } = await burrows.client.from("progress_records").select("child_id");
    expect(new Set(progress!.map((r) => r.child_id))).toEqual(
      new Set([CHILDREN.ava.id, CHILDREN.leo.id]),
    );
    const { data: skills } = await burrows.client.from("skills").select("level_id");
    expect(new Set(skills!.map((r) => r.level_id))).toEqual(
      new Set([LEVELS.dolphin3.id, LEVELS.dolphin1.id]),
    );
    const { data: chens } = await chen.client.from("progress_records").select("child_id");
    expect(new Set(chens!.map((r) => r.child_id))).toEqual(new Set([CHILDREN.mei.id]));
  });

  it("an instructor assesses children they teach, at that class's level only", async () => {
    expect(
      (await assess(aquaInstructor, CHILDREN.oliver.id, SKILLS.breathing.id, "developing")).error,
    ).toBeNull();
    // Oliver swims Dolphin 3, so a Dolphin 1 skill isn't his to assess.
    expect(
      (await assess(aquaInstructor, CHILDREN.oliver.id, SKILLS.bubbles.id, "achieved")).error?.code,
    ).toBe("42501");
  });

  it("is refused to other staff, other organisations and parents", async () => {
    for (const s of [aquaCasual, peakInstructor, peakOwner, burrows]) {
      const { error } = await assess(s, CHILDREN.oliver.id, SKILLS.breathing.id, "achieved");
      expect(error?.code).toBe("42501");
    }
    // A Peak skill can't be attached to an Aqua House child, even by Peak's owner.
    expect(
      (await assess(peakOwner, CHILDREN.oliver.id, SKILLS.cartwheel.id, "achieved")).error?.code,
    ).toBe("42501");
  });

  it("nothing is written to the tables directly", async () => {
    const attendance = await aquaOwner.client.from("attendance").insert({
      organisation_id: ORGS.aqua.id,
      occurrence_id: wedLesson,
      child_id: CHILDREN.zoe.id,
      status: "present",
    });
    expect(attendance.error?.code).toBe("42501");
    const progress = await aquaOwner.client.from("progress_records").insert({
      organisation_id: ORGS.aqua.id,
      child_id: CHILDREN.zoe.id,
      skill_id: SKILLS.floating.id,
      status: "achieved",
    });
    expect(progress.error?.code).toBe("42501");
    const notification = await burrows.client.from("notifications").insert({
      recipient_user_id: randomUUID(),
      type: "skill_achieved",
    });
    expect(notification.error?.code).toBe("42501");
  });
});

describe("skills", () => {
  it("owners add their own organisation's skills; nobody else can", async () => {
    const name = `Test skill ${randomUUID().slice(0, 8)}`;
    const add = (s: Session, org: string) =>
      s.client.from("skills").insert({ organisation_id: org, level_id: LEVELS.dolphin2.id, name });
    expect((await add(aquaInstructor, ORGS.aqua.id)).error?.code).toBe("42501");
    expect((await add(peakOwner, ORGS.aqua.id)).error?.code).toBe("42501");
    // Peak's owner can't hang a skill off Aqua House's level from their own org either.
    expect((await add(peakOwner, ORGS.peak.id)).error).not.toBeNull();
    const { error } = await add(aquaOwner, ORGS.aqua.id);
    expect(error).toBeNull();
    const { data: peakSees } = await peakOwner.client.from("skills").select("id").eq("name", name);
    expect(peakSees).toEqual([]);
  });
});

describe("achievement notifications", () => {
  it("tell the child's family, and only them, without names in the stored payload", async () => {
    // Leo's Supported float, back to the start so this can run again.
    expect(
      (await assess(aquaInstructor, CHILDREN.leo.id, SKILLS.supportedFloat.id, "not_started"))
        .error,
    ).toBeNull();
    const before = await burrows.client.from("notifications").select("id");
    expect(
      (await assess(aquaInstructor, CHILDREN.leo.id, SKILLS.supportedFloat.id, "achieved")).error,
    ).toBeNull();
    // Saving achieved again is not a second achievement.
    expect(
      (await assess(aquaInstructor, CHILDREN.leo.id, SKILLS.supportedFloat.id, "achieved")).error,
    ).toBeNull();

    const { data: after } = await burrows.client
      .from("notifications")
      .select("id, payload_json, read_at")
      .order("created_at", { ascending: false });
    expect(after!.length).toBe(before.data!.length + 1);
    const latest = after![0]!;
    expect(latest.payload_json).toEqual({
      child_id: CHILDREN.leo.id,
      skill_id: SKILLS.supportedFloat.id,
    });
    expect(latest.read_at).toBeNull();

    for (const s of [chen, aquaOwner, aquaInstructor]) {
      const { data } = await s.client.from("notifications").select("id").eq("id", latest.id);
      expect(data).toEqual([]);
    }

    // Marking seen touches only the caller's own.
    expect((await chen.client.rpc("mark_notifications_read")).error).toBeNull();
    const { data: stillNew } = await burrows.client
      .from("notifications")
      .select("read_at")
      .eq("id", latest.id)
      .single();
    expect(stillNew!.read_at).toBeNull();
    expect((await burrows.client.rpc("mark_notifications_read")).error).toBeNull();
    const { count } = await burrows.client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    expect(count).toBe(0);
  });
});
