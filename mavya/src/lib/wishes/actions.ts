"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShell } from "@/lib/auth/viewer";
import { requireOwner } from "@/lib/business/owner";
import { DomainError } from "@/lib/domain/db";
import { addWish, placeFromWish, withdrawWish } from "@/lib/domain/wishes";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Families asking for times; owners placing children from requests (M8b).
// The database decides who may and what's allowed.

const id = z.uuid();
const time = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time.");

const wishSchema = z.object({
  levelId: z.union([id, z.literal("")]),
  locationId: z.union([id, z.literal("")]),
  earliest: time,
  latest: time,
  note: z.string().max(200, "Keep the note to 200 characters."),
});

async function attempt(run: () => Promise<unknown>): Promise<FormState | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function askForTimes(
  childId: string,
  path: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  await requireShell("family");
  if (!id.safeParse(childId).success) return { error: "That didn't work. Try again." };
  const weekdays = form
    .getAll("weekdays")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (weekdays.length === 0) return { error: "Choose at least one day." };
  const parsed = wishSchema.safeParse({
    levelId: String(form.get("levelId") ?? ""),
    locationId: String(form.get("locationId") ?? ""),
    earliest: String(form.get("earliest") ?? ""),
    latest: String(form.get("latest") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const db = await createClient();
  const failed = await attempt(() =>
    addWish(db, {
      childId,
      levelId: parsed.data.levelId || null,
      locationId: parsed.data.locationId || null,
      weekdays,
      earliest: parsed.data.earliest,
      latest: parsed.data.latest,
      note: parsed.data.note,
    }),
  );
  if (failed) return failed;
  revalidatePath(path);
  return { ok: "Sent to your activity provider. They'll be in touch when a place comes up." };
}

export async function withdrawRequest(wishId: string, path: string): Promise<FormState> {
  await requireShell("family");
  if (!id.safeParse(wishId).success) return { error: "That didn't work. Try again." };
  const db = await createClient();
  const failed = await attempt(() => withdrawWish(db, wishId));
  if (failed) return failed;
  revalidatePath(path);
  return { ok: "Request withdrawn." };
}

export async function placeChild(wishId: string, classId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(wishId).success || !id.safeParse(classId).success)
    return { error: "That didn't work. Try again." };
  const failed = await attempt(() => placeFromWish(db, wishId, classId));
  if (failed) return failed;
  const { data } = await db
    .from("place_wishes")
    .select("children (first_name)")
    .eq("id", wishId)
    .single();
  const name = (data?.children as { first_name: string } | null)?.first_name ?? "";
  revalidatePath("/business", "layout");
  redirect(`/business/demand?placed=${encodeURIComponent(name)}`);
}
