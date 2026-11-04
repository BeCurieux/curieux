"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/session";
import { refundOrder } from "@/lib/commerce/orders";
import { sendEmail } from "@/lib/email/send";
import { serviceClient } from "@/lib/supabase/server";

// Admin actions. Each checks the admins table again on the server before
// using the service role: the page being hidden isn't the protection.

async function mustBeAdmin() {
  if (!(await isAdmin())) redirect("/learn");
}

/**
 * Refund any order, at any time (SPEC.md → Refund policy: after 14 days the
 * admin can still refund manually). The same refundOrder as the account
 * page: Stripe first, then the webhook's own recording, then the refund
 * confirmation email.
 */
export async function adminRefund(form: FormData): Promise<void> {
  await mustBeAdmin();
  const id = z.uuid().safeParse(form.get("orderId"));
  const back = `/admin?tab=buyers${form.get("q") ? `&q=${encodeURIComponent(String(form.get("q")))}` : ""}`;
  if (!id.success) redirect(`${back}&refund=error`);
  try {
    await refundOrder(id.data);
  } catch (error) {
    console.error("admin refund", id.data, error instanceof Error ? error.message : error);
    redirect(`${back}&refund=error`);
  }
  revalidatePath("/admin");
  redirect(`${back}&refund=done`);
}

const review = z.object({
  verdictId: z.uuid(),
  review: z.string().trim().min(1, "Write the review first.").max(20_000),
});

/** The founder's written review of a founding member's verdict: saved, then emailed to her. */
export async function sendReview(form: FormData): Promise<void> {
  await mustBeAdmin();
  const parsed = review.safeParse({ verdictId: form.get("verdictId"), review: form.get("review") });
  if (!parsed.success) redirect("/admin?tab=cohort&review=empty");
  const db = serviceClient();
  const { data: verdict, error } = await db
    .from("verdicts")
    .update({ review_md: parsed.data.review, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.verdictId)
    .not("submitted_at", "is", null)
    .is("reviewed_at", null)
    .select("id, user_id, product_name")
    .maybeSingle();
  if (error || !verdict) {
    console.error("send review", parsed.data.verdictId, error?.message ?? "not waiting for review");
    redirect("/admin?tab=cohort&review=error");
  }
  const { data: profile } = await db
    .from("profiles")
    .select("email")
    .eq("user_id", verdict.user_id)
    .maybeSingle();
  if (profile?.email)
    await sendEmail(
      "review_ready",
      `review_ready:${verdict.id}`,
      { userId: verdict.user_id, email: profile.email },
      {
        product: verdict.product_name,
      },
    );
  revalidatePath("/admin");
  revalidatePath("/verdict");
  redirect("/admin?tab=cohort&review=sent");
}
