import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/business/owner";
import { formatMoney } from "@/lib/domain/accounts";
import {
  jobsWithoutStaff,
  minutesSaved,
  MINUTES_PER_JOB,
  monthName,
  monthOf,
  ovykoMonth,
  shiftMonth,
} from "@/lib/domain/month";
import { schoolToday } from "@/lib/domain/terms";

export const metadata: Metadata = { title: "This month with Ovyko" };

// What Ovyko did for the school in a month, counted from the records
// (docs/M8_NETWORK.md, M8a).
export default async function MonthPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { db, organisationId } = await requireOwner();
  const { data: org } = await db
    .from("organisations")
    .select("timezone")
    .eq("id", organisationId)
    .single();
  const current = monthOf(schoolToday(org?.timezone ?? "Australia/Sydney"));
  const asked = (await searchParams).m;
  const month =
    asked && /^\d{4}-\d{2}$/.test(asked) && `${asked}-01` <= current ? `${asked}-01` : current;
  const m = await ovykoMonth(db, organisationId, month);
  const hours = Math.round(minutesSaved(m) / 6) / 10;
  const isCurrent = month === current;

  return (
    <div className="rise flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {isCurrent ? "This month" : monthName(month)} with Ovyko
        </h1>
        <nav aria-label="Months" className="flex gap-4 font-semibold">
          <Link
            href={`/business/month?m=${shiftMonth(month, -1).slice(0, 7)}`}
            className="underline"
          >
            {monthName(shiftMonth(month, -1))}
          </Link>
          {isCurrent ? null : (
            <Link
              href={`/business/month?m=${shiftMonth(month, 1).slice(0, 7)}`}
              className="underline"
            >
              {monthName(shiftMonth(month, 1))}
            </Link>
          )}
        </nav>
      </div>
      <p className="text-muted">
        {isCurrent ? `${monthName(month)} so far. ` : ""}Counted from what happened in Ovyko, not
        estimated, except the time saved.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        <Figure
          label="Places filled that would have sat empty"
          value={String(m.makeupsDelivered)}
          note={
            m.makeupsValueCents > 0
              ? `Lessons worth ${formatMoney(m.makeupsValueCents)} at your prices, delivered in places freed by absences. Families had already paid, so it's kept customers, not new income.`
              : "Make-ups taken in places freed by absences."
          }
        />
        <Figure
          label="Fees collected through Ovyko"
          value={formatMoney(m.paidOnlineCents)}
          note={`${m.paidOnlineCount} ${m.paidOnlineCount === 1 ? "payment" : "payments"}${
            m.instalmentsTaken > 0
              ? `, ${m.instalmentsTaken} of them instalments taken automatically (${formatMoney(m.instalmentsCents)})`
              : ""
          }.`}
        />
        <Figure
          label="Overdue fees chased and paid"
          value={formatMoney(m.chasedPaidCents)}
          note={`Paid by ${m.chasedPaidFamilies} ${m.chasedPaidFamilies === 1 ? "family" : "families"} within two weeks of a reminder. ${m.remindersSent} ${m.remindersSent === 1 ? "reminder" : "reminders"} sent.`}
        />
        <Figure
          label="Families staying next term"
          value={String(m.staying)}
          note={`Children whose families tapped "staying". ${m.reenrolAnswers} answered in all.`}
        />
      </ul>

      <section
        aria-labelledby="jobs"
        className="flex flex-col gap-3 rounded-lg bg-[#dcf1e7] p-6 text-[#1d5a41]"
      >
        <h2 id="jobs" className="font-semibold">
          Done without the front desk
        </h2>
        <p className="font-display text-3xl font-semibold">
          {jobsWithoutStaff(m)} {jobsWithoutStaff(m) === 1 ? "job" : "jobs"} · about {hours}{" "}
          {hours === 1 ? "hour" : "hours"}
        </p>
        <ul className="flex flex-col gap-1">
          <li>{m.absencesByParents} absences reported by parents</li>
          <li>{m.makeupsBookedByParents} make-ups booked by parents</li>
          <li>
            {m.offersClaimed} places offered and claimed ({m.offersAutomatic} offered automatically)
          </li>
          <li>{m.paidOnlineCount} payments recorded</li>
          <li>{m.remindersSent} fee reminders sent</li>
          <li>{m.reenrolAnswers} re-enrolment answers</li>
        </ul>
        <p className="text-sm">
          The hours are an estimate: {MINUTES_PER_JOB.absence} minutes an absence,{" "}
          {MINUTES_PER_JOB.makeupBooking} a make-up booking, {MINUTES_PER_JOB.placeOffered} a place
          offered, {MINUTES_PER_JOB.payment} a payment, {MINUTES_PER_JOB.reminder} a reminder and{" "}
          {MINUTES_PER_JOB.reenrolAnswer} a re-enrolment answer.
        </p>
      </section>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-sm text-muted">{note}</p>
    </li>
  );
}
