import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CHILDREN,
  CLASSES,
  FAMILIES,
  LEVELS,
  LOCATIONS,
  ORGS,
  PROGRAMS,
  USERS,
} from "../../scripts/fixtures";
import { signInAs, type Session } from "./helpers";

// M2 acceptance (security): docs/M2_CLASSES.md. Every check runs as a real
// signed-in user through the public API.
//
// Tests that create rows use fresh names each run and assert on those rows,
// so they pass on a database that earlier runs have already written to.

let aquaOwner: Session;
let aquaInstructor: Session;
let peakOwner: Session;
let burrows: Session;
let chen: Session;

beforeAll(async () => {
  [aquaOwner, aquaInstructor, peakOwner, burrows, chen] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
    signInAs("burrowsParent"),
    signInAs("chenParent"),
  ]);
});

const orgsOf = (rows: { organisation_id: string | null }[] | null) =>
  new Set((rows ?? []).map((r) => r.organisation_id));

// An Aqua House class with no instructor, and a new family and child
// enrolled in it, created by the owner.
async function untaughtClassWithChild() {
  const tag = randomUUID().slice(0, 8);
  const { data: klass, error: classError } = await aquaOwner.client
    .from("classes")
    .insert({
      organisation_id: ORGS.aqua.id,
      location_id: LOCATIONS.monaVale.id,
      program_id: PROGRAMS.learnToSwim.id,
      level_id: LEVELS.dolphin2.id,
      name: `Dolphin 2 ${tag}`,
      weekday: 5,
      start_time: "15:00",
      duration_minutes: 30,
      capacity: 1,
    })
    .select("id")
    .single();
  if (classError) throw classError;
  const { data: family } = await aquaOwner.client
    .from("families")
    .insert({ organisation_id: ORGS.aqua.id, display_name: `Test ${tag} Family` })
    .select("id")
    .single();
  const { data: child } = await aquaOwner.client
    .from("children")
    .insert({
      organisation_id: ORGS.aqua.id,
      family_id: family!.id,
      first_name: `Kid${tag}`,
      last_name: "Test",
      date_of_birth: "2019-01-01",
    })
    .select("id")
    .single();
  return { classId: klass!.id, familyId: family!.id, childId: child!.id, tag };
}

async function newChild(tag: string) {
  const { data: family } = await aquaOwner.client
    .from("families")
    .insert({ organisation_id: ORGS.aqua.id, display_name: `Extra ${tag} Family` })
    .select("id")
    .single();
  const { data: child } = await aquaOwner.client
    .from("children")
    .insert({
      organisation_id: ORGS.aqua.id,
      family_id: family!.id,
      first_name: `Extra${tag}`,
      last_name: "Test",
      date_of_birth: "2019-01-01",
    })
    .select("id")
    .single();
  return child!.id;
}

