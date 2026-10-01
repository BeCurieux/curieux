"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import * as enrolments from "@/lib/domain/enrolments";
import * as families from "@/lib/domain/families";
import * as fill from "@/lib/domain/fill";
import * as imports from "@/lib/domain/imports";
import * as invites from "@/lib/domain/invites";
import * as messages from "@/lib/email/messages";
import { appUrl, emailOn, sendEmail } from "@/lib/email/transport";
import * as makeups from "@/lib/domain/makeups";
import * as privacy from "@/lib/domain/privacy";
import * as progress from "@/lib/domain/progress";
import * as safety from "@/lib/domain/safety";
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
import { createAdminClient } from "@/lib/supabase/admin";
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

// ------------------------------------------------------------------ skills

export async function addSkill(
  levelId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = z
    .object({ name: requiredText(60, "Skill name"), hint: optionalText(200, "Description") })
    .safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    await progress.addSkill(db, { organisationId, levelId, ...parsed.data });
  });
  if (failed)
    return failed.error === "That already exists."
      ? { error: "This level already has that skill." }
      : failed;
  revalidatePath("/", "layout");
  return { ok: `Added ${parsed.data.name}.` };
}

export async function removeSkill(skillId: string) {
  const { db } = await requireOwner();
  if (!z.uuid().safeParse(skillId).success) return;
  await attempt(() => progress.removeSkill(db, skillId));
  revalidatePath("/", "layout");
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

// ------------------------------------------------------------------ make-ups

const yesNo = z.enum(["yes", "no"], "Choose yes or no.").transform((v) => v === "yes");
const whole = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Enter ${label}.` })
    .int(`Use a whole number for ${label}.`)
    .min(min, `${label[0]!.toUpperCase()}${label.slice(1)} must be at least ${min}.`)
    .max(max, `${label[0]!.toUpperCase()}${label.slice(1)} can be at most ${max}.`);

// How long each family has to answer an automatic offer, in minutes.
const HOLD_OPTIONS = [30, 60, 120, 240, 720, 1440];

const policySchema = z.object({
  makeupsEnabled: yesNo,
  noticeHours: whole("the notice", 0, 168),
  creditValidityDays: whole("how long a credit lasts", 1, 365),
  maxActiveCredits: whole("the most credits", 1, 20),
  bookingHorizonDays: whole("the booking window", 1, 90),
  cancellationNoticeHours: whole("the cancellation notice", 0, 168),
  allowFutureLevel: yesNo,
  autoOffer: yesNo,
  offerHoldMinutes: z.coerce
    .number()
    .refine((m) => HOLD_OPTIONS.includes(m), "Choose how long each family has."),
});

export async function saveMakeupPolicy(_: FormState, formData: FormData): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = policySchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const p = parsed.data;
  const failed = await attempt(async () => {
    await makeups.savePolicy(db, organisationId, {
      makeupsEnabled: p.makeupsEnabled,
      minimumNoticeMinutes: p.noticeHours * 60,
      creditValidityDays: p.creditValidityDays,
      maxActiveCredits: p.maxActiveCredits,
      allowFutureLevel: p.allowFutureLevel,
      bookingHorizonDays: p.bookingHorizonDays,
      cancellationNoticeMinutes: p.cancellationNoticeHours * 60,
      returnCreditOnValidCancellation: true,
      autoOffer: p.autoOffer,
      offerHoldMinutes: p.offerHoldMinutes,
    });
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  revalidatePath("/family", "layout");
  return { ok: "Saved. The new rules apply from the next absence." };
}

const cancelSchema = z.object({
  locationId: id,
  date: z.iso.date("Choose a date."),
});

export async function cancelLessons(_: FormState, formData: FormData): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  let count = 0;
  const failed = await attempt(async () => {
    count = await makeups.cancelLessons(db, parsed.data);
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  revalidatePath("/family", "layout");
  revalidatePath("/instructor", "layout");
  if (count === 0) return { error: "There are no upcoming lessons there on that day." };
  const { makeupsEnabled } = await makeups.getPolicy(db, organisationId);
  const lessons = `${count} ${count === 1 ? "lesson" : "lessons"}`;
  return {
    ok: makeupsEnabled
      ? `Cancelled ${lessons}. Every child has a make-up credit and their families have been told.`
      : `Cancelled ${lessons}. Their families have been told.`,
  };
}

// ------------------------------------------------------------------ fill empty spots

// Offers an open spot to a child's family. The database checks the spot is
// still open and the child's credit fits, and tells the family.
export async function offerSpot(occurrenceId: string, childId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(occurrenceId).success || !id.safeParse(childId).success)
    return { error: "That didn't work. Try again." };
  const failed = await attempt(async () => {
    await fill.offerSpot(db, { occurrenceId, childId });
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  return { ok: "Offered" };
}

// Shows what cancelling a day would do, then does it once confirmed.
export async function previewCancelLessons(
  _: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const { db } = await requireOwner();
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const out: { preview?: fill.CancelPreview } = {};
  const failed = await attempt(async () => {
    out.preview = await fill.previewCancelLessons(db, parsed.data);
  });
  if (failed) return failed;
  if (!out.preview || out.preview.lessons === 0)
    return { error: "There are no upcoming lessons there on that day." };
  return { preview: out.preview, ...parsed.data };
}

export type CancelState = FormState & {
  preview?: fill.CancelPreview;
  locationId?: string;
  date?: string;
};

// ------------------------------------------------------------------ moving a school in

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportState = FormState & {
  report?: imports.ImportReport;
  // The rows checked, sent back unchanged to be saved once confirmed. The
  // database checks them again when saving.
  rows?: string;
};

async function readUpload(formData: FormData, name: string) {
  const file = formData.get(name);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) throw new Error("too_big");
  return { name: file.name, text: await file.text() };
}

// Reads the school's files and checks them: what would be added, what's
// already here, and every row that can't come across. Saves nothing.
export async function checkImport(_: ImportState, formData: FormData): Promise<ImportState> {
  const { db, organisationId } = await requireOwner();
  let classesFile, studentsFile;
  try {
    classesFile = await readUpload(formData, "classes");
    studentsFile = await readUpload(formData, "students");
  } catch {
    return { error: "Each file must be smaller than 2 MB." };
  }
  if (!classesFile && !studentsFile)
    return { error: "Choose a classes file, a students file or both." };
  for (const f of [classesFile, studentsFile])
    if (f && !/\.csv$/i.test(f.name))
      return { error: `"${f.name}" isn't a CSV file. Export it as CSV and try again.` };

  const out: ImportState = {};
  const failed = await attempt(async () => {
    const classes = classesFile
      ? imports.readClasses(classesFile.text)
      : { rows: [], problems: [] };
    const students = studentsFile
      ? imports.readStudents(studentsFile.text)
      : { rows: [], problems: [] };
    const input: imports.ImportRows = {
      classes: classes.rows,
      students: students.rows,
      fileNames: [classesFile?.name, studentsFile?.name].filter((n): n is string => Boolean(n)),
      readProblems: [...classes.problems, ...students.problems],
    };
    out.report = await imports.importSchool(db, organisationId, input, false);
    out.rows = JSON.stringify(input);
  });
  if (failed) return failed;
  return out;
}

