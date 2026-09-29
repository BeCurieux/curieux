"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import * as enrolments from "@/lib/domain/enrolments";
import * as families from "@/lib/domain/families";
import * as staff from "@/lib/domain/staff";
import * as timetable from "@/lib/domain/timetable";
import {
  attempt,
  fieldErrors,
  formValues,
  optionalText,
  requiredText,
  type FormState,
} from "@/lib/forms";
import { requireOwner } from "./owner";

// Owners' writes. Each action checks the caller is an owner, validates the
// form, and calls a domain service with the owner's own database client, so
// row level security and the database's own rules (tenancy, capacity,
// duplicates) have the final say. Every change is audited by the database.

const id = z.uuid("Choose an option.");

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ locations

const locationSchema = z.object({
  name: requiredText(80, "Name"),
  addressLine1: optionalText(120, "Address"),
  suburb: optionalText(60, "Suburb"),
  state: optionalText(20, "State"),
  postcode: optionalText(10, "Postcode"),
  timezone: z.string().refine(validTimezone, "Choose a timezone."),
});

export async function saveLocation(
  locationId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = locationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    if (locationId) await timetable.updateLocation(db, locationId, parsed.data);
    else await timetable.createLocation(db, organisationId, parsed.data);
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  redirect("/business/settings/locations");
}

// ------------------------------------------------------------------ programs

export async function createProgram(_: FormState, formData: FormData): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = z
    .object({ name: requiredText(80, "Program name") })
    .safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    await timetable.createProgram(db, organisationId, parsed.data.name);
  });
  if (failed)
    return failed.error === "That already exists."
      ? { error: "You already have a program with that name." }
      : failed;
  revalidatePath("/business", "layout");
  return { ok: `Added ${parsed.data.name}.` };
}

export async function addLevel(
  programId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = z.object({ name: requiredText(60, "Level name") }).safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    await timetable.addLevel(db, organisationId, programId, parsed.data.name);
  });
  if (failed)
    return failed.error === "That already exists."
      ? { error: "That level already exists." }
      : failed;
  revalidatePath("/business", "layout");
  return { ok: `Added ${parsed.data.name}.` };
}

// ------------------------------------------------------------------ classes

const classSchema = z.object({
  name: requiredText(80, "Class name"),
  locationId: id,
  levelId: id,
  instructorId: z
    .uuid()
    .optional()
    .transform((v) => v ?? null),
  weekday: z.coerce
    .number({ error: "Choose a day." })
    .int()
    .min(1, "Choose a day.")
    .max(7, "Choose a day."),
  startTime: z
    .string({ error: "Enter a start time." })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 16:30."),
  durationMinutes: z.coerce
    .number({ error: "Enter a length." })
    .int()
    .min(5, "At least 5 minutes.")
    .max(480, "At most 8 hours."),
  capacity: z.coerce
    .number({ error: "Enter a capacity." })
    .int()
    .min(1, "At least 1 place.")
    .max(200, "At most 200 places."),
});

export async function saveClass(
  classId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = classSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  // The level decides the program, so the two can't disagree.
  const programs = await timetable.listPrograms(db);
  const program = programs.find((p) => p.levels.some((l) => l.id === parsed.data.levelId));
  if (!program) return { error: "Choose a level.", fieldErrors: { levelId: "Choose a level." } };

  const input = { ...parsed.data, programId: program.id };
  let savedId = classId;
  const failed = await attempt(async () => {
    if (classId) await timetable.updateClass(db, classId, input);
    else savedId = await timetable.createClass(db, organisationId, input);
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  redirect(`/business/classes/${savedId}`);
}

export async function setClassActive(classId: string, active: boolean) {
  const { db } = await requireOwner();
  await timetable.setClassActive(db, classId, active);
  revalidatePath("/business", "layout");
}

// ------------------------------------------------------------------ families

const familySchema = z.object({
  displayName: requiredText(80, "Family name"),
  contactName: optionalText(80, "Contact name"),
  contactEmail: z
    .email("Enter a valid email.")
    .max(120)
    .optional()
    .transform((v) => v ?? null),
  contactPhone: optionalText(30, "Phone"),
});

export async function saveFamily(
  familyId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = familySchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  let savedId = familyId;
  const failed = await attempt(async () => {
    if (familyId) await families.updateFamily(db, familyId, parsed.data);
    else savedId = await families.createFamily(db, organisationId, parsed.data);
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  redirect(`/business/families/${savedId}`);
}

const childSchema = z.object({
  firstName: requiredText(60, "First name"),
  lastName: requiredText(60, "Last name"),
  dateOfBirth: z.iso
    .date("Enter a date of birth.")
    .refine((d) => new Date(d) < new Date(), "Date of birth must be in the past.")
    .refine(
      (d) => new Date(d).getFullYear() > new Date().getFullYear() - 19,
      "Ovyko is for children under 19.",
    ),
});

export async function saveChild(
  familyId: string,
  childId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db } = await requireOwner();
  const parsed = childSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    if (childId) await families.updateChild(db, childId, parsed.data);
    else await families.addChild(db, familyId, parsed.data);
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  redirect(`/business/families/${familyId}`);
}

// ------------------------------------------------------------------ enrolments

export async function enrolChild(
  classId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = z.object({ childId: id }).safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    await enrolments.enrol(db, { organisationId, childId: parsed.data.childId, classId });
  });
  if (failed)
    return failed.error === "That already exists."
      ? { error: "That child is already in this class." }
      : failed;
  revalidatePath("/business", "layout");
  return { ok: "Enrolled." };
}

export async function endEnrolment(enrolmentId: string) {
  const { db } = await requireOwner();
  await enrolments.endEnrolment(db, enrolmentId);
  revalidatePath("/business", "layout");
}

// ------------------------------------------------------------------ staff

export async function removeStaffMember(membershipId: string): Promise<FormState> {
  const { db } = await requireOwner();
  const failed = await attempt(() => staff.removeStaffMember(db, z.uuid().parse(membershipId)));
  if (failed) return failed;
  revalidatePath("/business", "layout");
  return { ok: "Access removed. They've been signed out." };
}

export async function restoreStaffMember(membershipId: string): Promise<FormState> {
  const { db } = await requireOwner();
  const failed = await attempt(() => staff.restoreStaffMember(db, z.uuid().parse(membershipId)));
  if (failed) return failed;
  revalidatePath("/business", "layout");
  return { ok: "Access restored." };
}
