import "server-only";
import { explain, must, type Db } from "./db";

// The organisation's staff, and removing or restoring someone's access.
// Removal is a database function (remove_staff_member) so suspending the
// membership, unassigning classes and ending sessions happen together, and
// the database checks the caller is an owner.

export type StaffMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "instructor";
  active: boolean;
  classCount: number;
};

export async function listStaff(db: Db, organisationId: string): Promise<StaffMember[]> {
  const memberships = must(
    await db
      .from("staff_memberships")
      .select("id, user_id, role, status")
      .eq("organisation_id", organisationId)
      .in("status", ["active", "suspended"]),
  );
  const ids = memberships.map((m) => m.id);
  const [users, classes] = await Promise.all([
    db
      .from("users")
      .select("id, name, email")
      .in(
        "id",
        memberships.map((m) => m.user_id),
      ),
    ids.length
      ? db.from("classes").select("instructor_id").eq("active", true).in("instructor_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const people = new Map(must(users).map((u) => [u.id, u]));
  const counts = new Map<string, number>();
  for (const c of must(classes)) {
    if (c.instructor_id) counts.set(c.instructor_id, (counts.get(c.instructor_id) ?? 0) + 1);
  }
  return memberships
    .map((m) => ({
      membershipId: m.id,
      userId: m.user_id,
      name: people.get(m.user_id)?.name ?? "Staff member",
      email: people.get(m.user_id)?.email ?? "",
      role: m.role as StaffMember["role"],
      active: m.status === "active",
      classCount: counts.get(m.id) ?? 0,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

export async function removeStaffMember(db: Db, membershipId: string) {
  const { error } = await db.rpc("remove_staff_member", { p_membership_id: membershipId });
  if (error) throw explain(error);
}

export async function restoreStaffMember(db: Db, membershipId: string) {
  const { error } = await db.rpc("restore_staff_member", { p_membership_id: membershipId });
  if (error) throw explain(error);
}
