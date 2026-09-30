import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OfferButton, OfferState } from "@/components/business/offer-button";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { businessContext } from "@/lib/demo/context";
import { classSlug } from "@/lib/demo/service";
import { candidates, openSpots, type Candidate } from "@/lib/domain/fill";
import { listClasses } from "@/lib/domain/timetable";
import { formatLessonDate } from "@/lib/format";

export const metadata: Metadata = { title: "Fill open spots" };

export default async function FillPage() {
  const { db, organisationId } = await businessContext();
  const [spots, classes] = await Promise.all([
    openSpots(db, organisationId),
    listClasses(db, { activeOnly: true }),
  ]);
  const classById = new Map(classes.map((c) => [c.id, c]));
  const lists = await Promise.all(spots.map((s) => candidates(db, s.occurrenceId)));
  const total = spots.reduce((sum, s) => sum + s.spots, 0);

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business">Today</BackLink>
      <div>
        <p className="font-semibold text-muted">Fill empty spots</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {total} open {total === 1 ? "spot" : "spots"}, ready to offer
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Places freed by absences in the next 7 days. These children hold a make-up credit that
          fits. With automatic offers on, the best fit is offered each spot for you; you can also
          offer one yourself. The first to claim gets it.
        </p>
      </div>

      {spots.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="Every spot is filled">
          New spots open up here when families report absences.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {spots.map((spot, i) => {
            const c = classById.get(spot.classId);
            if (!c) return null;
            const heading = `${c.level} · ${c.day} ${c.time}`;
            return (
              <section
                key={spot.occurrenceId}
                aria-labelledby={`spot-${spot.occurrenceId}`}
                className="flex flex-col rounded-lg border border-line bg-surface"
              >
                <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <h2
                      id={`spot-${spot.occurrenceId}`}
                      className="font-display text-xl font-semibold"
                    >
                      {heading}
                    </h2>
                    <p className="text-sm text-muted">
                      {formatLessonDate(spot.startsAt, c.timezone)} ·{" "}
                      <Link
                        href={`/business/classes/${classSlug(c.id)}`}
                        className="font-semibold hover:text-ink"
                      >
                        View class
                      </Link>
                    </p>
                  </div>
                  <span className="tabular rounded-full bg-[#fff0ec] px-3 py-1 text-sm font-bold text-[#b4503d]">
                    {spot.spots} {spot.spots === 1 ? "spot" : "spots"}
                  </span>
                </header>
                <CandidateList
                  occurrenceId={spot.occurrenceId}
                  list={lists[i]!}
                  timezone={c.timezone}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CandidateList({
  occurrenceId,
  list,
  timezone,
}: {
  occurrenceId: string;
  list: Candidate[];
  timezone: string;
}) {
  if (list.length === 0)
    return <p className="px-5 py-4 text-muted">No families with credits fit this lesson yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {list.map((p) => (
        <li key={p.childId} className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="font-semibold">{p.name}</p>
            <p className="text-sm text-muted">
              {p.family} · credit ends {formatLessonDate(p.creditExpiresAt, timezone)}
            </p>
          </div>
          {p.offerStatus === "offered" ||
          p.offerStatus === "claimed" ||
          p.offerStatus === "declined" ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <OfferState status={p.offerStatus} />
              {p.offerStatus === "offered" && p.offerAutomatic ? (
                <p className="text-sm text-muted">
                  Offered automatically
                  {p.offerExpiresAt ? ` · ${timeLeft(p.offerExpiresAt)}` : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <OfferButton occurrenceId={occurrenceId} childId={p.childId} name={p.name} />
          )}
        </li>
      ))}
    </ul>
  );
}

// "1h 20m left", for an open offer.
function timeLeft(iso: string) {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h ? `${h}h ` : ""}${m}m left`;
}
