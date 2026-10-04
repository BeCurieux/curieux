import "server-only";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney } from "@/lib/domain/accounts";
import { shortDate } from "@/lib/domain/terms";
import { dayName, formatTime, lessonMoment } from "@/lib/format";
import * as messages from "./messages";
import { appUrl, EmailOff, sendEmail } from "./transport";

// Sends what's waiting in the outbox (docs/M6_MIGRATION_PILOT.md, M6c). Runs
// with the secret key, called by the database's schedule through
// /api/email/deliver. Each email is built from the database as it is now: an
// offer already taken, or a reminder for a lesson since cancelled, isn't sent.

type Admin = SupabaseClient<Database>;
type Delivery = Database["public"]["Tables"]["email_deliveries"]["Row"];
type Outcome = "sent" | "skipped" | "failed";

export async function deliverPending(admin: Admin, limit = 50) {
  const { data, error } = await admin.rpc("claim_email_deliveries", { p_limit: limit });
  if (error) throw error;
  const tally: Record<Outcome, number> = { sent: 0, skipped: 0, failed: 0 };
  for (const delivery of data ?? []) {
    let outcome: Outcome;
    let providerId: string | null = null;
    let reason: string | null = null;
    try {
      const built = await build(admin, delivery);
      if (!built) {
        outcome = "skipped";
        reason = "Nothing to send any more.";
      } else {
        providerId = await sendEmail(built.to, built.email);
        outcome = "sent";
      }
    } catch (e) {
      outcome = e instanceof EmailOff ? "skipped" : "failed";
      reason = e instanceof Error ? e.message : String(e);
    }
    const { error: finishError } = await admin.rpc("finish_email_delivery", {
      p_id: delivery.id,
      p_outcome: outcome,
      p_provider_id: providerId ?? undefined,
      p_error: reason ?? undefined,
    });
    if (finishError) throw finishError;
    tally[outcome] += 1;
  }
  return tally;
}

// A query's row (or null), throwing on a database error.
function one<R extends { data: unknown; error: unknown }>(
  result: R,
): NonNullable<R["data"]> | null {
  if (result.error) throw result.error;
  return (result.data ?? null) as NonNullable<R["data"]> | null;
}

