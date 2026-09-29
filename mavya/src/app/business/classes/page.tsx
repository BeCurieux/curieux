import { ArrowRight, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OccupancyBar } from "@/components/business/occupancy-bar";
import { EmptyState } from "@/components/demo/empty-state";
import { businessContext } from "@/lib/demo/context";
import { allClasses, classSlug } from "@/lib/demo/service";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { state, demo } = await businessContext();
  const classes = demo ? allClasses(state) : [];

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Classes</h1>
      {classes.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No classes yet">
          Your recurring classes will be listed here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
          {classes.map((c) => (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/business/classes/${classSlug(c)}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 px-5 py-4 transition hover:bg-[#faf9fc] md:grid-cols-[180px_1fr_220px_140px_24px]"
              >
                <div>
                  <p className="font-display text-lg font-semibold">
                    {c.day} {c.time}
                  </p>
                  <p className="text-sm text-muted">{c.instructor}</p>
                </div>
                <p className="hidden font-semibold md:block">{c.level}</p>
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
                  ) : (
                    <span className="font-semibold text-success">Full</span>
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
