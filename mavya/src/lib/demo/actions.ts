"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShell, requireViewer } from "@/lib/auth/viewer";
import { isCandidate, isDemoFamily, isDemoStaff, isMakeupOption } from "./service";
import { clearDemoState, readDemoState, writeDemoState } from "./state";

// The demo's only writes. A server action is a public endpoint, so each one
// checks who is calling and what they're allowed to change before touching
// the state, exactly as a real one would.

async function requireDemoFamily() {
  const viewer = await requireShell("family");
  if (!isDemoFamily(viewer)) redirect("/family");
}

async function requireDemoOwner() {
  const viewer = await requireShell("business");
  if (!isDemoStaff(viewer, "owner")) redirect("/business");
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

export async function offerSpot(candidateId: string) {
  await requireDemoOwner();
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
