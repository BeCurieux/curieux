import { PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { ProgressRing } from "@/components/demo/progress-ring";
import { Button } from "@/components/ui/button";
import { saveSkills } from "@/lib/demo/actions";
import { instructorContext } from "@/lib/demo/context";
import { AVA_ID, type SkillStatus } from "@/lib/demo/data";
import { childDemo } from "@/lib/demo/service";
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
  searchParams: Promise<{ saved?: string }>;
}) {
  const { child: slug } = await params;
  const { saved } = await searchParams;
  const { state, demo, db } = await instructorContext();
  // Skills are demo until M3, for Ava only. Her name comes from the
  // database, which only shows her to instructors who teach her.
  if (!demo || (slug !== "ava" && slug !== AVA_ID)) notFound();
  const { data: row } = await db
    .from("children")
    .select("first_name, last_name")
    .eq("id", AVA_ID)
    .maybeSingle();
  if (!row) notFound();
  const child = {
    slug: AVA_ID,
    firstName: row.first_name,
    lastName: row.last_name,
    level: "Dolphin 3",
    ...childDemo(AVA_ID, state),
  };
  if (!child.skillList) notFound();

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/instructor/class/dolphin-3">Dolphin 3</BackLink>
      <div className="flex items-center gap-4">
        <ProgressRing
          value={child.progress!}
          size={84}
          stroke={9}
          className="shrink-0 text-cobalt [&_span]:text-xl"
        />
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {child.firstName} {child.lastName}
          </h1>
          <p className="text-muted">
            {child.level} · {child.achieved} of {child.skillList.length} achieved
          </p>
        </div>
      </div>

      {saved ? (
        <div
          role="status"
          className="animate-pop flex items-center gap-3 rounded-lg bg-[#dcf1e7] p-4 text-[#1d5a41]"
        >
          <PartyPopper aria-hidden className="size-6 shrink-0" />
          <p className="font-semibold">
            Saved. {child.firstName}&apos;s family can see the update now.
          </p>
        </div>
      ) : null}

      <form action={saveSkills.bind(null, child.slug)} className="flex flex-col gap-4">
        {child.skillList.map((skill) => (
          <fieldset
            key={skill.name}
            className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)]"
          >
            <legend className="sr-only">{skill.name}</legend>
            <div aria-hidden>
              <p className="text-lg font-semibold">{skill.name}</p>
              <p className="text-sm text-muted">{skill.hint}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map((o) => (
                <label key={o.value} className="relative">
                  <input
                    type="radio"
                    name={skill.name}
                    value={o.value}
                    defaultChecked={skill.status === o.value}
                    aria-label={`${skill.name}: ${o.label}`}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-12 cursor-pointer items-center justify-center rounded-md border-2 border-line text-sm font-semibold text-muted transition peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt",
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
        <Button type="submit" size="lg" className="sticky bottom-4">
          Save progress
        </Button>
      </form>
    </div>
  );
}
