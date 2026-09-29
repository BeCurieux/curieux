import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OccupancyBar } from "@/components/business/occupancy-bar";
import { Stat } from "@/components/business/stat";
import { BackLink } from "@/components/demo/back-link";
import { Button } from "@/components/ui/button";
import { businessContext } from "@/lib/demo/context";
import { PRIMARY_CLASS_ID } from "@/lib/demo/data";
import { candidatesFor, findClassBySlug, roster } from "@/lib/demo/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { state, demo } = await businessContext();
  const c = demo ? findClassBySlug(slug, state) : null;
  if (!c) notFound();

  const candidates = candidatesFor(c.id, state);
  const children = c.id === PRIMARY_CLASS_ID ? roster(state) : null;

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/classes">Classes</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-muted">
            Upcoming · {c.day} {c.time} · {c.instructor}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{c.level}</h1>
        </div>
        {c.temporaryVacancies > 0 ? (
          <Button asChild variant="warm">
            <Link href="/business/fill">
              Fill {c.temporaryVacancies} open {c.temporaryVacancies === 1 ? "spot" : "spots"}
            </Link>
          </Button>
        ) : null}
      </div>

      <section
        aria-labelledby="occupancy"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="occupancy" className="font-semibold">
          Occupancy
        </h2>
        <OccupancyBar
          expected={c.expected}
          vacancies={c.temporaryVacancies}
          capacity={c.capacity}
        />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Enrolled" value={c.enrolled} suffix={` / ${c.capacity}`} />
          <Stat label="Absences" value={c.absences} />
          <Stat
            label="Temporary vacancies"
            value={c.temporaryVacancies}
            tone={c.temporaryVacancies > 0 ? "attention" : "plain"}
          />
          <Stat label="Make-up candidates" value={candidates.length} />
        </dl>
      </section>

      {children ? (
        <section aria-labelledby="roster" className="flex flex-col gap-3">
          <h2 id="roster" className="font-display text-2xl font-semibold tracking-tight">
            Roster
          </h2>
          <ul className="grid overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-2">
            {children.map((child) => (
              <li
                key={child.slug}
                className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:odd:border-r"
              >
                <div>
                  <p className="font-semibold">{child.name}</p>
                  <p className="text-sm text-muted">{child.family} family</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    child.reportedAway
                      ? "bg-[#fff0ec] text-[#b4503d]"
                      : "bg-surface-soft text-muted",
                  )}
                >
                  {child.reportedAway ? "Reported away" : "Expected"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
