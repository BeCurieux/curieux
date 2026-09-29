"use server";

import { revalidatePath } from "next/cache";
import { requireShell } from "@/lib/auth/viewer";
import { markAllRead } from "@/lib/domain/notifications";
import { createClient } from "@/lib/supabase/server";

// Marks the parent's own notifications seen. The database only ever
// touches the caller's rows.
export async function markNotificationsRead() {
  await requireShell("family");
  await markAllRead(await createClient());
  revalidatePath("/family", "layout");
}
