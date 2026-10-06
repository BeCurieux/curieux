import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHILDREN, ORGS } from "../../scripts/fixtures";
import { signInAs, type Session } from "./helpers";

// M6a acceptance (security and rules): docs/M6_MIGRATION_PILOT.md. Every
// check runs as a real signed-in user through the public API. What the
// tests import they undo at the end, so a rerun starts clean.

let aquaOwner: Session;
let aquaInstructor: Session;
let peakOwner: Session;
let burrows: Session;

type Report = {
  batch_id: string | null;
  added: Record<string, number>;
  existing: Record<string, number>;
  problems: { file: string; row: number; message: string }[];
  notes: { file: string; row: number; message: string; note?: boolean }[];
};

// Sunday mornings: no seeded class, so no instructor or capacity clashes.
const CLASSES = [
  {
    row: 2,
    name: "Import Turtles",
    level: "Dolphin 1",
    program: null,
    location: "Mona Vale",
    weekday: 7,
    start_time: "08:00",
    duration_minutes: 30,
    capacity: 2,
    instructor_email: null,
  },
  {
    row: 3,
    name: "Import Sharks",
    level: "Dolphin 2",
    program: "Learn to Swim",
    location: "mona vale",
    weekday: 7,
    start_time: "08:30",
    duration_minutes: 30,
    capacity: 4,
    instructor_email: "nobody@aquahouse.test",
  },
];

const student = (row: number, first: string, extra: Record<string, unknown> = {}) => ({
  row,
  first_name: first,
  last_name: "Importer",
  date_of_birth: "2019-05-01",
  parent_name: "Pat Importer",
  parent_email: "pat.importer@example.test",
  parent_phone: null,
  class: "Import Turtles",
  class_weekday: null,
  class_time: null,
  ...extra,
});

const STUDENTS = [
  student(2, "Remy"),
  student(3, "Juno", { date_of_birth: "2020-01-09" }),
  // A different family, found by phone only.
  student(4, "Kai", {
    parent_email: null,
    parent_phone: "0400 111 222",
    last_name: "Phoneonly",
    class: "Import Sharks",
  }),
];

const run = (
  s: Session,
  commit: boolean,
  classes: unknown[] = CLASSES,
  students: unknown[] = STUDENTS,
  readProblems: unknown[] = [],
) =>
  s.client.rpc("import_school", {
    p_org: ORGS.aqua.id,
    p_classes: classes as never,
    p_students: students as never,
    p_file_names: ["classes.csv", "students.csv"],
    p_commit: commit,
    p_read_problems: readProblems as never,
  });

async function imported(name: string) {
  const { data } = await aquaOwner.client.from("classes").select("id").eq("name", name);
  return data ?? [];
}

const batches: string[] = [];

beforeAll(async () => {
  [aquaOwner, aquaInstructor, peakOwner, burrows] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
    signInAs("burrowsParent"),
  ]);
  // A rerun after a stopped run: undo what an earlier run left.
  const { data } = await aquaOwner.client
    .from("import_batches")
    .select("id")
    .is("undone_at", null)
    .order("created_at", { ascending: false });
  for (const b of data ?? []) await aquaOwner.client.rpc("undo_import", { p_batch: b.id });
});

afterAll(async () => {
  for (const id of batches.reverse()) await aquaOwner.client.rpc("undo_import", { p_batch: id });
});

describe("checking an import", () => {
  it("says what would be added and saves nothing", async () => {
    const { data, error } = await run(aquaOwner, false);
    expect(error).toBeNull();
    const report = data as unknown as Report;
    expect(report.batch_id).toBeNull();
    expect(report.added).toEqual({
      classes: 2,
      families: 2,
      children: 3,
      enrolments: 3,
      balances: 0,
      credits: 0,
    });
    expect(report.problems).toEqual([]);
    expect(report.notes).toEqual([
      {
        file: "classes",
        row: 3,
        note: true,
        message:
          "No staff member has the email nobody@aquahouse.test, so this class has no instructor yet.",
      },
    ]);
    expect(await imported("Import Turtles")).toEqual([]);
  });
});

