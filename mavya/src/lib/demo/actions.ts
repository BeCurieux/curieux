"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import { DomainError } from "@/lib/domain/db";
import { lessonStatesForChildren } from "@/lib/domain/lessons";
import { cancelMakeup, withdrawAbsence } from "@/lib/domain/makeups";
import { createClient } from "@/lib/supabase/server";
import { isDemoFamily } from "./service";

// The demo's writes. A server action is a public endpoint, so each one
// checks who is calling and what they're allowed to change before touching
// anything, exactly as a real one would.

// Puts the demo back: for the demo family, cancels their upcoming make-ups
// and takes back their upcoming absences, through the same rules as the
// buttons that made them.
export async function resetDemo() {
  const viewer = await requireViewer();
  if (isDemoFamily(viewer)) {
    const db = await createClient();
    const { bookings, absences } = await lessonStatesForChildren(db);
    // One that's too close to its lesson to undo simply stays.
    const quietly = (run: () => Promise<unknown>) =>
      run().catch((error: unknown) => {
        if (!(error instanceof DomainError)) throw error;
      });
    for (const id of bookings) await quietly(() => cancelMakeup(db, id));
    for (const id of absences) await quietly(() => withdrawAbsence(db, id));
  }
  revalidatePath("/", "layout");
  redirect("/");
}
