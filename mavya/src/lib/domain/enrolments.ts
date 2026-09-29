import "server-only";
import { must, type Db } from "./db";

// Enrolling and un-enrolling. Capacity, duplicates and tenancy are enforced
// by the database (docs/M2_CLASSES.md), so a refusal comes back as a
// DomainError with a plain message.

export async function enrol(
  db: Db,
  input: { organisationId: string; childId: string; classId: string },
) {
  return must(
    await db
      .from("enrolments")
      .insert({
        organisation_id: input.organisationId,
        child_id: input.childId,
        class_id: input.classId,
      })
      .select("id")
      .single(),
  ).id;
}

export async function endEnrolment(db: Db, enrolmentId: string) {
  must(
    await db
      .from("enrolments")
      .update({ status: "ended", ends_at: new Date().toISOString().slice(0, 10) })
      .eq("id", enrolmentId)
      .eq("status", "active")
      .select("id")
      .single(),
  );
}

export type RosterEntry = {
  enrolmentId: string;
  childId: string;
  firstName: string;
  lastName: string;
  family: string;
};

export async function classRoster(db: Db, classId: string): Promise<RosterEntry[]> {
  const rows = must(
    await db
      .from("enrolments")
      .select("id, child_id, children (first_name, last_name, families (display_name))")
      .eq("class_id", classId)
      .eq("status", "active"),
  ) as unknown as {
    id: string;
    child_id: string;
    children: {
      first_name: string;
      last_name: string;
      families: { display_name: string } | null;
    } | null;
  }[];
  return rows
    .map((r) => ({
      enrolmentId: r.id,
      childId: r.child_id,
      firstName: r.children?.first_name ?? "",
      lastName: r.children?.last_name ?? "",
      family: r.children?.families?.display_name ?? "",
    }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
}
