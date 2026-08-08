"use server";

/**
 * Admin actions (§42).
 *
 * Approving is the interesting one: it moves the plan to READY and queues
 * delivery immediately if Thursday has already arrived, so review never
 * silently costs a customer their weekend.
 *
 * Every action writes an audit event. During the review cohort the record of
 * what a human rejected, and why, is the training data for turning review off.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, isAdmin, serviceClient } from "@/lib/supabase/server";
import { enqueue, planJobKey } from "@/lib/jobs/queue";
import { deliveryInstant } from "@/lib/util/time";
import { getMarket } from "@/config/markets";
import { sanitiseUserText } from "@/lib/security/sanitise";
import type { Plan } from "@/lib/types";

export interface AdminResult {
  ok: boolean;
  error?: string;
  message?: string;
}

async function requireAdmin(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  if (!(await isAdmin())) throw new Error("Not an admin");
  return user.id;
}

async function audit(
  actorId: string,
  action: string,
  subject: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await serviceClient().from("audit_events").insert({
    actor_id: actorId,
    action,
    subject,
    metadata,
  });
}

const planIdSchema = z.string().uuid();

export async function approvePlan(planId: string): Promise<AdminResult> {
  if (!planIdSchema.safeParse(planId).success) return { ok: false, error: "Invalid plan" };
  const actorId = await requireAdmin();
  const db = serviceClient();

  const { data } = await db.from("plans").select("*").eq("id", planId).maybeSingle();
  const plan = data as Plan | null;
  if (!plan) return { ok: false, error: "Plan not found" };

  // Approve the backup alongside the primary: they are one delivery.
  await db
    .from("plans")
    .update({ status: "READY" })
    .eq("household_id", plan.household_id)
    .eq("weekend_date", plan.weekend_date)
    .eq("status", "PENDING_REVIEW");

  const market = getMarket(plan.market_id);
  const scheduled = deliveryInstant(market, plan.weekend_date);
  // If Thursday has already passed while this sat in review, send it now
  // rather than scheduling it into the past.
  const runAfter = scheduled.getTime() < Date.now() ? new Date() : scheduled;

  await enqueue(
    db,
    "deliver-weekend-plan",
    { household_id: plan.household_id, weekend_date: plan.weekend_date },
    planJobKey("deliver-weekend-plan", plan.household_id, plan.weekend_date),
    runAfter
  );

  await audit(actorId, "plan.approved", planId, { weekend_date: plan.weekend_date });
  revalidatePath("/admin/queue");

  return {
    ok: true,
    message: runAfter.getTime() <= Date.now() ? "Approved — sending now." : "Approved for Thursday.",
  };
}

export async function regeneratePlan(planId: string, note: string): Promise<AdminResult> {
  if (!planIdSchema.safeParse(planId).success) return { ok: false, error: "Invalid plan" };
  const actorId = await requireAdmin();
  const db = serviceClient();

  const { data } = await db.from("plans").select("*").eq("id", planId).maybeSingle();
  const plan = data as Plan | null;
  if (!plan) return { ok: false, error: "Plan not found" };

  await db
    .from("plans")
    .update({ status: "REJECTED", swap_reason: sanitiseUserText(note, 300) || "admin_regenerate" })
    .eq("household_id", plan.household_id)
    .eq("weekend_date", plan.weekend_date)
    .in("status", ["PENDING_REVIEW", "READY"]);

  await enqueue(
    db,
    "generate-weekend-plan",
    { household_id: plan.household_id, weekend_date: plan.weekend_date, attempt: 1 },
    `admin-regen:${planId}:${Date.now()}`
  );

  await audit(actorId, "plan.regenerated", planId, { note: sanitiseUserText(note, 300) });
  revalidatePath("/admin/queue");

  return { ok: true, message: "Rebuilding." };
}

export async function rejectPlan(planId: string, note: string): Promise<AdminResult> {
  if (!planIdSchema.safeParse(planId).success) return { ok: false, error: "Invalid plan" };
  const actorId = await requireAdmin();
  const db = serviceClient();

  const reason = sanitiseUserText(note, 300);

  await db.from("plans").update({ status: "REJECTED", swap_reason: reason }).eq("id", planId);

  // A rejection with no replacement means a customer gets nothing this week,
  // so it is flagged rather than quietly dropped.
  const { data } = await db.from("plans").select("household_id").eq("id", planId).maybeSingle();
  if (data?.household_id) {
    await db.from("admin_flags").insert({
      household_id: data.household_id as string,
      plan_id: planId,
      reason: `Rejected in review: ${reason || "no reason given"}`,
    });
  }

  await audit(actorId, "plan.rejected", planId, { note: reason });
  revalidatePath("/admin/queue");

  return { ok: true, message: "Rejected and flagged." };
}
