import "server-only";
import { requireShell } from "@/lib/auth/viewer";
import { requireOwner } from "@/lib/business/owner";
import { createClient } from "@/lib/supabase/server";
import { isDemoFamily, isDemoStaff } from "./service";

// What every page needs: who is looking, their database client, and
// whether the demo overlay (a few sample messages) is theirs.

export async function familyContext() {
  const viewer = await requireShell("family");
  const db = await createClient();
  return { viewer, db, demo: isDemoFamily(viewer) };
}

export async function businessContext() {
  const owner = await requireOwner();
  return { ...owner, demo: isDemoStaff(owner.viewer, "owner") };
}

export async function instructorContext() {
  const viewer = await requireShell("instructor");
  const teaching = viewer.staff.find((s) => s.role === "instructor")!;
  const db = await createClient();
  return {
    viewer,
    db,
    organisationId: teaching.organisationId,
    organisationName: teaching.organisationName,
    demo: isDemoStaff(viewer, "instructor"),
  };
}

export function firstName(name: string): string {
  return name.split(" ")[0] || "there";
}
