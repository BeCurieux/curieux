"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShell } from "@/lib/auth/viewer";
import { DomainError } from "@/lib/domain/db";
import * as fill from "@/lib/domain/fill";
import * as makeups from "@/lib/domain/makeups";
import { markAllRead } from "@/lib/domain/notifications";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Parents' writes. Each checks the caller can open the family app and
// validates its input; the database decides whether this parent may act for
// this child and applies the school's make-up rules.

const id = z.uuid();

async function familyDb() {
  await requireShell("family");
  return createClient();
}

async function attempt<T>(run: () => Promise<T>): Promise<{ ok: T } | { error: string }> {
  try {
    return { ok: await run() };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

// Marks the parent's own notifications seen. The database only ever
// touches the caller's rows.
export async function markNotificationsRead() {
  await requireShell("family");
  await markAllRead(await createClient());
  revalidatePath("/family", "layout");
}

const absenceSchema = z.object({
  childId: id,
  occurrenceId: z.uuid("Choose a lesson."),
  reason: z
    .string()
    .trim()
    .max(200, "Keep the reason under 200 characters.")
    .optional()
    .transform((v) => v || null),
});

export async function reportAbsence(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = absenceSchema.safeParse({
    childId: formData.get("childId"),
    occurrenceId: formData.get("occurrenceId"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const db = await familyDb();
  const result = await attempt(() => makeups.reportAbsence(db, parsed.data));
  if ("error" in result) return { error: result.error };
  revalidatePath("/family", "layout");
  redirect(result.ok.creditId ? "/family/makeups" : `/family/makeups?away=${result.ok.absenceId}`);
}

export async function withdrawAbsence(absenceId: string): Promise<FormState> {
  if (!id.safeParse(absenceId).success) return { error: "That didn't work. Try again." };
  const db = await familyDb();
  const result = await attempt(() => makeups.withdrawAbsence(db, absenceId));
  if ("error" in result) return { error: result.error };
  revalidatePath("/family", "layout");
  return { ok: "Great, see you there." };
}

export async function bookMakeup(creditId: string, occurrenceId: string): Promise<FormState> {
  if (!id.safeParse(creditId).success || !id.safeParse(occurrenceId).success)
    return { error: "Choose a class first." };
  const db = await familyDb();
  const result = await attempt(() => makeups.bookMakeup(db, { creditId, occurrenceId }));
  if ("error" in result) return { error: result.error };
  revalidatePath("/family", "layout");
  redirect(`/family/makeups?booked=${result.ok}`);
}

export async function cancelMakeup(bookingId: string): Promise<FormState> {
  if (!id.safeParse(bookingId).success) return { error: "That didn't work. Try again." };
  const db = await familyDb();
  const result = await attempt(() => makeups.cancelMakeup(db, bookingId));
  if ("error" in result) return { error: result.error };
  revalidatePath("/family", "layout");
  return {
    ok: result.ok
      ? "Make-up cancelled. Your credit is back, ready to use."
      : "Make-up cancelled. It was too close to the lesson to get the credit back.",
  };
}

// ------------------------------------------------------------------ offered spots

// Claim codes are 64 hex characters; anything else can't be one.
const code = z.string().regex(/^[0-9a-f]{64}$/);

const CLAIM_MESSAGES = {
  taken: "Sorry, someone else just took that spot.",
  expired: "This offer has expired.",
  closed: "This offer is no longer open.",
} as const;

// Claims an offered spot. The database books it with the child's make-up
// credit under the same locks as any make-up.
export async function claimOffer(claimCode: string): Promise<FormState> {
  if (!code.safeParse(claimCode).success) return { error: CLAIM_MESSAGES.closed };
  const db = await familyDb();
  const result = await attempt(() => fill.claimOffer(db, claimCode));
  if ("error" in result) return { error: result.error };
  revalidatePath("/family", "layout");
  const { outcome, bookingId } = result.ok;
  if (outcome !== "claimed") return { error: CLAIM_MESSAGES[outcome] };
  redirect(`/family/makeups?booked=${bookingId}`);
}

export async function declineOffer(claimCode: string): Promise<FormState> {
  if (!code.safeParse(claimCode).success) return { error: CLAIM_MESSAGES.closed };
  const db = await familyDb();
  const result = await attempt(() => fill.declineOffer(db, claimCode));
  if ("error" in result) return { error: result.error };
  revalidatePath("/family", "layout");
  return result.ok ? { ok: "No problem. We'll let them know." } : { error: CLAIM_MESSAGES.closed };
}
