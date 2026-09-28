import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { availableShells, homePath, type Shell, type StaffRole } from "./roles";

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  shells: Shell[];
  staff: { organisationId: string; organisationName: string; role: StaffRole }[];
  families: { familyId: string; displayName: string }[];
};

// The signed-in person and what they may open, read through row level
// security as that person. Roles come from the database on every request
// rather than from token claims, so revoking a membership takes effect at
// once. Cached per request, so layouts and pages share one lookup.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("auth_id", auth.user.id)
    .maybeSingle();
  if (!profile) return null;

  const [staffResult, familyResult] = await Promise.all([
    supabase
      .from("staff_memberships")
      .select("organisation_id, role, organisations (name)")
      .eq("user_id", profile.id)
      .eq("status", "active"),
    supabase
      .from("family_members")
      .select("family_id, families (display_name)")
      .eq("user_id", profile.id),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (familyResult.error) throw familyResult.error;

  const staff = staffResult.data.map((m) => ({
    organisationId: m.organisation_id,
    organisationName: m.organisations?.name ?? "",
    role: m.role as StaffRole,
  }));
  const families = familyResult.data.map((f) => ({
    familyId: f.family_id,
    displayName: f.families?.display_name ?? "",
  }));

  return {
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    shells: availableShells({
      staffRoles: staff.map((s) => s.role),
      familyCount: families.length,
    }),
    staff,
    families,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}

// For a shell's layout: signed out goes to sign-in; signed in without this
// role goes to the shell they do have.
export async function requireShell(shell: Shell): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.shells.includes(shell)) redirect(homePath(viewer.shells));
  return viewer;
}
