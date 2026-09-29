import "server-only";
import { must, type Db } from "./db";

// Absences, make-up credits and bookings (docs/M4_MAKEUPS.md). Every rule
// lives in the database: check_makeup is the one eligibility check, and the
// functions below only call it or read what row level security allows.

export type MakeupPolicy = {
  makeupsEnabled: boolean;
  minimumNoticeMinutes: number;
  creditValidityDays: number;
  maxActiveCredits: number;
  allowFutureLevel: boolean;
  bookingHorizonDays: number;
  cancellationNoticeMinutes: number;
  returnCreditOnValidCancellation: boolean;
};

type PolicyJson = {
  makeups_enabled: boolean;
  minimum_notice_minutes: number;
  credit_validity_days: number;
  max_active_credits: number;
  allow_future_level: boolean;
  booking_horizon_days: number;
  cancellation_notice_minutes: number;
  return_credit_on_valid_cancellation: boolean;
};

export async function getPolicy(db: Db, organisationId: string): Promise<MakeupPolicy> {
  const { data, error } = await db.rpc("makeup_policy", { p_org: organisationId });
  const p = must({ data, error }) as unknown as PolicyJson;
  return {
    makeupsEnabled: p.makeups_enabled,
    minimumNoticeMinutes: p.minimum_notice_minutes,
    creditValidityDays: p.credit_validity_days,
    maxActiveCredits: p.max_active_credits,
    allowFutureLevel: p.allow_future_level,
    bookingHorizonDays: p.booking_horizon_days,
    cancellationNoticeMinutes: p.cancellation_notice_minutes,
    returnCreditOnValidCancellation: p.return_credit_on_valid_cancellation,
  };
}

export async function savePolicy(db: Db, organisationId: string, policy: MakeupPolicy) {
  const config: PolicyJson = {
    makeups_enabled: policy.makeupsEnabled,
    minimum_notice_minutes: policy.minimumNoticeMinutes,
    credit_validity_days: policy.creditValidityDays,
    max_active_credits: policy.maxActiveCredits,
    allow_future_level: policy.allowFutureLevel,
    booking_horizon_days: policy.bookingHorizonDays,
    cancellation_notice_minutes: policy.cancellationNoticeMinutes,
    return_credit_on_valid_cancellation: policy.returnCreditOnValidCancellation,
  };
  const { data, error } = await db.rpc("save_makeup_policy", {
    p_org: organisationId,
    p_config: config,
  });
  return must({ data, error });
}

// "2 hours", "30 minutes", "1 day".
export function plainDuration(minutes: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (minutes >= 1440 && minutes % 1440 === 0) return unit(minutes / 1440, "day");
  if (minutes >= 60 && minutes % 60 === 0) return unit(minutes / 60, "hour");
  return unit(minutes, "minute");
}

// The policy in a parent's words. Describes the rules; deciding them is the
// database's job.
export function policySummary(policy: MakeupPolicy, level: string | null): string[] {
  if (!policy.makeupsEnabled) return ["Make-ups aren't offered at the moment"];
  const horizon =
    policy.bookingHorizonDays % 7 === 0
      ? `${policy.bookingHorizonDays / 7} ${policy.bookingHorizonDays === 7 ? "week" : "weeks"}`
      : `${policy.bookingHorizonDays} days`;
  return [
    policy.minimumNoticeMinutes > 0
      ? `Tell us at least ${plainDuration(policy.minimumNoticeMinutes)} before class`
      : "Tell us any time before class",
    `Your make-up credit lasts ${policy.creditValidityDays} days`,
    `Book any ${level ?? "same-level"} class${policy.allowFutureLevel ? " or the next level up" : ""} in the next ${horizon}`,
  ];
}

// ------------------------------------------------------------------ absences

export type AbsenceResult = {
  absenceId: string;
  creditId: string | null;
  creditExpiresAt: string | null;
  noCreditReason: string | null;
};

export async function reportAbsence(
  db: Db,
  input: { occurrenceId: string; childId: string; reason: string | null },
): Promise<AbsenceResult> {
  const { data, error } = await db.rpc("report_absence", {
    p_occurrence: input.occurrenceId,
    p_child: input.childId,
    p_reason: input.reason ?? undefined,
  });
  const row = must({ data, error })[0]!;
  return {
    absenceId: row.absence_id,
    creditId: row.credit_id,
    creditExpiresAt: row.credit_expires_at,
    noCreditReason: row.no_credit_reason,
  };
}

export async function withdrawAbsence(db: Db, absenceId: string) {
  const { error } = await db.rpc("withdraw_absence", { p_absence: absenceId });
  must({ data: true, error });
}

