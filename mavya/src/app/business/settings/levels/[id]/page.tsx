import { ListChecks, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { NewSkillForm } from "@/components/business/program-forms";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { removeSkill } from "@/lib/business/actions";
import { requireOwner } from "@/lib/business/owner";
import { levelSkills } from "@/lib/domain/progress";

export const metadata: Metadata = { title: "Skills" };

export default async function LevelSkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireOwner();
  const { data: level } = await db
    .from("levels")
    .select("id, name, programs (name)")
    .eq("id", id)
    .maybeSingle();
  if (!level) notFound();
  const skills = (await levelSkills(db, [id])).get(id) ?? [];
  const program = (level.programs as { name: string } | null)?.name ?? "";

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings/programs">Programs &amp; levels</BackLink>
      <div>
        <p className="font-semibold text-muted">{program}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{level.name} skills</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Instructors mark each skill as not yet, developing or achieved. Families see the same
          list, and hear when a skill is achieved.
        </p>
      </div>
      {skills.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No skills yet">
          Add the skills a child works on at this level, in the order they usually learn them.
        </EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {skills.map((s, i) => (
            <li key={s.id} className="flex items-center gap-4 px-5 py-3">
              <span className="tabular w-6 text-sm text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.name}</p>
                {s.hint ? <p className="text-sm text-muted">{s.hint}</p> : null}
              </div>
              <form action={removeSkill.bind(null, s.id)}>
                <button
                  type="submit"
                  aria-label={`Remove ${s.name}`}
                  className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface-soft hover:text-ink [&_svg]:size-5"
                >
                  <Trash2 aria-hidden />
                </button>
              </form>
            </li>
          ))}
        </ol>
      )}
      <NewSkillForm levelId={id} levelName={level.name} />
    </div>
  );
}
