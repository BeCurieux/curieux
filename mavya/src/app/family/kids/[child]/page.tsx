import { CalendarCheck2, CalendarX2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { ProgressRing } from "@/components/demo/progress-ring";
import { SkillBadge } from "@/components/demo/skill-badge";
import { Button } from "@/components/ui/button";
import { familyContext } from "@/lib/demo/context";
import { ORGANISATION } from "@/lib/demo/data";
import { findChild } from "@/lib/demo/service";

export const metadata: Metadata = { title: "Progress" };

export default async function ChildPage({ params }: { params: Promise<{ child: string }> }) {
  const { child: slug } = await params;
  const { state, demo } = await familyContext();
  const child = demo ? findChild(slug, state) : null;
  if (!child) notFound();

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family/kids">Kids</BackLink>

      <section className="pass pass-lilac flex flex-col items-center gap-4 px-6 pt-8 pb-7 text-center text-ink">
        {child.progress !== null ? (
          <ProgressRing
            value={child.progress}
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
            {child.level} · {ORGANISATION.name}
          </p>
        </div>
        {child.skillList ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-1.5 font-semibold">
            <Trophy aria-hidden className="size-4" />
            {child.achieved} of {child.skillList.length} skills achieved
          </p>
        ) : null}
      </section>

      {child.skillList ? (
        <section aria-labelledby="skills" className="flex flex-col gap-3">
          <h2 id="skills" className="font-display text-xl font-semibold">
            Skills
          </h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_var(--border)]">
            {child.skillList.map((skill) => (
              <li key={skill.name} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">{skill.name}</p>
                  <p className="text-sm text-muted">{skill.hint}</p>
                </div>
                <SkillBadge status={skill.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg bg-surface p-5 text-muted shadow-[0_1px_0_var(--border)]">
          {child.firstName}&apos;s skills will show here once his instructor starts assessing{" "}
          {child.level}.
        </p>
      )}

      <section aria-labelledby="next" className="flex flex-col gap-3">
        <h2 id="next" className="font-display text-xl font-semibold">
          Next class
        </h2>
        <div className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-soft [&_svg]:size-6">
            {child.away && !child.makeup ? (
              <CalendarX2 aria-hidden />
            ) : (
              <CalendarCheck2 aria-hidden />
            )}
          </span>
          <div>
            <p className="text-lg font-semibold">
              {child.makeup
                ? `${child.makeup.day} ${child.makeup.time} (make-up)`
                : `${child.schedule.day} ${child.schedule.time}`}
            </p>
            <p className="text-muted">
              {child.away && !child.makeup
                ? "Away this Wednesday · make-up credit ready"
                : `${child.level} · ${ORGANISATION.name}`}
            </p>
          </div>
        </div>
        {child.classId && !child.away ? (
          <Button asChild variant="soft" size="lg">
            <Link href="/family/absence">Report absence</Link>
          </Button>
        ) : null}
        {child.away && !child.makeup ? (
          <Button asChild variant="warm" size="lg">
            <Link href="/family/makeups">Find a make-up</Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}
