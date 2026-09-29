import { Check, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { offerSpot } from "@/lib/demo/actions";
import { businessContext } from "@/lib/demo/context";
import { candidatesFor, classSlug, withDemo } from "@/lib/demo/service";
import { listClasses } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Fill open spots" };

export default async function FillPage() {
  const { db, state, demo } = await businessContext();
  const open = demo
    ? (await listClasses(db, { activeOnly: true }))
        .map((c) => withDemo(c, state))
        .filter((c) => c.temporaryVacancies > 0)
    : [];
  const total = open.reduce((sum, c) => sum + c.temporaryVacancies, 0);

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business">Today</BackLink>
      <div>
        <p className="font-semibold text-muted">Fill empty spots</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {total} open {total === 1 ? "spot" : "spots"}, ready to offer
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          These children have make-up credits and fit the level. Offer a spot and the family gets a
          message they can accept in one tap.
        </p>
      </div>

      {open.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="Every spot is filled">
          New spots open up here when families report absences.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((c) => {
            const candidates = candidatesFor(c.id, state);
            return (
              <section
                key={c.id}
                aria-labelledby={`class-${c.id}`}
                className="flex flex-col rounded-lg border border-line bg-surface"
              >
                <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <h2 id={`class-${c.id}`} className="font-display text-xl font-semibold">
                      {c.level} · {c.day} {c.time}
                    </h2>
                    <Link
                      href={`/business/classes/${classSlug(c.id)}`}
                      className="text-sm font-semibold text-muted hover:text-ink"
                    >
                      View class
                    </Link>
                  </div>
                  <span className="tabular rounded-full bg-[#fff0ec] px-3 py-1 text-sm font-bold text-[#b4503d]">
                    {c.temporaryVacancies} {c.temporaryVacancies === 1 ? "spot" : "spots"}
                  </span>
                </header>
                <ul className="flex flex-col divide-y divide-line">
                  {candidates.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-semibold">{p.child}</p>
                        <p className="text-sm text-muted">
                          {p.family} family · {p.creditNote}
                        </p>
                      </div>
                      {p.offered ? (
                        <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#dcf1e7] px-4 text-sm font-semibold text-[#23694c]">
                          <Check aria-hidden className="size-4" strokeWidth={3} />
                          Offered
                        </span>
                      ) : (
                        <form action={offerSpot.bind(null, p.id)}>
                          <Button type="submit" size="sm" aria-label={`Offer spot to ${p.child}`}>
                            Offer spot
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                  {candidates.length === 0 ? (
                    <li className="px-5 py-4 text-muted">
                      No families with credits fit this class yet.
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