const importRowsSchema = z.object({
  classes: z.array(z.record(z.string(), z.unknown())).max(imports.MAX_ROWS),
  students: z.array(z.record(z.string(), z.unknown())).max(imports.MAX_ROWS),
  fileNames: z.array(z.string().max(200)).max(2),
  readProblems: z
    .array(
      z.object({ file: z.enum(["classes", "students"]), row: z.number(), message: z.string() }),
    )
    .max(imports.MAX_ROWS * 2),
});

// Saves what was checked, all at once, then opens the import's page.
export async function confirmImport(_: FormState, formData: FormData): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  let parsed;
  try {
    parsed = importRowsSchema.safeParse(JSON.parse(String(formData.get("rows") ?? "")));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) return { error: "That didn't work. Check the files again." };
  let batchId: string | null = null;
  const failed = await attempt(async () => {
    const report = await imports.importSchool(
      db,
      organisationId,
      parsed.data as unknown as imports.ImportRows,
      true,
    );
    batchId = report.batchId;
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  redirect(`/business/settings/import/${batchId}`);
}

export async function undoImport(batchId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(batchId).success) return { error: "That didn't work. Try again." };
  const failed = await attempt(async () => {
    await imports.undoImport(db, batchId);
  });
  if (failed) return failed;
  revalidatePath("/business", "layout");
  return { ok: "Undone. Everything this import added has been removed." };
}

// ------------------------------------------------------------------ inviting parents