describe("saving an import", () => {
  let report: Report;

  beforeAll(async () => {
    const { data, error } = await run(aquaOwner, true, CLASSES, STUDENTS, [
      { file: "students", row: 9, message: "Unreadable date.", extra: "dropped" },
    ]);
    expect(error).toBeNull();
    report = data as unknown as Report;
    batches.push(report.batch_id!);
  });

  it("adds the classes with their lessons, families, children and places", async () => {
    expect(report.added).toEqual({
      classes: 2,
      families: 2,
      children: 3,
      enrolments: 3,
      balances: 0,
      credits: 0,
    });
    const [turtles] = await imported("Import Turtles");
    const { count: lessons } = await aquaOwner.client
      .from("class_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("class_id", turtles!.id);
    expect(lessons).toBeGreaterThanOrEqual(12);
    const { data: family } = await aquaOwner.client
      .from("families")
      .select("display_name, primary_contact_name, primary_contact_email, children (first_name)")
      .eq("primary_contact_email", "pat.importer@example.test")
      .single();
    expect(family!.display_name).toBe("Importer Family");
    expect(family!.primary_contact_name).toBe("Pat Importer");
    expect(family!.children.map((c) => c.first_name).sort()).toEqual(["Juno", "Remy"]);
  });

  it("keeps a record the owner can check against the old system", async () => {
    const { data: batch } = await aquaOwner.client
      .from("import_batches")
      .select("file_names, counts, problems")
      .eq("id", report.batch_id!)
      .single();
    expect(batch!.file_names).toEqual(["classes.csv", "students.csv"]);
    expect(batch!.counts).toMatchObject({ rows: { classes: 2, students: 4 } });
    // Rows the app couldn't read are kept, without anything but their fields.
    expect(batch!.problems).toContainEqual({
      file: "students",
      row: 9,
      message: "Unreadable date.",
    });
    const { data: summary } = await aquaOwner.client.rpc("import_summary", {
      p_batch: report.batch_id!,
    });
    expect(summary).toEqual({
      in_ovyko: { classes: 2, families: 2, children: 3, enrolments: 3, balances: 0, credits: 0 },
      can_undo: true,
    });
  });

  it("adds nothing when the same files are imported again", async () => {
    const { data } = await run(aquaOwner, false);
    const again = data as unknown as Report;
    expect(again.added).toEqual({
      classes: 0,
      families: 0,
      children: 0,
      enrolments: 0,
      balances: 0,
      credits: 0,
    });
    expect(again.existing).toEqual({
      classes: 2,
      families: 2,
      children: 3,
      enrolments: 3,
      balances: 0,
      credits: 0,
    });
  });

  it("matches families already at the school", async () => {
    const { data: ava } = await aquaOwner.client
      .from("children")
      .select("date_of_birth")
      .eq("id", CHILDREN.ava.id)
      .single();
    const { data } = await run(
      aquaOwner,
      false,
      [],
      [
        student(2, "Ava", {
          last_name: "Burrows",
          date_of_birth: ava!.date_of_birth,
          parent_email: "SARAH.BURROWS@family.test",
          class: null,
        }),
      ],
    );
    const r = data as unknown as Report;
    expect(r.added).toEqual({
      classes: 0,
      families: 0,
      children: 0,
      enrolments: 0,
      balances: 0,
      credits: 0,
    });
    expect(r.existing).toMatchObject({ families: 1, children: 1 });
  });
});

describe("rows that can't come across", () => {
  it("are named with a reason, and the rest still comes across", async () => {
    const classes = [
      { ...CLASSES[0], row: 2, name: "Import Minnows", start_time: "09:00" },
      { ...CLASSES[0], row: 3, name: "Import Minnows", start_time: "09:00" },
      { ...CLASSES[0], row: 4, name: "Import Ghost", level: "Dolphin 9" },
      { ...CLASSES[0], row: 5, name: "Import Ghost", location: "Atlantis" },
    ];
    const students = [
      student(2, "Ada", { class: "Import Minnows", date_of_birth: "2019-01-01" }),
      student(3, "Bo", { class: "Import Minnows", date_of_birth: "2019-01-02" }),
      student(4, "Cy", { class: "Import Minnows", date_of_birth: "2019-01-03" }),
      student(5, "Di", { class: "Import Nowhere", date_of_birth: "2019-01-04" }),
      student(6, "Ed", { parent_email: null, parent_phone: null }),
      student(7, "Ada", { class: "Import Minnows", date_of_birth: "2019-01-01" }),
    ];
    const { data, error } = await run(aquaOwner, false, classes, students);
    expect(error).toBeNull();
    const r = data as unknown as Report;
    expect(r.problems).toEqual([
      { file: "classes", row: 3, message: "This is the same class as row 2." },
      {
        file: "classes",
        row: 4,
        message: 'The level "Dolphin 9" isn\'t set up yet. Add it in Settings → Levels.',
      },
      {
        file: "classes",
        row: 5,
        message: 'The location "Atlantis" isn\'t set up yet. Add it in Settings → Locations.',
      },
      {
        file: "students",
        row: 4,
        message:
          "Cy was added, but Import Minnows on Sundays is full (2 places), so they aren't in it yet.",
      },
      {
        file: "students",
        row: 5,
        message:
          "Di was added, but there's no class called \"Import Nowhere\", so they aren't in a class yet.",
      },
      {
        file: "students",
        row: 6,
        message: "Add a parent email or phone, so we know which family this child belongs to.",
      },
      { file: "students", row: 7, message: "This child is already in the file on an earlier row." },
    ]);
    expect(r.added).toEqual({
      classes: 1,
      families: 0,
      children: 4,
      enrolments: 2,
      balances: 0,
      credits: 0,
    });
  });

  it("asks for a day and time when a class name is used more than once", async () => {
    const { data } = await run(
      aquaOwner,
      false,
      [],
      [student(2, "Fin", { class: "Dolphin 3", date_of_birth: "2019-02-02" })],
    );
    expect((data as unknown as Report).problems[0]!.message).toContain(
      'more than one class called "Dolphin 3"',
    );
    const { data: exact } = await run(
      aquaOwner,
      false,
      [],
      [
        student(2, "Fin", {
          class: "Dolphin 3",
          class_weekday: 6,
          class_time: "09:00",
          date_of_birth: "2019-02-02",
        }),
      ],
    );
    expect((exact as unknown as Report).added.enrolments).toBe(1);
  });
});

describe("undo", () => {
  it("is refused once something else depends on what the import added", async () => {
    // A second import adds a child to a family the first one added.
    const { data } = await run(
      aquaOwner,
      true,
      [],
      [student(2, "Sol", { date_of_birth: "2021-03-03", class: null })],
    );
    const second = (data as unknown as Report).batch_id!;
    batches.push(second);
    const first = batches[0]!;
    const refused = await aquaOwner.client.rpc("undo_import", { p_batch: first });
    expect(refused.error?.hint).toBe("import_locked");
    const { data: summary } = await aquaOwner.client.rpc("import_summary", { p_batch: first });
    expect(summary).toMatchObject({ can_undo: false });

    // Undo the newer one, and the first can go too.
    expect((await aquaOwner.client.rpc("undo_import", { p_batch: second })).error).toBeNull();
    expect((await aquaOwner.client.rpc("undo_import", { p_batch: first })).error).toBeNull();
    batches.length = 0;
    expect(await imported("Import Turtles")).toEqual([]);
    const { data: kids } = await aquaOwner.client
      .from("children")
      .select("id")
      .eq("last_name", "Importer");
    expect(kids).toEqual([]);
    const again = await aquaOwner.client.rpc("undo_import", { p_batch: first });
    expect(again.error?.hint).toBe("import_locked");
  });
});

describe("who can import", () => {
  it("only the school's own owners", async () => {
    for (const s of [aquaInstructor, peakOwner, burrows]) {
      const { error } = await run(s, false);
      expect(error?.code).toBe("42501");
    }
  });

  it("imports are visible to the school's owners only", async () => {
    const { data } = await run(aquaOwner, true, [], [student(2, "Vi", { class: null })]);
    const batch = (data as unknown as Report).batch_id!;
    batches.push(batch);
    for (const s of [aquaInstructor, peakOwner, burrows]) {
      const { data: rows } = await s.client.from("import_batches").select("id");
      expect(rows).toEqual([]);
      expect((await s.client.rpc("import_summary", { p_batch: batch })).error?.code).toBe("42501");
      expect((await s.client.rpc("undo_import", { p_batch: batch })).error?.code).toBe("42501");
    }
  });

  it("nobody can mark rows as imported by hand", async () => {
    const batch = batches[batches.length - 1]!;
    const { error: insert } = await aquaOwner.client.from("families").insert({
      organisation_id: ORGS.aqua.id,
      display_name: "Sneaky Family",
      import_batch_id: batch,
    });
    expect(insert?.code).toBe("42501");
    const { error: update } = await aquaOwner.client
      .from("children")
      .update({ import_batch_id: batch })
      .eq("id", CHILDREN.ava.id);
    expect(update?.code).toBe("42501");
  });

  it("the import's own writes are audited", async () => {
    const batch = batches[batches.length - 1]!;
    const { data } = await aquaOwner.client
      .from("audit_events")
      .select("entity_type")
      .eq("entity_id", batch);
    expect(data!.map((e) => e.entity_type)).toContain("import_batches");
  });
});
