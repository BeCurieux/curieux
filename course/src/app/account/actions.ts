"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { refundOrder } from "@/lib/commerce/orders";
import { suppress, unsuppress } from "@/lib/email/suppress";
import { refundable } from "@/lib/commerce/plan";
import { userClient } from "@/lib/supabase/server";

// Self-serve refund (SPEC.md → Refund policy in code): her own order, paid,
// within 14 days of purchase, no reason asked. Both checks happen here on
// the server; the button only appears when they pass.
export async function requestRefund(form: FormData): Promise<void> {
  const id = z.uuid().safeParse(form.get("orderId"));
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  if (!id.success) redirect("/account?refund=error");

  // Row level security: she can only read her own orders.
  const { data: order } = await (
    await userClient()
  )
    .from("orders")
    .select("id, status, created_at")
    .eq("id", id.data)
    .maybeSingle<{ id: string; status: string; created_at: string }>();
  if (!order || !refundable(order)) redirect("/account?refund=error");

  try {
    await refundOrder(order.id);
  } catch (error) {
    console.error("refund", order.id, error instanceof Error ? error.message : error);
    redirect("/account?refund=error");
  }
  revalidatePath("/account");
  revalidatePath("/learn");
  redirect("/account?refund=done");
}

// Email preferences (SPEC.md → /account): course tips and reminders on or
// off. Receipts and sign-in links aren't affected.
export async function setMarketingEmails(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user?.email) redirect("/login?next=/account");
  const on = form.get("marketing") === "on";
  const ok = on ? await unsuppress(user.email) : await suppress(user.email);
  revalidatePath("/account");
  redirect(ok ? `/account?emails=${on ? "on" : "off"}` : "/account?emails=error");
}
