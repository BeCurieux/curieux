import { ArrowRight, Sparkles, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OccupancyBar } from "@/components/business/occupancy-bar";
import { Stat } from "@/components/business/stat";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { businessContext, firstName } from "@/lib/demo/context";
import { classSlug } from "@/lib/demo/service";
import { classViews, ownerNumbers, type ClassView } from "@/lib/domain/lessons";
import { listClasses } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Today" };

export default async function BusinessHome() {
  const { viewer, db, organisationName } = await businessContext();
  const classes = await classViews(db, await listClasses(db, { activeOnly: true }));

  if (classes.length === 0) {
    return (
      <div className="rise flex flex-col gap-8">
        <Heading name={viewer.name} org={organisationName} />
        <EmptyState icon={<Store />} title="Your timetable is empty">
          <Link href="/business/classes/new" className="font-semibold text-ink underline">
            Create your first class
          </Link>{" "}
          and today&apos;s numbers will show up here.
        </EmptyState>
      </div>
    );
  }

  const stats = await ownerNumbers(db, classes);
  const spots = stats.temporaryVacancies;
  const places = [...new Set(classes.map((c) => c.location))];

  return (
    <div className="rise flex flex-col gap-8">
      <Heading
        name={viewer.name}
        org={places.length === 1 ? `${organisationName} · ${places[0]}` : organisationName}
      />

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col justify-between gap-6 rounded-lg bg-ink p-7 text-white">
          <div className="flex flex-col gap-2">
            <p className="inline-flex items-center gap-2 font-semibold text-butter">
              <Sparkles aria-hidden className="size-5" />
              Fill empty spots
            </p>
            <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight">
              {spots} {spots === 1 ? "spot" : "spots"} can be filled this week
            </h2>
            <p className="max-w-md text-white/75">
              Absences opened temporary places. Families with make-up credits can take them.
            </p>
          </div>
          {spots > 0 ? (
            <Button asChild variant="warm" size="lg" className="w-fit">
              <Link href="/business/fill">
                Fill {spots} open {spots === 1 ? "spot" : "spots"}
              </Link>
            </Button>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Children expected today" value={stats.expectedToday} />
          <Stat label="Reported absences" value={stats.absencesThisWeek} />
          <Stat label="Temporary vacancies" value={spots} tone="attention" />
          <Stat label="Make-up credits expiring" value={stats.creditsExpiringThisWeek} />
          <Stat
            label="Capacity this week"
            value={stats.capacityPercent}
            suffix="%"
            className="col-span-2"
          />
        </dl>
      </section>

      <ClassCards classes={classes} />
    </div>
  );
}

function ClassCards({ classes }: { classes: ClassView[] }) {
  return (
    <section aria-labelledby="classes" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="classes" className="font-display text-2xl font-semibold tracking-tight">
          This week&apos;s classes
        </h2>
        <Link href="/business/classes" className="font-semibold text-muted hover:text-ink">
          All classes
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {classes.map((c) => (
          <li key={c.id}>
            <Link
              href={`/business/classes/${classSlug(c.id)}`}
              className="flex h-full flex-col gap-3 rounded-md border border-line bg-surface p-4 transition hover:border-ink"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-display text-lg font-semibold">
                  {c.shortDay} {c.time}
                  <span className="block text-sm font-semibold text-muted">{c.name}</span>
                </p>
                <ArrowRight aria-hidden className="size-4 text-muted" />
              </div>
              <OccupancyBar
                expected={c.expected}
                vacancies={c.temporaryVacancies}
                capacity={c.capacity}
              />
              <p className="tabular text-sm text-muted">
                {c.expected}/{c.capacity} expected
                {c.temporaryVacancies > 0 ? (
                  <span className="font-semibold text-[#b4503d]">
                    {" "}
                    · {c.temporaryVacancies} to fill
                  </span>
                ) : null}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Heading({ name, org }: { name: string; org: string }) {
  return (
    <div>
      <p className="font-semibold text-muted">{org}</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Hi {firstName(name)}</h1>
    </div>
  );
}
