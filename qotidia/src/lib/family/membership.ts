// Reading membership on the server.
//
// Every screen that shows shared content needs the same two facts: which
// family this is, and what the current user is allowed to do in it. Doing
// that in one place means a screen cannot accidentally ask a laxer question
// than the one the database will answer.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyRole } from "./roles";

export interface Membership {
  familyId: string;
  role: FamilyRole;
  userId: string;
}

/** The caller's role in a family, or null if they are not in it. */
export async function roleInFamily(
  db: SupabaseClient,
  familyId: string,
  userId: string
): Promise<FamilyRole | null> {
  const { data } = await db
    .from("family_memberships")
    .select("role")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as FamilyRole) ?? null;
}

/** The caller's role in the family a subject belongs to. */
export async function roleForSubject(
  db: SupabaseClient,
  subjectId: string,
  userId: string
): Promise<{ familyId: string; role: FamilyRole } | null> {
  const { data: subject } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) return null;
  const role = await roleInFamily(db, subject.family_id, userId);
  return role ? { familyId: subject.family_id, role } : null;
}

export interface MemberRow {
  id: string;
  userId: string;
  role: FamilyRole;
  displayName: string | null;
  email: string | null;
}

/** Everyone with access, for the "who can see this" screen. */
export async function membersOfFamily(
  db: SupabaseClient,
  familyId: string
): Promise<MemberRow[]> {
  const { data } = await db
    .from("family_memberships")
    .select("id, user_id, role, display_name, profiles(email)")
    .eq("family_id", familyId)
    .order("created_at");

  return (data ?? []).map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role as FamilyRole,
    displayName: m.display_name ?? null,
    email: m.profiles?.email ?? null,
  }));
}

/** How a member should be named on screen. */
export function memberLabel(m: { displayName: string | null; email: string | null }): string {
  return m.displayName || m.email?.split("@")[0] || "Someone";
}