describe("owners work only inside their own organisation", () => {
  it("read only their own timetable", async () => {
    for (const table of [
      "locations",
      "programs",
      "levels",
      "classes",
      "class_occurrences",
      "enrolments",
    ] as const) {
      const { data, error } = await aquaOwner.client.from(table).select("organisation_id");
      expect(error, table).toBeNull();
      expect(orgsOf(data), table).toEqual(new Set([ORGS.aqua.id]));
    }
  });

  it("can set up their own organisation", async () => {
    const tag = randomUUID().slice(0, 8);
    const location = await aquaOwner.client
      .from("locations")
      .insert({ organisation_id: ORGS.aqua.id, name: `Pool ${tag}` })
      .select("id")
      .single();
    const program = await aquaOwner.client
      .from("programs")
      .insert({ organisation_id: ORGS.aqua.id, name: `Squad ${tag}` })
      .select("id")
      .single();
    const level = await aquaOwner.client
      .from("levels")
      .insert({
        organisation_id: ORGS.aqua.id,
        program_id: program.data!.id,
        name: "Bronze",
        sort_order: 1,
      })
      .select("id")
      .single();
    expect([location.error, program.error, level.error]).toEqual([null, null, null]);
  });

  it("can't write into another organisation", async () => {
    const tag = randomUUID().slice(0, 8);
    const location = await aquaOwner.client
      .from("locations")
      .insert({ organisation_id: ORGS.peak.id, name: `Sneaky ${tag}` });
    const family = await aquaOwner.client
      .from("families")
      .insert({ organisation_id: ORGS.peak.id, display_name: `Sneaky ${tag}` });
    const update = await aquaOwner.client
      .from("classes")
      .update({ capacity: 1 })
      .eq("id", CLASSES.gymLevel2Sat.id)
      .select("id");
    expect(location.error?.code).toBe("42501");
    expect(family.error?.code).toBe("42501");
    expect(update.data).toEqual([]);
  });

  it("can't point a class at another organisation's location", async () => {
    const { error } = await aquaOwner.client.from("classes").insert({
      organisation_id: ORGS.aqua.id,
      location_id: LOCATIONS.narrabeen.id,
      program_id: PROGRAMS.learnToSwim.id,
      level_id: LEVELS.dolphin1.id,
      name: "Cross-tenant",
      weekday: 1,
      start_time: "10:00",
      duration_minutes: 30,
      capacity: 5,
    });
    expect(error?.code).toBe("23503");
  });

  it("can't give a class another organisation's instructor", async () => {
    const { error } = await aquaOwner.client.from("classes").insert({
      organisation_id: ORGS.aqua.id,
      location_id: LOCATIONS.monaVale.id,
      program_id: PROGRAMS.learnToSwim.id,
      level_id: LEVELS.dolphin1.id,
      instructor_id: USERS.peakInstructor.staff.membershipId,
      name: "Borrowed instructor",
      weekday: 1,
      start_time: "10:00",
      duration_minutes: 30,
      capacity: 5,
    });
    expect(error?.code).toBe("23503");
  });

  it("can't enrol another organisation's child", async () => {
    const asAqua = await aquaOwner.client.from("enrolments").insert({
      organisation_id: ORGS.aqua.id,
      child_id: CHILDREN.mei.id,
      class_id: CLASSES.dolphin3Wed.id,
    });
    const asPeak = await aquaOwner.client.from("enrolments").insert({
      organisation_id: ORGS.peak.id,
      child_id: CHILDREN.mei.id,
      class_id: CLASSES.dolphin3Wed.id,
    });
    expect(asAqua.error?.code).toBe("23503");
    expect(asPeak.error?.code).toBe("42501");
  });

  it("see their own audit trail, with themselves as the actor", async () => {
    const { familyId } = await untaughtClassWithChild();
    const { data: me } = await aquaOwner.client
      .from("users")
      .select("id")
      .eq("email", USERS.aquaOwner.email)
      .single();
    const { data } = await aquaOwner.client
      .from("audit_events")
      .select("action, entity_type, actor_user_id")
      .eq("entity_id", familyId);
    expect(data).toEqual([{ action: "insert", entity_type: "families", actor_user_id: me!.id }]);

    const other = await peakOwner.client.from("audit_events").select("organisation_id");
    expect(orgsOf(other.data).has(ORGS.aqua.id)).toBe(false);
  });

  it("can cancel a lesson but not move it", async () => {
    const { data: lesson } = await aquaOwner.client
      .from("class_occurrences")
      .select("id")
      .eq("class_id", CLASSES.dolphin3Thu.id)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();
    const cancel = await aquaOwner.client
      .from("class_occurrences")
      .update({ status: "cancelled" })
      .eq("id", lesson!.id);
    const move = await aquaOwner.client
      .from("class_occurrences")
      .update({ starts_at: new Date().toISOString() })
      .eq("id", lesson!.id);
    expect(cancel.error).toBeNull();
    expect(move.error?.code).toBe("42501");
    await aquaOwner.client
      .from("class_occurrences")
      .update({ status: "scheduled" })
      .eq("id", lesson!.id);
  });
});

describe("instructors see only the children they teach", () => {
  it("see their organisation's timetable", async () => {
    const { data } = await aquaInstructor.client.from("classes").select("organisation_id");
    expect(orgsOf(data)).toEqual(new Set([ORGS.aqua.id]));
  });

  it("see the children in their classes, but not one in a class they don't teach", async () => {
    const { childId, familyId } = await untaughtClassWithChild();
    const { classId } = await untaughtClassWithChild();
    await aquaOwner.client
      .from("enrolments")
      .insert({ organisation_id: ORGS.aqua.id, child_id: childId, class_id: classId });

    const children = await aquaInstructor.client.from("children").select("id");
    const visible = (children.data ?? []).map((c) => c.id);
    expect(visible).toContain(CHILDREN.ava.id);
    expect(visible).not.toContain(childId);
    expect(visible).not.toContain(CHILDREN.mei.id);

    const family = await aquaInstructor.client.from("families").select("id").eq("id", familyId);
    const enrolments = await aquaInstructor.client
      .from("enrolments")
      .select("id")
      .eq("child_id", childId);
    expect(family.data).toEqual([]);
    expect(enrolments.data).toEqual([]);
  });

  it("can't write anything", async () => {
    const { error } = await aquaInstructor.client.from("locations").insert({
      organisation_id: ORGS.aqua.id,
      name: "Instructor's pool",
    });
    const enrol = await aquaInstructor.client.from("enrolments").insert({
      organisation_id: ORGS.aqua.id,
      child_id: CHILDREN.ava.id,
      class_id: CLASSES.dolphin3Thu.id,
    });
    expect(error?.code).toBe("42501");
    expect(enrol.error?.code).toBe("42501");
  });
});

