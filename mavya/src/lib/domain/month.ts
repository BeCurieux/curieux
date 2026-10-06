import { explain, type Db } from "./db";

// This month with Ovyko (docs/M8_NETWORK.md, M8a): what Ovyko did for the
// school in a month, counted from the records.

export type OvykoMonth = {
  makeupsDelivered: number;
  makeupsValueCents: number;
  offersClaimed: number;
  offersAutomatic: number;
  absencesByParents: number;
  makeupsBookedByParents: number;
  paidOnlineCount: number;
  paidOnlineCents: number;
  instalmentsTaken: number;
  instalmentsCents: number;
  remindersSent: number;
  chasedPaidFamilies: number;
  chasedPaidCents: number;
  reenrolAnswers: number;
  staying: number;
};

export async function ovykoMonth(
  db: Db,
  organisationId: string,
  month: string,
): Promise<OvykoMonth> {
  const { data, error } = await db.rpc("ovyko_month", { p_org: organisationId, p_month: month });
  if (error) throw explain(error);
  const r = data![0]!;
  return {
    makeupsDelivered: r.makeups_delivered,
    makeupsValueCents: r.makeups_value_cents,
    offersClaimed: r.offers_claimed,
    offersAutomatic: r.offers_automatic,
    absencesByParents: r.absences_by_parents,
    makeupsBookedByParents: r.makeups_booked_by_parents,
    paidOnlineCount: r.paid_online_count,
    paidOnlineCents: r.paid_online_cents,
    instalmentsTaken: r.instalments_taken,
    instalmentsCents: r.instalments_cents,
    remindersSent: r.reminders_sent,
    chasedPaidFamilies: r.chased_paid_families,
    chasedPaidCents: r.chased_paid_cents,
    reenrolAnswers: r.reenrol_answers,
    staying: r.staying,
  };
}

// Minutes a person would otherwise spend on each job: estimates, to be
// replaced with the operator interviews' measurements (docs/M8_NETWORK.md).
export const MINUTES_PER_JOB = {
  absence: 3,
  makeupBooking: 5,
  placeOffered: 10,
  payment: 4,
  reminder: 3,
  reenrolAnswer: 4,
} as const;

export function jobsWithoutStaff(m: OvykoMonth): number {
  return (
    m.absencesByParents +
    m.makeupsBookedByParents +
    m.offersClaimed +
    m.paidOnlineCount +
    m.remindersSent +
    m.reenrolAnswers
  );
}

export function minutesSaved(m: OvykoMonth): number {
  return (
    m.absencesByParents * MINUTES_PER_JOB.absence +
    m.makeupsBookedByParents * MINUTES_PER_JOB.makeupBooking +
    m.offersClaimed * MINUTES_PER_JOB.placeOffered +
    m.paidOnlineCount * MINUTES_PER_JOB.payment +
    m.remindersSent * MINUTES_PER_JOB.reminder +
    m.reenrolAnswers * MINUTES_PER_JOB.reenrolAnswer
  );
}

// "2026-10-01" for the month containing `day` (a YYYY-MM-DD date).
export function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 10);
}

export function monthName(month: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}T00:00:00Z`));
}
