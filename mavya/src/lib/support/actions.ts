"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/business/owner";
import { DomainError } from "@/lib/domain/db";
import { endSupportAccess, grantSupportAccess } from "@/lib/domain/support";
import type { FormState } from "@/lib/forms";

// An owner lets Ovyko support in, or ends it (M6g).

const note = z.string().max(500, "Keep the note to 500 characters.");

export async function letSupportIn(_: FormState, form: FormData): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = note.safeParse(String(form.get("note") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  try {
    await grantSupportAccess(db, organisationId, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath("/business/settings/support");
  return { ok: "Ovyko support can see how your school is set up for the next 48 hours." };
}

export async function shutSupportOut(): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  await endSupportAccess(db, organisationId);
  revalidatePath("/business/settings/support");
  return { ok: "Ovyko support can't see your school any more." };
}
