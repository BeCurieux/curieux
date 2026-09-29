"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShell, requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { AVA_ID, LEVEL_SKILLS, PRIMARY_CLASS_ID } from "./data";
import { isCandidate, isDemoFamily, isDemoStaff, isMakeupOption } from "./service";
import { clearDemoState, readDemoState, writeDemoState } from "./state";

// The demo's only writes. A server action is a public endpoint, so each one
// checks who is calling and what they're allowed to change before touching
// the state, exactly as a real one would.

async function requireDemoFamily() {
  const viewer = await requireShell("family");
  if (!isDemoFamily(viewer)) redirect("/family");
}

async function requireDemoStaff(role: "owner" | "instructor") {
  const viewer = await requireShell(role === "owner" ? "business" : "instructor");
  if (!isDemoStaff(viewer, role)) redirect(role === "owner" ? "/business" : "/instructor");
}

const reasonSchema = z.string().trim().max(200);

export async function reportAbsence(formData: FormData) {
  await requireDemoFamily();
  const reason = reasonSchema.catch("").parse(formData.get("reason") ?? "");
  const state = await readDemoState();
  await writeDemoState({ ...state, absence: { reason } });
  revalidatePath("/", "layout");
  redirect("/family/makeups");
}

export async function bookMakeup(classId: string) {
  await requireDemoFamily();
  const state = await readDemoState();
  if (!state.absence || !isMakeupOption(classId)) redirect("/family/makeups");
  await writeDemoState({ ...state, makeupClassId: classId });
  revalidatePath("/", "layout");
  redirect("/family/makeups?booked=1");
}

// Attendance is demo until M3, and only for the demo's Wednesday class. The
// child must be in it, which is checked with the instructor's own access:
// row level security only shows them children they teach.
export async function markAttendance(childId: string, status: "present" | "absent") {
  await requireDemoStaff("instructor");
  if (!z.uuid().safeParse(childId).success) return;
  const db = await createClient();
  const { data } = await db
    .from("enrolments")
    .select("id")
    .eq("child_id", childId)
    .eq("class_id", PRIMARY_CLASS_ID)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return;
  const state = await readDemoState();
  await writeDemoState({ ...state, attendance: { ...state.attendance, [childId]: status } });
  revalidatePath("/", "layout");
}

const skillStatus = z.enum(["not_started", "developing", "achieved"]);

export async function saveSkills(childId: string, formData: FormData) {
  await requireDemoStaff("instructor");
  if (childId !== AVA_ID) redirect("/instructor");
  const state = await readDemoState();
  const skills = { ...state.skills };
  for (const skill of LEVEL_SKILLS) {
    const parsed = skillStatus.safeParse(formData.get(skill.name));
    if (parsed.success) skills[skill.name] = parsed.data;
  }
  await writeDemoState({ ...state, skills });
  revalidatePath("/", "layout");
  redirect("/instructor/child/ava?saved=1");
}

export async function offerSpot(candidateId: string) {
  await requireDemoStaff("owner");
  if (!isCandidate(candidateId)) return;
  const state = await readDemoState();
  if (!state.offered.includes(candidateId)) {
    await writeDemoState({ ...state, offered: [...state.offered, candidateId] });
  }
  revalidatePath("/", "layout");
}

export async function resetDemo() {
  await requireViewer();
  await clearDemoState();
  revalidatePath("/", "layout");
  redirect("/");
}
