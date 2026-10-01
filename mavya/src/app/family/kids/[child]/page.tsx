import { CalendarCheck2, CalendarX2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { ProgressRing } from "@/components/demo/progress-ring";
import { SkillBadge } from "@/components/demo/skill-badge";
import { Button } from "@/components/ui/button";
import { CancelMakeup, WithdrawAbsence } from "@/components/family/makeup-buttons";
import { HealthForm } from "@/components/family/health-form";
import { familyContext } from "@/lib/demo/context";
import { childSafety } from "@/lib/domain/safety";
import { findFamilyChild } from "@/lib/family/children";
import { lessonMoment } from "@/lib/format";

export const metadata: Metadata = { title: "Progress" };

export default async function ChildPage({ params }: { params: Promise<{ child: string }> }) {
  const { child: slug } = await params;
  const { db } = await familyContext();
  const child = await findFamilyChild(db, slug);
  if (!child) notFound();
  const { health } = await childSafety(db, child.id);

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family/kids">Kids</BackLink>

      <section className="pass pass-lilac flex flex-col items-center gap-4 px-6 pt-8 pb-7 text-center text-ink">
        {child.progress ? (
          <ProgressRing
            value={child.progress.progress}
            size={148}
            stroke={14}
            label="of level"
            className="text-ink"
          />
        ) : (
          <span className="grid size-28 place-items-center rounded-full bg-mint font-display text-5xl font-semibold">
            {child.firstName.charAt(0)}
          </span>
        )}
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{child.firstName}</h1>
          <p className="text-lg font-semibold">
            {child.primary ? `${child.primary.level} · ` : ""}
            {child.organisation}
          </p>
        </div>
        {child.progress ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-1.5 font-semibold">
            <Trophy aria-hidden className="size-4" />
            {child.progress.achieved} of {child.progress.skills.length} skills achieved
          </p>
        ) : null}
      </section>

      {child.progress ? (
        <section aria-labelledby="skills" className="flex flex-col gap-3">
          <h2 id="skills" className="font-display text-xl font-semibold">
            Skills
          </h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_var(--border)]">
            {child.progress.skills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">{skill.name}</p>
                  {skill.hint ? <p className="text-sm text-muted">{skill.hint}</p> : null}
                </div>
                <SkillBadge status={skill.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg bg-surface p-5 text-muted shadow-[0_1px_0_var(--border)]">
          {child.firstName}&apos;s skills will show here once their instructor starts assessing
          them.
        </p>
      )}

      <section aria-labelledby="next" className="flex flex-col gap-3">
        <h2 id="next" className="font-display text-xl font-semibold">
          Next class
        </h2>
        {child.makeup ? (
          <LessonCard
            icon="check"
            title={`${lessonMoment(child.makeup.startsAt, child.makeup.klass.timezone).day} ${lessonMoment(child.makeup.startsAt, child.makeup.klass.timezone).time} (make-up)`}
            detail={`${lessonMoment(child.makeup.startsAt, child.makeup.klass.timezone).date} · ${child.makeup.klass.level} · ${child.makeup.klass.location}`}
          >
            <CancelMakeup
              bookingId={child.makeup.bookingId!}
              label={`Cancel ${child.firstName}'s make-up`}
            />
          </LessonCard>
        ) : null}
        {child.next ? (
          (() => {
            const when = lessonMoment(child.next.startsAt, child.next.klass.timezone);
            return (
              <LessonCard
                icon={child.away ? "away" : "check"}
                title={`${when.day} ${when.time}`}
                detail={
                  child.away
                    ? `Away ${when.date}${child.credits > 0 ? " · make-up credit ready" : ""}`
                    : `${when.date} · ${child.next.klass.level} · ${child.next.klass.location}`
                }
              >
                {child.away ? (
                  <WithdrawAbsence
                    absenceId={child.next.absenceId!}
                    label={`${child.firstName} can make it after all`}
                  />
                ) : (
                  <Button asChild variant="soft" size="lg">
                    <Link href={`/family/absence?child=${child.slug}`}>Report absence</Link>
                  </Button>
                )}
              </LessonCard>
            );
          })()
        ) : !child.makeup ? (
          <p className="rounded-lg bg-surface p-5 text-muted shadow-[0_1px_0_var(--border)]">
            {child.primary ? "No lessons scheduled in the next few weeks." : "Not in a class yet."}
          </p>
        ) : null}
        {child.laterAway.map((lesson) => {
          const when = lessonMoment(lesson.startsAt, lesson.klass.timezone);
          return (
            <LessonCard
              key={lesson.occurrenceId}
              icon="away"
              title={`${when.day} ${when.time}`}
              detail={`Away ${when.date}`}
            >
              <WithdrawAbsence
                absenceId={lesson.absenceId!}
                label={`${child.firstName} can make it on ${when.date} after all`}
              />
            </LessonCard>
          );
        })}
        {child.credits > 0 ? (
          <Button asChild variant="warm" size="lg">
            <Link href="/family/makeups">Find a make-up</Link>
          </Button>
        ) : null}
      </section>

      <section aria-labelledby="health" className="flex flex-col gap-3">
        <div>
          <h2 id="health" className="font-display text-xl font-semibold">
            Health notes
          </h2>
          <p className="text-muted">
            Only {child.firstName}&apos;s instructors and {child.organisation}&apos;s owners see
            these. Leave them empty if there&apos;s nothing to know.
          </p>
        </div>
        <div className="rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]">
          <HealthForm
            childId={child.id}
            allergies={health?.allergies ?? null}
            medicalNotes={health?.medicalNotes ?? null}
          />
        </div>
      </section>
    </div>
  );
}

function LessonCard({
  icon,
  title,
  detail,
  children,
}: {
  icon: "check" | "away";
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-soft [&_svg]:size-6">
          {icon === "away" ? <CalendarX2 aria-hidden /> : <CalendarCheck2 aria-hidden />}
        </span>
        <div>
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-muted">{detail}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
