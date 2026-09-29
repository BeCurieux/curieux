import "server-only";
import { dayName, formatTime } from "@/lib/format";
import { explain, must, type Db } from "./db";

// Families and children. Owners see their organisation's; instructors the
// families of children they teach; parents their own.

export type ChildEnrolment = {
  id: string;
  classId: string;
  className: string;
  when: string;
  status: "active" | "paused" | "ended";
};

export type ChildRecord = {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  active: boolean;
  enrolments: ChildEnrolment[];
};

export type FamilyRecord = {
  id: string;
  organisationId: string;
  displayName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  children: ChildRecord[];
};

type EnrolmentRow = {
  id: string;
  child_id: string;
  class_id: string;
  status: string;
  classes: { name: string; weekday: number; start_time: string } | null;
};

async function childrenWithEnrolments(db: Db, familyIds: string[]): Promise<ChildRecord[]> {
  if (familyIds.length === 0) return [];
  const children = must(
    await db
      .from("children")
      .select("id, family_id, first_name, last_name, date_of_birth, active")
      .in("family_id", familyIds)
      .order("date_of_birth"),
  );
  const enrolments = children.length
    ? (must(
        await db
          .from("enrolments")
          .select("id, child_id, class_id, status, classes (name, weekday, start_time)")
          .in(
            "child_id",
            children.map((c) => c.id),
          )
          .neq("status", "ended"),
      ) as unknown as EnrolmentRow[])
    : [];
  return children.map((c) => ({
    id: c.id,
    familyId: c.family_id,
    firstName: c.first_name,
    lastName: c.last_name,
    dateOfBirth: c.date_of_birth,
    active: c.active,
    enrolments: enrolments
      .filter((e) => e.child_id === c.id)
      .map((e) => ({
        id: e.id,
        classId: e.class_id,
        className: e.classes?.name ?? "",
        when: e.classes ? `${dayName(e.classes.weekday)} ${formatTime(e.classes.start_time)}` : "",
        status: e.status as ChildEnrolment["status"],
      })),
  }));
}

type FamilyRow = {
  id: string;
  organisation_id: string;
  display_name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
};

function toFamily(row: FamilyRow, children: ChildRecord[]): FamilyRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    displayName: row.display_name,
    contactName: row.primary_contact_name,
    contactEmail: row.primary_contact_email,
    contactPhone: row.primary_contact_phone,
    children: children.filter((c) => c.familyId === row.id),
  };
}

export async function listFamilies(db: Db, organisationId: string): Promise<FamilyRecord[]> {
  const families = must(
    await db
      .from("families")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("display_name"),
  );
  const children = await childrenWithEnrolments(
    db,
    families.map((f) => f.id),
  );
  return families.map((f) => toFamily(f, children));
}

export async function getFamily(db: Db, id: string): Promise<FamilyRecord | null> {
  const { data, error } = await db.from("families").select("*").eq("id", id).maybeSingle();
  if (error) throw explain(error);
  if (!data) return null;
  return toFamily(data, await childrenWithEnrolments(db, [id]));
}

export type FamilyInput = {
  displayName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

const familyRow = (input: FamilyInput) => ({
  display_name: input.displayName,
  primary_contact_name: input.contactName,
  primary_contact_email: input.contactEmail,
  primary_contact_phone: input.contactPhone,
});

export async function createFamily(db: Db, organisationId: string, input: FamilyInput) {
  return must(
    await db
      .from("families")
      .insert({ organisation_id: organisationId, ...familyRow(input) })
      .select("id")
      .single(),
  ).id;
}

export async function updateFamily(db: Db, id: string, input: FamilyInput) {
  must(await db.from("families").update(familyRow(input)).eq("id", id).select("id").single());
}

export type ChildInput = { firstName: string; lastName: string; dateOfBirth: string };

// A child always joins its family's organisation.
export async function addChild(db: Db, familyId: string, input: ChildInput) {
  const family = must(
    await db.from("families").select("organisation_id").eq("id", familyId).single(),
  );
  return must(
    await db
      .from("children")
      .insert({
        organisation_id: family.organisation_id,
        family_id: familyId,
        first_name: input.firstName,
        last_name: input.lastName,
        date_of_birth: input.dateOfBirth,
      })
      .select("id")
      .single(),
  ).id;
}

export async function updateChild(db: Db, id: string, input: ChildInput) {
  must(
    await db
      .from("children")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        date_of_birth: input.dateOfBirth,
      })
      .eq("id", id)
      .select("id")
      .single(),
  );
}

// Children of an organisation not currently in the given class, for the
// "enrol a child" picker.
export async function childrenNotInClass(db: Db, organisationId: string, classId: string) {
  const [children, current] = await Promise.all([
    db
      .from("children")
      .select("id, first_name, last_name, families (display_name)")
      .eq("organisation_id", organisationId)
      .eq("active", true)
      .order("first_name"),
    db
      .from("enrolments")
      .select("child_id")
      .eq("class_id", classId)
      .in("status", ["active", "paused"]),
  ]);
  const taken = new Set(must(current).map((e) => e.child_id));
  return (
    must(children) as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      families: { display_name: string } | null;
    }[]
  )
    .filter((c) => !taken.has(c.id))
    .map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      family: c.families?.display_name ?? "",
    }));
}
