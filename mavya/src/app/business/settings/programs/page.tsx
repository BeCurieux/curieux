import type { Metadata } from "next";
import Link from "next/link";
import { NewLevelForm, NewProgramForm } from "@/components/business/program-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { levelSkills } from "@/lib/domain/progress";
import { listPrograms } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Programs & levels" };

export default async function ProgramsPage() {
  const { db } = await requireOwner();
  const programs = await listPrograms(db);
  const skills = await levelSkills(
    db,
    programs.flatMap((p) => p.levels.map((l) => l.id)),
  );
  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Programs &amp; levels</h1>
      {programs.map((p) => (
        <section
          key={p.id}
          aria-labelledby={`program-${p.id}`}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
        >
          <h2 id={`program-${p.id}`} className="font-display text-2xl font-semibold tracking-tight">
            {p.name}
          </h2>
          {p.levels.length ? (
            <ol className="flex flex-wrap gap-2">
              {p.levels.map((l, i) => (
                <li key={l.id}>
                  <Link
                    href={`/business/settings/levels/${l.id}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-soft px-4 font-semibold transition hover:bg-lilac"
                  >
                    <span className="tabular text-sm text-muted">{i + 1}</span>
                    {l.name}
                    <span className="text-sm font-normal text-muted">
                      · {skills.get(l.id)?.length ?? 0}{" "}
                      {skills.get(l.id)?.length === 1 ? "skill" : "skills"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">No levels yet. Add the first one below.</p>
          )}
          <NewLevelForm programId={p.id} programName={p.name} />
        </section>
      ))}
      <NewProgramForm />
    </div>
  );
}
