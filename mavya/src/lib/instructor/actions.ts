"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShell } from "@/lib/auth/viewer";
import { recordAttendance } from "@/lib/domain/attendance";
import { DomainError } from "@/lib/domain/db";
import { childProgress, recordProgress } from "@/lib/domain/progress";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Instructors' writes. Each checks the caller can open the instructor app
// and validates its input; the database's record_attendance and
// record_progress decide whether this person may mark this child, and audit
// the change.

const id = z.uuid();

async function instructorDb() {
  await requireShell("instructor");
  return createClient();
}

export async function markAttendance(
  occurrenceId: string,
  childId: string,
  status: "present" | "absent",
): Promise<FormState> {
  const input = z
    .object({ occurrenceId: id, childId: id, status: z.enum(["present", "absent"]) })
    .safeParse({ occurrenceId, childId, status });
  if (!input.success) return { error: "That didn't work. Try again." };
  const db = await instructorDb();
  try {
    await recordAttendance(db, input.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return {};
}

const skillStatus = z.enum(["not_started", "developing", "achieved"]);

// Saves every skill on the form whose status changed. The level comes from
// the page, but only decides which skills are read from the form: the
// database checks each skill against the classes this instructor teaches
// the child in.
export async function saveProgress(
  childId: string,
  levelId: string,
  returnTo: string,
  formData: FormData,
) {
  if (!id.safeParse(childId).success || !id.safeParse(levelId).success) redirect("/instructor");
  const db = await instructorDb();
  const current = await childProgress(db, childId, levelId);
  if (!current) redirect("/instructor");
  let error = false;
  for (const skill of current.skills) {
    const parsed = skillStatus.safeParse(formData.get(skill.id));
    if (!parsed.success || parsed.data === skill.status) continue;
    try {
      await recordProgress(db, { childId, skillId: skill.id, status: parsed.data });
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
      error = true;
      break;
    }
  }
  revalidatePath("/", "layout");
  const page = /^\/instructor\/child\/[\w-]+$/.test(returnTo)
    ? returnTo
    : `/instructor/child/${childId}`;
  redirect(`${page}?${error ? "error=1" : "saved=1"}`);
}
