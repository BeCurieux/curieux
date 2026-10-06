"use server";

import { z } from "zod";
import { DomainError } from "@/lib/domain/db";
import { joinSchoolWaitlist } from "@/lib/domain/waitlist-page";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// A new family joining one school's waiting list from its public page
// (docs/M8_NETWORK.md, M8d). The database checks everything again.

const id = z.union([z.uuid(), z.literal("")]);
const time = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time.");

const schema = z.object({
  parentName: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.email("Check your email address.").max(254),
  phone: z.string().trim().max(30),
  childFirstName: z.string().trim().min(1, "Enter your child's first name.").max(60),
  childLastName: z.string().trim().min(1, "Enter your child's last name.").max(60),
  dateOfBirth: z.iso.date("Enter your child's date of birth."),
  levelId: id,
  locationId: id,
  earliest: time,
  latest: time,
  note: z.string().trim().max(200, "Keep the note to 200 characters."),
  consent: z.literal("yes", { error: "Tick the box so the school can keep your details." }),
});

export async function joinSchool(slug: string, _: FormState, form: FormData): Promise<FormState> {
  // A field people can't see: anything in it is a bot. Say it worked.
  if (String(form.get("website") ?? "") !== "") return { ok: "joined" };
  const get = (k: string) => String(form.get(k) ?? "");
  const weekdays = form
    .getAll("weekdays")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (weekdays.length === 0) return { error: "Choose at least one day that works." };
  const parsed = schema.safeParse({
    parentName: get("parentName"),
    email: get("email").trim(),
    phone: get("phone"),
    childFirstName: get("childFirstName"),
    childLastName: get("childLastName"),
    dateOfBirth: get("dateOfBirth"),
    levelId: get("levelId"),
    locationId: get("locationId"),
    earliest: get("earliest"),
    latest: get("latest"),
    note: get("note"),
    consent: get("consent"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  try {
    await joinSchoolWaitlist(await createClient(), slug.slice(0, 80), {
      parentName: d.parentName,
      email: d.email,
      phone: d.phone || null,
      childFirstName: d.childFirstName,
      childLastName: d.childLastName,
      dateOfBirth: d.dateOfBirth,
      levelId: d.levelId || null,
      locationId: d.locationId || null,
      weekdays,
      earliest: d.earliest,
      latest: d.latest,
      note: d.note || null,
    });
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  return { ok: "joined" };
}
