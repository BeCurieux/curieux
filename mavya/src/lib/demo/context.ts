import "server-only";
import { requireShell } from "@/lib/auth/viewer";
import { isDemoFamily, isDemoStaff } from "./service";
import { readDemoState } from "./state";

// What every demo page needs: who is looking, what they've done so far in
// the demo, and whether the demo data is theirs to see at all.

export async function familyContext() {
  const viewer = await requireShell("family");
  const state = await readDemoState();
  return { viewer, state, demo: isDemoFamily(viewer) };
}

export async function businessContext() {
  const viewer = await requireShell("business");
  const state = await readDemoState();
  return { viewer, state, demo: isDemoStaff(viewer, "owner") };
}

export async function instructorContext() {
  const viewer = await requireShell("instructor");
  const state = await readDemoState();
  return { viewer, state, demo: isDemoStaff(viewer, "instructor") };
}

export function firstName(name: string): string {
  return name.split(" ")[0] || "there";
}
