"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShell } from "@/lib/auth/viewer";
import { requireOwner } from "@/lib/business/owner";
import { DomainError } from "@/lib/domain/db";
import {
  answerPlaceOffer,
  offerPlace,
  setAutoPlaceOffers,
  withdrawPlaceOffer,
} from "@/lib/domain/place-offers";
import { getFamily } from "@/lib/domain/families";
import { inviteParent } from "@/lib/domain/invites";
import { addEnquiry, removeEnquiry, setWaitlistPage } from "@/lib/domain/waitlist-page";
import { addWish, placeFromWish, withdrawWish } from "@/lib/domain/wishes";
import * as messages from "@/lib/email/messages";
import { appUrl, emailOn, sendEmail } from "@/lib/email/transport";
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

// ------------------------------------------------------------------ place offers (M8c)

export async function offerPlaceTo(wishId: string, classId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(wishId).success || !id.safeParse(classId).success)
    return { error: "That didn't work. Try again." };
  const failed = await attempt(() => offerPlace(db, wishId, classId));
  if (failed) return failed;
  revalidatePath("/business/demand");
  return { ok: "Offered. The family has 48 hours to accept." };
}

export async function withdrawOffer(offerId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(offerId).success) return { error: "That didn't work. Try again." };
  const failed = await attempt(() => withdrawPlaceOffer(db, offerId));
  if (failed) return failed;
  revalidatePath("/business/demand");
  return { ok: "Offer withdrawn." };
}

export async function setAutoOffers(on: boolean): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const failed = await attempt(() => setAutoPlaceOffers(db, organisationId, on));
  if (failed) return failed;
  revalidatePath("/business/demand");
  return {
    ok: on
      ? "On. Free places will be offered to waiting families within a few minutes."
      : "Off. Nothing will be offered automatically.",
  };
}

export async function answerOffer(offerId: string, accept: boolean): Promise<FormState> {
  await requireShell("family");
  if (!id.safeParse(offerId).success) return { error: "That didn't work. Try again." };
  const db = await createClient();
  let enrolment: string | null = null;
  const failed = await attempt(async () => {
    enrolment = await answerPlaceOffer(db, offerId, accept);
  });
  if (failed) return failed;
  revalidatePath("/family", "layout");
  if (accept && !enrolment)
    return { error: "Sorry, that offer has lapsed. Your request is still open." };
  // The card goes once answered, so the answer shows on Home.
  redirect(`/family?offer=${accept ? "accepted" : "declined"}`);
}

// ------------------------------------------------------------------ the waiting-list page (M8d)

export async function setWaitlistPageOn(on: boolean): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const failed = await attempt(() => setWaitlistPage(db, organisationId, on));
  if (failed) return failed;
  revalidatePath("/business/demand");
  return {
    ok: on
      ? "On. Share the link below on your website."
      : "Off. The page no longer takes enquiries.",
  };
}

// Adds a new family's enquiry to the waiting list and invites the parent
// to Ovyko (by email when it's on), so places can be offered to them.
export async function addToWaitingList(enquiryId: string): Promise<FormState> {
  const { db, organisationName } = await requireOwner();
  if (!id.safeParse(enquiryId).success) return { error: "That didn't work. Try again." };
  let added: { familyId: string; email: string; joined: boolean } | null = null;
  const failed = await attempt(async () => {
    added = await addEnquiry(db, enquiryId);
  });
  if (failed || !added) return failed ?? { error: "That didn't work. Try again." };
  const { familyId, email, joined } = added;
  revalidatePath("/business", "layout");
  if (joined) return { ok: "Added. They're already in Ovyko, so places can be offered to them." };
  const invited = await attempt(async () => {
    const code = await inviteParent(db, familyId, email);
    if (emailOn()) {
      const family = await getFamily(db, familyId);
      await sendEmail(
        email,
        messages.invite({
          school: organisationName,
          family: family?.displayName ?? "",
          joinUrl: appUrl(`/join/${code}`),
        }),
      ).catch((error: unknown) => console.error("invite email failed", error));
    }
  });
  if (invited) return { ok: "Added. Invite them from the family's page." };
  return {
    ok: emailOn()
      ? "Added and invited by email. Once they join, places can be offered to them."
      : "Added and invited. Copy their invite link from the family's page.",
  };
}

export async function removeFromEnquiries(enquiryId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(enquiryId).success) return { error: "That didn't work. Try again." };
  const failed = await attempt(() => removeEnquiry(db, enquiryId));
  if (failed) return failed;
  revalidatePath("/business/demand");
  return { ok: "Removed." };
}
