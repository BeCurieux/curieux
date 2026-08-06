// Running the renewals.
//
// Two passes, both idempotent, both driven by the daily sweep.
//
//   announce  — a renewal is due; tell them the date and the amount, and
//               remind them once more a few days out.
//   collect   — the date has arrived; decide, then charge or don't.
//
// decideRenewal() in policy.ts holds every decision about whether to take
// someone's money, so this file is only the plumbing around it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { chargeSavedCard, PRICES } from "@/lib/stripe";
import { enqueue } from "@/lib/jobs/queue";
import { sendOnce } from "@/lib/email/send";
import {
  renewalPaymentFailed, renewalReminder, renewalScheduled, renewalSkipped,
} from "@/lib/email/messages";
import {
  REMINDER_DAYS, daysUntil, decideRenewal, isReminderDay,
} from "./policy";
import { friendlyDate } from "@/lib/words";
import { bookPriceFor } from "@/lib/billing/price";

interface Owner { userId: string; email: string }

/** Announce a scheduled renewal, and remind once as the date approaches. */
export async function announceRenewals(
  db: SupabaseClient,
  now: Date,
  ownerOf: (familyId: string) => Promise<Owner | null>
): Promise<void> {
  const { data: due } = await db
    .from("renewals")
    .select("*, subjects(display_name, family_id), books(id, title)")
    .eq("status", "scheduled");

  for (const r of (due ?? []) as any[]) {
    const subject = r.subjects;
    const book = r.books;
    if (!subject || !book) continue;

    const owner = await ownerOf(subject.family_id);
    if (!owner) continue;

    const due = await bookPriceFor(db, subject.family_id);

    const { data: profile } = await db
      .from("profiles")
      .select("card_last4")
      .eq("id", owner.userId)
      .maybeSingle();

    if (!r.announced_at) {
      const sent = await sendOnce(db, {
        kind: "renewal_scheduled",
        dedupeKey: `renewal_scheduled-${r.id}`,
        userId: owner.userId,
        subjectId: r.subject_id,
        message: renewalScheduled({
          to: { email: owner.email },
          childName: subject.display_name,
          bookTitle: book.title,
          bookId: book.id,
          renewalId: r.id,
          amountAud: due.amountAud,
          chargeOn: friendlyDate(r.scheduled_for, now),
          cardLast4: profile?.card_last4,
        }),
      });
      // Only recorded as announced if it actually went. An unannounced
      // charge must never happen because a mail provider had a bad day.
      if (sent.sent) {
        await db.from("renewals").update({ announced_at: now.toISOString() }).eq("id", r.id);
      }
      continue;
    }

    if (!r.reminded_at && isReminderDay(new Date(r.scheduled_for), now)) {
      const sent = await sendOnce(db, {
        kind: "renewal_reminder",
        dedupeKey: `renewal_reminder-${r.id}`,
        userId: owner.userId,
        subjectId: r.subject_id,
        message: renewalReminder({
          to: { email: owner.email },
          bookTitle: book.title,
          bookId: book.id,
          renewalId: r.id,
          amountAud: due.amountAud,
          days: Math.max(1, daysUntil(new Date(r.scheduled_for), now) || REMINDER_DAYS),
        }),
      });
      if (sent.sent) {
        await db.from("renewals").update({ reminded_at: now.toISOString() }).eq("id", r.id);
      }
    }
  }
}

/** Charge what is due, having decided it should be charged at all. */
export async function collectRenewals(
  db: SupabaseClient,
  now: Date,
  ownerOf: (familyId: string) => Promise<Owner | null>
): Promise<void> {
  const { data: due } = await db
    .from("renewals")
    .select("*, subjects(display_name, family_id), books(id, title)")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString());

  for (const r of (due ?? []) as any[]) {
    const subject = r.subjects;
    const book = r.books;
    if (!subject || !book) continue;

    const owner = await ownerOf(subject.family_id);
    if (!owner) continue;

    const { data: profile } = await db
      .from("profiles")
      .select("stripe_customer_id, default_payment_method_id")
      .eq("id", owner.userId)
      .maybeSingle();

    const { count: approved } = await db
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", r.subject_id)
      .eq("contribution_status", "approved");

    const decision = decideRenewal(
      {
        status: r.status,
        scheduledFor: new Date(r.scheduled_for),
        approvedMemories: approved ?? 0,
        estimatedPages: book.page_count ?? 0,
        hasSavedCard: !!profile?.default_payment_method_id,
      },
      now
    );

    // A charge must never happen before the notice it promised.
    if (!r.announced_at) continue;

    if (!decision.proceed) {
      if (decision.reason === "too_thin") {
        await db
          .from("renewals")
          .update({ status: "skipped", skipped_reason: "not enough kept this year" })
          .eq("id", r.id);
        await sendOnce(db, {
          kind: "renewal_skipped",
          dedupeKey: `renewal_skipped-${r.id}`,
          userId: owner.userId,
          subjectId: r.subject_id,
          message: renewalSkipped({
            to: { email: owner.email },
            childName: subject.display_name,
            subjectId: r.subject_id,
          }),
        });
      }
      continue;
    }

    // A monthly member has already paid for this book across the year.
    // The year still closes and the book still goes to print — no card is
    // touched, and months_paid_this_year resets so the next year is judged
    // on its own months rather than on a total that only ever grows.
    const due = await bookPriceFor(db, subject.family_id);

    if (due.plan === "monthly" && due.amountAud === 0) {
      await db
        .from("renewals")
        .update({ status: "included", charged_at: now.toISOString(), amount_aud: 0 })
        .eq("id", r.id);
      await db
        .from("families")
        .update({ months_paid_this_year: 0 })
        .eq("id", subject.family_id);

      const { data: includedOrder } = await db
        .from("print_orders")
        .select("id")
        .eq("book_id", book.id)
        .eq("status", "draft")
        .maybeSingle();
      if (includedOrder) {
        await enqueue(db, "submit_print", { print_order_id: includedOrder.id }, `submit-${includedOrder.id}`);
      }
      continue;
    }

    const result = await chargeSavedCard({
      customerId: profile!.stripe_customer_id!,
      paymentMethodId: profile!.default_payment_method_id!,
      amountAud: due.amountAud,
      description: `${book.title} — annual volume`,
      // The renewal id, so a retried job cannot charge twice.
      idempotencyKey: `renewal-${r.id}`,
      metadata: { renewal_id: r.id, book_id: book.id },
    });

    if (result.ok) {
      await db
        .from("renewals")
        .update({
          status: "charged",
          charged_at: now.toISOString(),
          amount_aud: due.amountAud,
          payment_intent_id: result.paymentIntentId,
        })
        .eq("id", r.id);

      const { data: order } = await db
        .from("print_orders")
        .select("id")
        .eq("book_id", book.id)
        .eq("status", "draft")
        .maybeSingle();
      if (order) await enqueue(db, "submit_print", { print_order_id: order.id }, `submit-${order.id}`);
      continue;
    }

    await db
      .from("renewals")
      .update({ status: "failed", failure_reason: result.message })
      .eq("id", r.id);

    await sendOnce(db, {
      kind: "renewal_payment_failed",
      dedupeKey: `renewal_failed-${r.id}`,
      userId: owner.userId,
      subjectId: r.subject_id,
      message: renewalPaymentFailed({
        to: { email: owner.email },
        bookTitle: book.title,
        bookId: book.id,
        needsAuthentication: result.reason === "needs_authentication",
      }),
    });
  }
}
