"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/business/owner";
import { DomainError } from "@/lib/domain/db";
import { followUpFamily } from "@/lib/domain/retention";
import type { FormState } from "@/lib/forms";

// Marking a family who might leave as followed up (M8e).
export async function followUp(familyId: string, _: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireOwner();
  if (!z.uuid().safeParse(familyId).success) return { error: "That didn't work. Try again." };
  const note = String(form.get("note") ?? "").trim();
  if (note.length > 200) return { error: "Keep the note to 200 characters." };
  try {
    await followUpFamily(db, familyId, note);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath("/business", "layout");
  return { ok: "Followed up. They're off the list for 30 days." };
}
