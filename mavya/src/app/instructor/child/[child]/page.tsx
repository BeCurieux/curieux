import { ListChecks, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { ProgressRing } from "@/components/demo/progress-ring";
import { Button } from "@/components/ui/button";
import { instructorContext } from "@/lib/demo/context";
import { AVA_ID } from "@/lib/demo/data";
import { classSlug } from "@/lib/demo/service";
import { myMembershipId } from "@/lib/domain/schedule";
import { childProgress, type SkillStatus } from "@/lib/domain/progress";
import { childSafety } from "@/lib/domain/safety";
import { SafetyNotes } from "@/components/safety/safety-notes";
import { listClasses } from "@/lib/domain/timetable";
import { saveProgress } from "@/lib/instructor/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Skills" };

const OPTIONS: { value: SkillStatus; label: string }[] = [
  { value: "not_started", label: "Not yet" },
  { value: "developing", label: "Developing" },
  { value: "achieved", label: "Achieved" },
];

export default async function InstructorChildPage({
  params,
  searchParams,
}: {
  params: Promise<{ child: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { child: param } = await params;
  const { saved, error } = await searchParams;
  const { viewer, demo, db, organisationId } = await instructorContext();
  // The docs' demo address, /instructor/child/ava, still works.
  const childId = demo && param === "ava" ? AVA_ID : param;
  if (!z.uuid().safeParse(childId).success) notFound();

  // Row level security only shows an instructor the children they teach.
  const { data: row } = await db
    .from("children")
    .select("first_name, last_name")
    .eq("id", childId)
    .maybeSingle();
  if (!row) notFound();

  // The class this instructor teaches the child in decides the level.
  const membershipId = await myMembershipId(db, viewer.userId, organisationId);
  const [taught, enrolled] = await Promise.all([
    listClasses(db, { activeOnly: true, instructorId: membershipId }),
    db.from("enrolments").select("class_id").eq("child_id", childId).eq("status", "active"),
  ]);
  const classIds = new Set((enrolled.data ?? []).map((e) => e.class_id));
  const c = taught.find((k) => classIds.has(k.id));
  // Health notes and restrictions, for every child they teach, make-ups
  // included. Opening them is recorded for the school.
  const safety = await childSafety(db, childId);
  if (!c) {
    // In this instructor's lesson as a make-up only: no skills to update.
    return (
      <div className="flex flex-col gap-5">
        <BackLink href="/instructor">Your classes</BackLink>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {row.first_name} {row.last_name}
        </h1>
        <SafetyNotes safety={safety} name={row.first_name} />
        <p className="rounded-lg bg-surface p-5 text-muted shadow-[0_1px_0_var(--border)]">
          {row.first_name} is with you for a make-up. Their own instructor updates their skills.
        </p>
      </div>
    );
  }
  const progress = await childProgress(db, childId, c.levelId);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/instructor/class/${classSlug(c.id)}`}>{c.name}</BackLink>
      <div className="flex items-center gap-4">
        {progress ? (
          <ProgressRing
            value={progress.progress}
            size={84}
            stroke={9}
            className="shrink-0 text-cobalt [&_span]:text-xl"
          />
        ) : null}
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {row.first_name} {row.last_name}
          </h1>
          <p className="text-muted">
            {c.level}
            {progress ? ` · ${progress.achieved} of ${progress.skills.length} achieved` : ""}
          </p>
        </div>
      </div>

      <SafetyNotes safety={safety} name={row.first_name} />

      {saved ? (
        <div
          role="status"
          className="animate-pop flex items-center gap-3 rounded-lg bg-[#dcf1e7] p-4 text-[#1d5a41]"
        >
          <PartyPopper aria-hidden className="size-6 shrink-0" />
          <p className="font-semibold">
            Saved. {row.first_name}&apos;s family can see the update now.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-[#fff0ec] p-4 font-semibold text-[#9c3b29]">
          Some skills weren&apos;t saved. Check them and try again.
        </p>
      ) : null}

      {!progress ? (
        <EmptyState icon={<ListChecks />} title={`No skills for ${c.level} yet`}>
          Once the school adds this level&apos;s skills, you can update them here.
        </EmptyState>
      ) : (
        <form
          action={saveProgress.bind(null, childId, c.levelId, `/instructor/child/${param}`)}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {progress.skills.map((skill) => (
              <fieldset
                key={skill.id}
                className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)]"
              >
                <legend className="sr-only">{skill.name}</legend>
                <div aria-hidden>
                  <p className="text-lg font-semibold">{skill.name}</p>
                  {skill.hint ? <p className="text-sm text-muted">{skill.hint}</p> : null}
                </div>
                <div className="mt-auto grid grid-cols-3 gap-2">
                  {OPTIONS.map((o) => (
                    <label key={o.value} className="relative">
                      <input
                        type="radio"
                        name={skill.id}
                        value={o.value}
                        defaultChecked={skill.status === o.value}
                        aria-label={`${skill.name}: ${o.label}`}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          "flex h-12 cursor-pointer items-center justify-center rounded-md border-2 border-line text-sm font-semibold text-muted transition peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt md:h-14",
                          o.value === "achieved" &&
                            "peer-checked:border-success peer-checked:bg-success peer-checked:text-white",
                          o.value === "developing" &&
                            "peer-checked:border-warning peer-checked:bg-butter peer-checked:text-ink",
                          o.value === "not_started" &&
                            "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white",
                        )}
                      >
                        {o.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <Button type="submit" size="lg" className="sticky bottom-4 md:w-fit md:self-end">
            Save progress
          </Button>
        </form>
      )}
    </div>
  );
}
