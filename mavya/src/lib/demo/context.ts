import "server-only";
import { requireShell } from "@/lib/auth/viewer";
import { requireOwner } from "@/lib/business/owner";
import { createClient } from "@/lib/supabase/server";
import { isDemoFamily, isDemoStaff } from "./service";
import { readDemoState } from "./state";

// What every page needs: who is looking, their database client, what
// they've done so far in the demo, and whether the demo overlay is theirs.

export async function familyContext() {
  const viewer = await requireShell("family");
  const [state, db] = await Promise.all([readDemoState(), createClient()]);
  return { viewer, state, db, demo: isDemoFamily(viewer) };
}

export async function businessContext() {
  const owner = await requireOwner();
  const state = await readDemoState();
  return { ...owner, state, demo: isDemoStaff(owner.viewer, "owner") };
}

export async function instructorContext() {
  const viewer = await requireShell("instructor");
  const teaching = viewer.staff.find((s) => s.role === "instructor")!;
  const [state, db] = await Promise.all([readDemoState(), createClient()]);
  return {
    viewer,
    state,
    db,
    organisationId: teaching.organisationId,
    organisationName: teaching.organisationName,
    demo: isDemoStaff(viewer, "instructor"),
  };
}

export function firstName(name: string): string {
  return name.split(" ")[0] || "there";
}
