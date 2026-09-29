import "server-only";
import { must, type Db } from "./db";
import { listClasses, type ClassSummary } from "./timetable";

// What a parent sees: their children and the classes they're enrolled in.

export type FamilyChild = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  organisation: string;
  classes: ClassSummary[];
};

export async function myChildren(db: Db): Promise<FamilyChild[]> {
  const [children, enrolments, classes, organisations] = await Promise.all([
    db
      .from("children")
      .select("id, first_name, last_name, date_of_birth, organisation_id")
      .eq("active", true)
      .order("date_of_birth"),
    db.from("enrolments").select("child_id, class_id").in("status", ["active", "paused"]),
    listClasses(db, { activeOnly: true }),
    db.from("organisations").select("id, name"),
  ]);
  const orgNames = new Map(must(organisations).map((o) => [o.id, o.name]));
  const byId = new Map(classes.map((c) => [c.id, c]));
  const rows = must(enrolments);
  return must(children).map((c) => ({
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    dateOfBirth: c.date_of_birth,
    organisation: orgNames.get(c.organisation_id) ?? "",
    classes: rows
      .filter((e) => e.child_id === c.id)
      .map((e) => byId.get(e.class_id))
      .filter((k): k is ClassSummary => Boolean(k)),
  }));
}

// The staff membership an instructor teaches under in an organisation.
export async function myMembershipId(db: Db, userId: string, organisationId: string) {
  const row = must(
    await db
      .from("staff_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("organisation_id", organisationId)
      .eq("status", "active")
      .single(),
  );
  return row.id;
}
