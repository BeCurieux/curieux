import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OccupancyBar } from "@/components/business/occupancy-bar";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { businessContext } from "@/lib/demo/context";
import { classSlug } from "@/lib/demo/service";
import { classViews } from "@/lib/domain/lessons";
import { listClasses } from "@/lib/domain/timetable";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { db } = await businessContext();
  const classes = await classViews(db, await listClasses(db));

  return (
    <div className="rise flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Classes</h1>
        <Button asChild>
          <Link href="/business/classes/new">
            <Plus aria-hidden />
            New class
          </Link>
        </Button>
      </div>
      {classes.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No classes yet">
          Create your first recurring class and we&apos;ll schedule its lessons.
        </EmptyState>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
          {classes.map((c) => (
            <li
              key={c.id}
              className={cn("border-b border-line last:border-b-0", !c.active && "opacity-60")}
            >
              <Link
                href={`/business/classes/${classSlug(c.id)}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 px-5 py-4 transition hover:bg-[#faf9fc] md:grid-cols-[190px_1fr_220px_140px_24px]"
              >
                <div>
                  <p className="font-display text-lg font-semibold">
                    {c.day} {c.time}
                  </p>
                  <p className="text-sm text-muted">{c.location}</p>
                </div>
                <p className="hidden font-semibold md:block">
                  {c.name}
                  {c.active ? (
                    ""
                  ) : (
                    <span className="ml-2 text-sm font-normal text-muted">Not running</span>
                  )}
                </p>
                <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                  <OccupancyBar
                    expected={c.expected}
                    vacancies={c.temporaryVacancies}
                    capacity={c.capacity}
                  />
                  <p className="tabular text-sm text-muted">
                    {c.expected} of {c.capacity} expected · {c.occupancy}%
                  </p>
                </div>
                <div className="row-start-1 flex flex-col items-end gap-1 text-sm md:row-auto md:items-start">
                  <span className="tabular text-muted">
                    {c.absences} {c.absences === 1 ? "absence" : "absences"}
                  </span>
                  {c.temporaryVacancies > 0 ? (
                    <span className="tabular font-semibold text-[#b4503d]">
                      {c.temporaryVacancies} to fill
                    </span>
                  ) : c.enrolled >= c.capacity ? (
                    <span className="font-semibold text-success">Full</span>
                  ) : (
                    <span className="tabular text-muted">
                      {c.capacity - c.enrolled} places free
                    </span>
                  )}
                </div>
                <ArrowRight aria-hidden className="hidden size-5 text-muted md:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