// ------------------------------------------------------------------ credits

export type Credit = {
  id: string;
  childId: string;
  expiresAt: string;
  reason: "absence" | "lesson_cancelled";
  sourceStartsAt: string | null;
};

// Credits the caller can see that can still be used, soonest to expire first.
export async function availableCredits(db: Db, childIds?: string[]): Promise<Credit[]> {
  let query = db
    .from("makeup_credits")
    .select("id, child_id, expires_at, reason, class_occurrences (starts_at)")
    .eq("status", "available")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at");
  if (childIds) query = query.in("child_id", childIds);
  const rows = must(await query) as unknown as {
    id: string;
    child_id: string;
    expires_at: string;
    reason: Credit["reason"];
    class_occurrences: { starts_at: string } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    childId: r.child_id,
    expiresAt: r.expires_at,
    reason: r.reason,
    sourceStartsAt: r.class_occurrences?.starts_at ?? null,
  }));
}

export type MakeupOption = {
  occurrenceId: string;
  classId: string;
  className: string;
  level: string;
  location: string;
  timezone: string;
  instructor: string | null;
  startsAt: string;
  endsAt: string;
  freePlaces: number;
};

export async function makeupOptions(db: Db, creditId: string): Promise<MakeupOption[]> {
  const { data, error } = await db.rpc("makeup_options", { p_credit: creditId });
  return must({ data, error }).map((r) => ({
    occurrenceId: r.occurrence_id,
    classId: r.class_id,
    className: r.class_name,
    level: r.level_name,
    location: r.location_name,
    timezone: r.timezone,
    instructor: r.instructor_first_name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    freePlaces: r.free_places,
  }));
}

// Why a credit can't be used for a lesson; empty when it can.
export async function evaluateMakeupEligibility(
  db: Db,
  input: { creditId: string; occurrenceId: string },
): Promise<{ eligible: boolean; reasons: string[] }> {
  const { data, error } = await db.rpc("check_makeup", {
    p_credit: input.creditId,
    p_occurrence: input.occurrenceId,
  });
  const reasons = must({ data, error });
  return { eligible: reasons.length === 0, reasons };
}

export async function bookMakeup(db: Db, input: { creditId: string; occurrenceId: string }) {
  const { data, error } = await db.rpc("book_makeup", {
    p_credit: input.creditId,
    p_occurrence: input.occurrenceId,
  });
  return must({ data, error });
}

// Whether the credit came back.
export async function cancelMakeup(db: Db, bookingId: string): Promise<boolean> {
  const { data, error } = await db.rpc("cancel_makeup", { p_booking: bookingId });
  return must({ data, error });
}

// ------------------------------------------------------------------ owners

export async function cancelLessons(db: Db, input: { locationId: string; date: string }) {
  const { data, error } = await db.rpc("cancel_lessons", {
    p_location: input.locationId,
    p_date: input.date,
  });
  return must({ data, error });
}

// ------------------------------------------------------------------ presenting options

export type ClassChoice = {
  classId: string;
  // The soonest lesson, then any later ones in the booking window.
  lessons: MakeupOption[];
  bestFit: boolean;
};

const minutesOfDay = (iso: string, timeZone: string) => {
  const [h = 0, m = 0] = new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .format(new Date(iso))
    .split(":")
    .map(Number);
  return h * 60 + m;
};

// Groups eligible lessons by class, soonest first, and marks the best fit:
// the same time of day as the missed lesson, closest to it; otherwise just
// the closest. Only orders what the database already said is eligible.
export function rankOptions(options: MakeupOption[], missed: string | null): ClassChoice[] {
  const byClass = new Map<string, MakeupOption[]>();
  for (const o of options) byClass.set(o.classId, [...(byClass.get(o.classId) ?? []), o]);
  const choices = [...byClass.entries()].map(([classId, lessons]) => ({
    classId,
    lessons: [...lessons].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    bestFit: false,
  }));
  if (choices.length === 0) return choices;
  const anchor = missed ? new Date(missed).getTime() : Date.now();
  const score = (o: MakeupOption) => {
    const sameTime =
      missed !== null && minutesOfDay(o.startsAt, o.timezone) === minutesOfDay(missed, o.timezone);
    return [sameTime ? 0 : 1, Math.abs(new Date(o.startsAt).getTime() - anchor)] as const;
  };
  const best = choices
    .map((c) => ({ c, s: score(c.lessons[0]!) }))
    .sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1])[0]!.c;
  best.bestFit = true;
  return [best, ...choices.filter((c) => c !== best)];
}