describe("parents see only their own children's classes", () => {
  it("see the classes their children are enrolled in, and no others", async () => {
    const { data } = await burrows.client.from("classes").select("id");
    expect((data ?? []).map((c) => c.id).sort()).toEqual(
      [CLASSES.dolphin3Wed.id, CLASSES.dolphin1Tue.id].sort(),
    );
  });

  it("see those classes' lessons, level and location", async () => {
    const lessons = await burrows.client.from("class_occurrences").select("class_id");
    const levels = await burrows.client.from("levels").select("id");
    const locations = await burrows.client.from("locations").select("id");
    expect(new Set((lessons.data ?? []).map((l) => l.class_id))).toEqual(
      new Set([CLASSES.dolphin3Wed.id, CLASSES.dolphin1Tue.id]),
    );
    expect((levels.data ?? []).map((l) => l.id).sort()).toEqual(
      [LEVELS.dolphin1.id, LEVELS.dolphin3.id].sort(),
    );
    expect((locations.data ?? []).map((l) => l.id)).toEqual([LOCATIONS.monaVale.id]);
  });

  it("see only their own children's enrolments", async () => {
    const { data } = await burrows.client.from("enrolments").select("child_id");
    expect(new Set((data ?? []).map((e) => e.child_id))).toEqual(
      new Set([CHILDREN.ava.id, CHILDREN.leo.id]),
    );
  });

  it("at another provider, see only that provider", async () => {
    const classes = await chen.client.from("classes").select("organisation_id");
    const orgs = await chen.client.from("organisations").select("id");
    expect(orgsOf(classes.data)).toEqual(new Set([ORGS.peak.id]));
    expect((orgs.data ?? []).map((o) => o.id)).toEqual([ORGS.peak.id]);
  });

  it("can't enrol or change anything", async () => {
    const enrol = await burrows.client.from("enrolments").insert({
      organisation_id: ORGS.aqua.id,
      child_id: CHILDREN.ava.id,
      class_id: CLASSES.dolphin3Thu.id,
    });
    const family = await burrows.client
      .from("families")
      .update({ display_name: "Renamed" })
      .eq("id", FAMILIES.burrows.id)
      .select("id");
    expect(enrol.error?.code).toBe("42501");
    expect(family.data).toEqual([]);
  });

  it("see no audit trail", async () => {
    const { data } = await burrows.client.from("audit_events").select("id");
    expect(data).toEqual([]);
  });
});

describe("capacity", () => {
  it("refuses an enrolment in a full class", async () => {
    const { classId, childId, tag } = await untaughtClassWithChild();
    const first = await aquaOwner.client
      .from("enrolments")
      .insert({ organisation_id: ORGS.aqua.id, child_id: childId, class_id: classId });
    expect(first.error).toBeNull();

    const second = await aquaOwner.client
      .from("enrolments")
      .insert({ organisation_id: ORGS.aqua.id, child_id: await newChild(tag), class_id: classId });
    expect(second.error?.hint).toBe("class_full");
  });

  it("gives the last place to exactly one of two simultaneous enrolments", async () => {
    const { classId, tag } = await untaughtClassWithChild();
    const [a, b] = await Promise.all([newChild(`${tag}a`), newChild(`${tag}b`)]);
    const results = await Promise.all(
      [a, b].map((childId) =>
        aquaOwner.client
          .from("enrolments")
          .insert({ organisation_id: ORGS.aqua.id, child_id: childId, class_id: classId }),
      ),
    );
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.filter((r) => r.error?.hint === "class_full")).toHaveLength(1);
  });

  it("won't enrol the same child twice in one class", async () => {
    const { data } = await aquaOwner.client
      .from("enrolments")
      .insert({
        organisation_id: ORGS.aqua.id,
        child_id: CHILDREN.ava.id,
        class_id: CLASSES.dolphin3Wed.id,
      })
      .select("id");
    expect(data).toBeNull();
  });

  it("won't lower capacity below the children already enrolled", async () => {
    const { error } = await aquaOwner.client
      .from("classes")
      .update({ capacity: 5 })
      .eq("id", CLASSES.dolphin3Wed.id);
    expect(error?.hint).toBe("capacity_below_enrolled");
  });

  it("schedules 12 upcoming lessons for a new class", async () => {
    const { classId } = await untaughtClassWithChild();
    const { data } = await aquaOwner.client
      .from("class_occurrences")
      .select("starts_at")
      .eq("class_id", classId)
      .gt("starts_at", new Date().toISOString());
    expect(data).toHaveLength(12);
  });
});
