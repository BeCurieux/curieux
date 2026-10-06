import "server-only";
import { redirect } from "next/navigation";
import { requireShell } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

// The owner's organisation for business pages and actions. Someone who
// owns several uses the first; switching between them comes later.
export async function requireOwner() {
  const viewer = await requireShell("business");
  const owned = viewer.staff.find((s) => s.role === "owner");
  if (!owned) redirect("/");
  const db = await createClient();
  return {
    viewer,
    db,
    organisationId: owned.organisationId,
    organisationName: owned.organisationName,
    // A pretend school from "Try it yourself" (docs/TRY_IT_YOURSELF.md):
    // nothing in it may reach the real world.
    demo: owned.demoExpiresAt !== null,
  };
}