async function build(
  admin: Admin,
  d: Delivery,
): Promise<{ to: string; email: messages.Email } | null> {
  const recipient = one(
    await admin
      .from("users")
      .select("email, lesson_reminders")
      .eq("id", d.recipient_user_id)
      .maybeSingle(),
  );
  if (!recipient?.email) return null;
  const org = d.organisation_id
    ? one(
        await admin
          .from("organisations")
          .select("name, activity_type, timezone")
          .eq("id", d.organisation_id)
          .maybeSingle(),
      )
    : null;
  const school = org?.name ?? "";
  const notification = d.notification_id
    ? one(
        await admin
          .from("notifications")
          .select("payload_json")
          .eq("id", d.notification_id)
          .maybeSingle(),
      )
    : null;
  const payload = (notification?.payload_json ?? {}) as {
    offer_id?: string;
    occurrence_id?: string;
    code?: string;
  };
  const to = recipient.email;

  switch (d.kind) {
    case "spot_offered": {
      if (!payload.offer_id || !payload.code) return null;
      const offer = one(
        await admin
          .from("vacancy_offers")
          .select("status, expires_at")
          .eq("id", payload.offer_id)
          .maybeSingle(),
      );
      // Taken, declined or run out since: nothing to tell.
      if (!offer || offer.status !== "offered" || new Date(offer.expires_at) <= new Date())
        return null;
      const until = lessonMoment(offer.expires_at, org?.timezone ?? "Australia/Sydney");
      return {
        to,
        email: messages.spotOffered({
          school,
          heldUntil: `${until.time} ${until.date}`,
          claimUrl: appUrl(`/family/claim/${payload.code}`),
        }),
      };
    }
    case "lesson_cancelled": {
      if (!payload.occurrence_id) return null;
      const lesson = await lessonTime(admin, payload.occurrence_id);
      if (!lesson) return null;
      const when = lessonMoment(lesson.startsAt, lesson.timezone);
      return {
        to,
        email: messages.lessonCancelled({
          school,
          day: `${when.day} ${when.date.split(" ").slice(1).join(" ")}`,
          url: appUrl("/family/messages"),
        }),
      };
    }
    case "skill_achieved":
      return { to, email: messages.skillAchieved({ school, url: appUrl("/family/messages") }) };
    case "lesson_reminder": {
      if (!recipient.lesson_reminders) return null;
      const items =
        (d.payload as { lessons?: { occurrence_id: string; child_id: string }[] }).lessons ?? [];
      const still: NonNullable<Awaited<ReturnType<typeof lessonTime>>>[] = [];
      for (const item of items) {
        const lesson = await lessonTime(admin, item.occurrence_id);
        if (!lesson || lesson.status !== "scheduled" || new Date(lesson.startsAt) <= new Date())
          continue;
        const away = one(
          await admin
            .from("absences")
            .select("id")
            .eq("occurrence_id", item.occurrence_id)
            .eq("child_id", item.child_id)
            .maybeSingle(),
        );
        if (away) continue;
        still.push(lesson);
      }
      if (still.length === 0) return null;
      const activity = activityName(org?.activity_type ?? "");
      const times = [...new Set(still.map((l) => l.startsAt))].sort().map((iso) => ({
        activity,
        time: lessonMoment(iso, still.find((l) => l.startsAt === iso)!.timezone).time,
      }));
      return {
        to,
        email: messages.lessonReminder({
          school,
          lessons: times,
          url: appUrl("/family"),
          settingsUrl: appUrl("/family/account"),
        }),
      };
    }
    case "reenrolment_ask":
    case "reenrolment_reminder": {
      const termId = (d.payload as { term_id?: string }).term_id;
      if (!termId) return null;
      const term = one(
        await admin
          .from("terms")
          .select("name, starts_on, reply_by, applied_at")
          .eq("id", termId)
          .maybeSingle(),
      );
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: org?.timezone ?? "Australia/Sydney",
      }).format(new Date());
      if (!term || term.applied_at || term.starts_on <= today) return null;
      // Only while this parent's family still has something to answer
      // (a reminder) or to see (the ask).
      const families = one(
        await admin.from("family_members").select("family_id").eq("user_id", d.recipient_user_id),
      ) as { family_id: string }[] | null;
      let open = admin
        .from("reenrolment_asks")
        .select("id, children!inner (family_id)")
        .eq("term_id", termId)
        .in(
          "children.family_id",
          (families ?? []).map((f) => f.family_id),
        );
      if (d.kind === "reenrolment_reminder") open = open.is("answer", null);
      const waiting = one(await open.limit(1)) as unknown[] | null;
      if (!waiting?.length) return null;
      const replyBy = term.reply_by ? shortDate(term.reply_by) : null;
      const message =
        d.kind === "reenrolment_ask" ? messages.reenrolmentAsk : messages.reenrolmentReminder;
      return { to, email: message({ school, term: term.name, replyBy, url: appUrl("/family") }) };
    }
    case "payment_receipt": {
      const paymentId = (d.payload as { payment_id?: string }).payment_id;
      if (!paymentId) return null;
      const payment = one(
        await admin
          .from("online_payments")
          .select("amount_cents, status, method, paid_at")
          .eq("id", paymentId)
          .maybeSingle(),
      );
      if (!payment || payment.status !== "paid" || !payment.paid_at) return null;
      const paidOn = new Intl.DateTimeFormat("en-CA", {
        timeZone: org?.timezone ?? "Australia/Sydney",
      }).format(new Date(payment.paid_at));
      return {
        to,
        email: messages.paymentReceipt({
          school,
          amount: formatMoney(payment.amount_cents),
          method: payment.method === "direct_debit" ? "Direct debit" : "Card",
          paidOn: shortDate(paidOn),
          reference: paymentId.slice(0, 8).toUpperCase(),
          url: appUrl("/family/fees"),
        }),
      };
    }
    case "place_confirmed": {
      const enrolmentId = (d.payload as { enrolment_id?: string }).enrolment_id;
      if (!enrolmentId) return null;
      const placed = one(
        await admin
          .from("enrolments")
          .select(
            "status, classes (weekday, start_time, levels!classes_organisation_id_level_id_fkey (name), locations (name))",
          )
          .eq("id", enrolmentId)
          .maybeSingle(),
      ) as unknown as {
        status: string;
        classes: {
          weekday: number;
          start_time: string;
          levels: { name: string } | null;
          locations: { name: string } | null;
        } | null;
      } | null;
      if (!placed || placed.status !== "active" || !placed.classes) return null;
      const c = placed.classes;
      return {
        to,
        email: messages.placeConfirmed({
          school,
          klass: `${dayName(c.weekday)}s at ${formatTime(c.start_time)}, ${c.levels?.name ?? ""}, ${c.locations?.name ?? ""}`,
          url: appUrl("/family"),
        }),
      };
    }
    case "payment_failed": {
      const paymentId = (d.payload as { payment_id?: string }).payment_id;
      if (!paymentId) return null;
      const payment = one(
        await admin
          .from("online_payments")
          .select("amount_cents, status, method, instalments (id)")
          .eq("id", paymentId)
          .maybeSingle(),
      );
      if (!payment || payment.status !== "failed") return null;
      return {
        to,
        email: messages.paymentFailed({
          school,
          amount: formatMoney(payment.amount_cents),
          url: appUrl("/family/fees"),
          method: payment.method === "card" ? "card" : "direct_debit",
          instalment: (payment.instalments ?? []).length > 0,
        }),
      };
    }
    case "fee_reminder": {
      const p = d.payload as { family_id?: string; stage?: string; due_on?: string };
      if (!p.family_id || !p.due_on || !["soon", "due", "overdue"].includes(p.stage ?? ""))
        return null;
      const { data, error } = await admin.rpc("family_dues", { p_family: p.family_id });
      if (error) throw error;
      const dues = data?.[0];
      // Switched off, paid, or no longer this parent's family since.
      if (!dues?.reminders_on) return null;
      const amount = p.stage === "soon" ? dues.owing_cents : dues.overdue_cents;
      if (amount <= 0) return null;
      const member = one(
        await admin
          .from("family_members")
          .select("user_id")
          .eq("family_id", p.family_id)
          .eq("user_id", d.recipient_user_id)
          .maybeSingle(),
      );
      if (!member) return null;
      return {
        to,
        email: messages.feeReminder({
          school,
          stage: p.stage as "soon" | "due" | "overdue",
          amount: formatMoney(amount),
          dueOn: shortDate(p.due_on),
          url: appUrl("/family/fees"),
        }),
      };
    }
    default:
      return null;
  }
}

async function lessonTime(admin: Admin, occurrenceId: string) {
  const row = one(
    await admin
      .from("class_occurrences")
      .select("starts_at, status, classes (locations (timezone))")
      .eq("id", occurrenceId)
      .maybeSingle(),
  ) as unknown as {
    starts_at: string;
    status: string;
    classes: { locations: { timezone: string } | null } | null;
  } | null;
  if (!row) return null;
  return {
    startsAt: row.starts_at,
    status: row.status,
    timezone: row.classes?.locations?.timezone ?? "Australia/Sydney",
  };
}

// "swimming" → "Swimming".
export function activityName(type: string): string {
  const t = type.trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : "Class";
}