export type InviteState = FormState & { code?: string; email?: string; emailed?: boolean };

const inviteSchema = z.object({
  familyId: id,
  email: z.email("Enter a real email address.").max(254, "That email is too long."),
});

// Makes an invite link for a parent. The code is shown once, here.
export async function inviteParent(_: InviteState, formData: FormData): Promise<InviteState> {
  const { db, organisationName } = await requireOwner();
  const parsed = inviteSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const out: InviteState = {};
  const failed = await attempt(async () => {
    out.code = await invites.inviteParent(db, parsed.data.familyId, parsed.data.email);
  });
  if (failed) return failed;
  revalidatePath(`/business/families/${parsed.data.familyId}`);
  const email = parsed.data.email.toLowerCase();
  // Emailed straight away when email is on (M6c); the owner can still copy
  // the link. A failed email doesn't undo the invite.
  let emailed = false;
  if (emailOn() && out.code) {
    const family = await families.getFamily(db, parsed.data.familyId);
    try {
      await sendEmail(
        email,
        messages.invite({
          school: organisationName,
          family: family?.displayName ?? "",
          joinUrl: appUrl(`/join/${out.code}`),
        }),
      );
      emailed = true;
    } catch (error) {
      console.error("invite email failed", error);
    }
  }
  return { ...out, email, emailed };
}

export async function revokeInvite(inviteId: string, familyId: string): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(inviteId).success || !id.safeParse(familyId).success)
    return { error: "That didn't work. Try again." };
  const failed = await attempt(async () => {
    await invites.revokeInvite(db, inviteId);
  });
  if (failed) return failed;
  revalidatePath(`/business/families/${familyId}`);
  return { ok: "Invite cancelled." };
}

// Health notes and pickup restrictions (M6d). The database decides who may
// write them and audits every change.

const healthSchema = z.object({
  familyId: id,
  childId: id,
  allergies: optionalText(1000, "Allergies"),
  medicalNotes: optionalText(2000, "Medical notes"),
});

export async function saveChildHealth(_: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireOwner();
  const parsed = healthSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(() => safety.saveChildHealth(db, parsed.data.childId, parsed.data));
  if (failed) return failed;
  revalidatePath(`/business/families/${parsed.data.familyId}`, "layout");
  return { ok: "Health notes saved." };
}

const restrictionSchema = z.object({
  familyId: id,
  childId: id,
  personName: requiredText(120, "Name"),
  kind: z.enum(["no_collect", "no_contact"], "Choose what isn't allowed."),
  details: optionalText(2000, "Details"),
});

export async function addRestriction(_: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireOwner();
  const parsed = restrictionSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const failed = await attempt(async () => {
    await safety.addRestriction(db, parsed.data.childId, parsed.data);
  });
  if (failed) return failed;
  revalidatePath(`/business/families/${parsed.data.familyId}`, "layout");
  return { ok: `Added. Instructors will see a warning about ${parsed.data.personName}.` };
}

export async function removeRestriction(
  restrictionId: string,
  familyId: string,
): Promise<FormState> {
  const { db } = await requireOwner();
  if (!id.safeParse(restrictionId).success || !id.safeParse(familyId).success)
    return { error: "That didn't work. Try again." };
  const failed = await attempt(() => safety.removeRestriction(db, restrictionId));
  if (failed) return failed;
  revalidatePath(`/business/families/${familyId}`, "layout");
  return { ok: "Restriction removed." };
}

// Deleting a family on request (M6d). The database deletes and audits; the
// server then removes sign-in accounts of parents who now belong nowhere.
export type DeleteFamilyState = FormState & { confirm?: string };

export async function deleteFamily(
  _: DeleteFamilyState,
  formData: FormData,
): Promise<DeleteFamilyState> {
  const { db } = await requireOwner();
  const familyId = String(formData.get("familyId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!id.safeParse(familyId).success) return { error: "That didn't work. Try again." };
  let leaving: string[] = [];
  const failed = await attempt(async () => {
    leaving = await privacy.deleteFamily(db, familyId, confirm);
  });
  if (failed) return { ...failed, confirm };
  const admin = createAdminClient();
  for (const authId of leaving) {
    const { error } = await admin.auth.admin.deleteUser(authId);
    if (error) console.error("removing a deleted family's parent account failed", error);
  }
  revalidatePath("/business/families");
  redirect("/business/families?deleted=1");
}
