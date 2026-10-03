import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AskFamiliesForm,
  DeleteTermButton,
  MoveOffer,
  PrepareButton,
  RecordAnswer,
  RemindButton,
  TermForm,
} from "@/components/business/term-forms";
import { CreateTermFeesButton } from "@/components/business/account-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { listClasses, type ClassSummary } from "@/lib/domain/timetable";
import {
  ANSWER_LABELS,
  getTerm,
  listTerms,
  OUTCOME_LABELS,
  schoolToday,
  shortDate,
  suggestedDates,
  termAsks,
  termSettings,
  termStage,
  termSummary,
  type ClassNextTerm,
  type OwnerAsk,
} from "@/lib/domain/terms";

export const metadata: Metadata = { title: "Term" };

const label = (c: ClassSummary) => `${c.name} · ${c.shortDay} ${c.time}`;

export default async function TermPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, organisationId } = await requireOwner();
  const term = await getTerm(db, id).catch(() => null);
  if (!term) notFound();
  const [terms, settings, asks, summary, classes] = await Promise.all([
    listTerms(db, organisationId),
    termSettings(db, organisationId),
    termAsks(db, id),
    termSummary(db, id),
    listClasses(db, { activeOnly: true }),
  ]);
  const today = schoolToday(settings.timezone);
  const stage = termStage(term, today);
  const open = stage === "planned" || stage === "asking";
  const suggested = suggestedDates(terms, term, today);
  const byClass = new Map(classes.map((c) => [c.id, c]));
  const counts = new Map(summary.map((s) => [s.classId, s]));
  const waiting = asks.filter((a) => !a.answer).length;

  // Classes with a child in them now, or one moving in.
  const shown = classes.filter(
    (c) => asks.some((a) => a.classId === c.id) || (counts.get(c.id)?.movingIn ?? 0) > 0,
  );

  return (
    <div className="rise flex flex-col gap-8">
      <BackLink href="/business/settings/terms">Terms</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{term.name}</h1>
        <p className="mt-1 text-muted">
          {shortDate(term.startsOn)} to {shortDate(term.endsOn)}
        </p>
      </div>

      {open ? (
        <section aria-labelledby="next-term" className="flex flex-col gap-4">
          <h2 id="next-term" className="font-display text-2xl font-semibold">
            Who&apos;s staying
          </h2>
          {asks.length === 0 ? (
            <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
              <p className="max-w-xl">
                Ovyko asks every family whether they&apos;re keeping their place for {term.name}.
                Get ready first: you&apos;ll see every child in a class now, and can offer moves up
                a level before families are asked.
              </p>
              <p className="text-sm text-muted">
                Suggested: ask around {shortDate(suggested.askOn)}, with replies by{" "}
                {shortDate(suggested.replyBy)}.
              </p>
              <PrepareButton termId={term.id} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
                {term.askedAt ? (
                  <p className="font-semibold">
                    Families were asked on {shortDate(term.askedAt.slice(0, 10))}, to reply by{" "}
                    {shortDate(term.replyBy!)}. {waiting === 0 ? "Everyone has answered." : null}
                    {waiting > 0 ? `${waiting} not answered yet.` : null}
                  </p>
                ) : (
                  <p className="max-w-xl">
                    Offer moves up below, then ask. Families get one email and answer in one tap.
                    Anyone who hasn&apos;t answered by the reply-by date keeps their place.
                  </p>
                )}
                <AskFamiliesForm
                  termId={term.id}
                  replyBy={term.replyBy ?? suggested.replyBy}
                  asked={term.askedAt !== null}
                />
                {term.askedAt && waiting > 0 ? <RemindButton termId={term.id} /> : null}
              </div>
              {shown.map((c) => (
                <ClassCard
                  key={c.id}
                  klass={c}
                  summary={counts.get(c.id)}
                  asks={asks.filter((a) => a.classId === c.id)}
                  movingIn={asks.filter((a) => a.offeredClassId === c.id)}
                  termId={term.id}
                  others={classes
                    .filter((o) => o.id !== c.id)
                    .map((o) => ({ id: o.id, label: label(o) }))}
                  byClass={byClass}
                />
              ))}
            </>
          )}
        </section>
      ) : asks.length > 0 ? (
        <section aria-labelledby="outcomes" className="flex flex-col gap-4">
          <h2 id="outcomes" className="font-display text-2xl font-semibold">
            What changed
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {asks.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <span>
                  <Link href={`/business/families/${a.familyId}`} className="font-semibold">
                    {a.childName}
                  </Link>
                  <span className="text-muted">
                    {" "}
                    · {byClass.get(a.classId)?.name ?? "A class"}
                    {a.outcome === "moved" && a.offeredClassId
                      ? ` → ${byClass.get(a.offeredClassId)?.name ?? "another class"}`
                      : null}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {a.outcome ? OUTCOME_LABELS[a.outcome] : "Waiting for the first day"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stage !== "finished" ? (
        <section
          aria-labelledby="term-fees"
          className="flex max-w-2xl flex-col gap-3 rounded-lg border border-line bg-surface p-5"
        >
          <h2 id="term-fees" className="font-display text-2xl font-semibold">
            Term fees
          </h2>
          <p className="text-muted">
            Adds each child&apos;s fee for {term.name} to their family&apos;s account: the
            class&apos;s price per lesson × its lessons in the term. Children leaving aren&apos;t
            charged; children moving up are charged for their new class
            {stage === "under_way" ? "; this term is under way, so only lessons left count" : ""}.
            Safe to run again: it only adds fees that are missing.
          </p>
          <CreateTermFeesButton termId={term.id} />
        </section>
      ) : null}

      <section aria-labelledby="change-term" className="flex max-w-2xl flex-col gap-4">
        <h2 id="change-term" className="font-display text-2xl font-semibold">
          Change the term
        </h2>
        {term.askedAt ? (
          <p className="text-sm text-muted">
            Families have been asked about this term, so only its name can change.
          </p>
        ) : null}
        <TermForm term={term} />
        {term.askedAt ? null : <DeleteTermButton termId={term.id} />}
      </section>
    </div>
  );
}

function ClassCard({
  klass,
  summary,
  asks,
  movingIn,
  termId,
  others,
  byClass,
}: {
  klass: ClassSummary;
  summary: ClassNextTerm | undefined;
  asks: OwnerAsk[];
  movingIn: OwnerAsk[];
  termId: string;
  others: { id: string; label: string }[];
  byClass: Map<string, ClassSummary>;
}) {
  return (
    <article
      aria-label={klass.name}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">{klass.name}</h3>
          <p className="text-sm text-muted">
            {klass.day} {klass.time} · {klass.location}
          </p>
        </div>
        {summary ? (
          <p className="rounded-full bg-surface-soft px-3 py-1 text-sm font-semibold">
            {summary.freeNextTerm} of {summary.capacity} free next term
          </p>
        ) : null}
      </div>
      {summary ? (
        <p className="text-sm text-muted">
          {[
            [summary.staying, "staying"],
            [summary.waiting, "not answered"],
            [summary.movingOut, "moving up"],
            [summary.leaving, "leaving"],
            [summary.movingIn, "moving in"],
          ]
            .filter(([n]) => (n as number) > 0)
            .map(([n, what]) => `${n} ${what}`)
            .join(" · ") || "No one yet"}
        </p>
      ) : null}
      {asks.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line">
          {asks.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 sm:w-1/3">
                <Link href={`/business/families/${a.familyId}`} className="font-semibold">
                  {a.childName}
                </Link>
                <p className="text-sm text-muted">
                  {ANSWER_LABELS[a.answer ?? "waiting"]}
                  {a.offeredClassId
                    ? ` · offered ${byClass.get(a.offeredClassId)?.name ?? "another class"}`
                    : null}
                </p>
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <MoveOffer
                  termId={termId}
                  askId={a.id}
                  child={a.childName}
                  offeredClassId={a.offeredClassId}
                  classes={others}
                />
                <RecordAnswer
                  termId={termId}
                  askId={a.id}
                  child={a.childName}
                  answer={a.answer}
                  canMove={a.offeredClassId !== null}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {movingIn.length > 0 ? (
        <p className="text-sm">
          <span className="font-semibold">Offered a place here:</span>{" "}
          {movingIn.map((a) => a.childName).join(", ")}
        </p>
      ) : null}
    </article>
  );
}
