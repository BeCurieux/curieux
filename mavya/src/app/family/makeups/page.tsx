import { CalendarCheck2, Check, Info, Sparkles, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { ConfirmMakeup } from "@/components/family/makeup-buttons";
import { Button } from "@/components/ui/button";
import { familyContext } from "@/lib/demo/context";
import type { Db } from "@/lib/domain/db";
import {
  availableCredits,
  getPolicy,
  makeupOptions,
  policySummary,
  rankOptions,
  type Credit,
  type MakeupOption,
} from "@/lib/domain/makeups";
import { familyChildren, type FamilyChildView } from "@/lib/family/children";
import { lessonMoment } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Make-ups" };

const uuid = z.uuid();

export default async function MakeupsPage({
  searchParams,
}: {
  searchParams: Promise<{ credit?: string; pick?: string; booked?: string; away?: string }>;
}) {
  const params = await searchParams;
  const { db } = await familyContext();
  const children = await familyChildren(db);

  if (params.booked && uuid.safeParse(params.booked).success) {
    const booked = await bookedMakeup(db, params.booked, children);
    if (booked) return <Booked {...booked} />;
  }
  if (params.away && uuid.safeParse(params.away).success) {
    const away = await absenceWithoutCredit(db, params.away, children);
    if (away) return <NoCredit {...away} />;
  }

  const credits = await availableCredits(
    db,
    children.map((c) => c.id),
  );
  if (credits.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/family">Home</BackLink>
        <EmptyState icon={<Sparkles />} title="No make-up credits right now">
          When you let your provider know you can&apos;t make a class, your make-up options will
          show up here.
        </EmptyState>
      </div>
    );
  }

  const credit = credits.find((c) => c.id === params.credit) ?? credits[0]!;
  const child = children.find((c) => c.id === credit.childId)!;
  const choices = rankOptions(await makeupOptions(db, credit.id), credit.sourceStartsAt);
  const all = choices.flatMap((c) => c.lessons);
  const selected =
    all.find((o) => o.occurrenceId === params.pick) ?? choices[0]?.lessons[0] ?? null;
  const [best, ...others] = choices;
  const href = (o: MakeupOption) => `/family/makeups?credit=${credit.id}&pick=${o.occurrenceId}`;

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family">Home</BackLink>

      {credits.length > 1 ? (
        <nav aria-label="Credits" className="flex flex-wrap gap-2">
          {credits.map((c) => (
            <Link
              key={c.id}
              href={`/family/makeups?credit=${c.id}`}
              aria-current={c.id === credit.id ? "true" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 font-semibold transition",
                c.id === credit.id ? "bg-ink text-white" : "bg-surface hover:bg-surface-soft",
              )}
            >
              {creditLabel(c, children)}
            </Link>
          ))}
        </nav>
      ) : null}

      <div>
        <p className="font-semibold text-muted">
          {child.firstName}&apos;s make-up credit · {expiresIn(credit.expiresAt)}
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          {choices.length === 0
            ? "No classes have room right now"
            : `We found ${choices.length} ${choices.length === 1 ? "class" : "classes"} that fit`}
        </h1>
        {choices.length === 0 ? (
          <p className="mt-2 text-muted">
            Places open up when other families report absences. Check back soon; your credit keeps
            until it expires.
          </p>
        ) : null}
      </div>

      {best ? (
        <section aria-labelledby="best-fit" className="flex flex-col gap-3">
          <h2 id="best-fit" className="inline-flex items-center gap-2 font-semibold">
            <Star aria-hidden className="size-5 fill-butter text-[#b48a1a]" />
            Best fit
          </h2>
          <ChoiceCard lessons={best.lessons} selected={selected} href={href} big />
        </section>
      ) : null}

      {others.length > 0 ? (
        <section aria-labelledby="more" className="flex flex-col gap-3">
          <h2 id="more" className="font-semibold">
            Also available
          </h2>
          {others.map((c) => (
            <ChoiceCard key={c.classId} lessons={c.lessons} selected={selected} href={href} />
          ))}
        </section>
      ) : null}

      {selected ? (
        <ConfirmMakeup
          key={selected.occurrenceId}
          creditId={credit.id}
          occurrenceId={selected.occurrenceId}
          child={child.firstName}
          summary={(() => {
            const m = lessonMoment(selected.startsAt, selected.timezone);
            return `${m.day} ${m.date} · ${m.time}`;
          })()}
        />
      ) : null}
    </div>
  );
}

function creditLabel(c: Credit, children: FamilyChildView[]) {
  const name = children.find((k) => k.id === c.childId)?.firstName ?? "";
  return c.sourceStartsAt
    ? `${name} · missed ${lessonMoment(c.sourceStartsAt, "Australia/Sydney").date}`
    : name;
}

function expiresIn(iso: string) {
  const days = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
  return days <= 1 ? "expires tomorrow" : `expires in ${days} days`;
}

// One class: its soonest lesson as the card, later dates as smaller links.
function ChoiceCard({
  lessons,
  selected,
  href,
  big = false,
}: {
  lessons: MakeupOption[];
  selected: MakeupOption | null;
  href: (o: MakeupOption) => string;
  big?: boolean;
}) {
  const shown = lessons.find((l) => l.occurrenceId === selected?.occurrenceId) ?? lessons[0]!;
  const isSelected = shown.occurrenceId === selected?.occurrenceId;
  const m = lessonMoment(shown.startsAt, shown.timezone);
  const spots = `${shown.freePlaces} ${shown.freePlaces === 1 ? "spot" : "spots"} left`;
  const later = lessons.filter((l) => l.occurrenceId !== shown.occurrenceId);
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={href(shown)}
        scroll={false}
        replace
        aria-current={isSelected ? "true" : undefined}
        aria-label={`${m.day} ${m.time}, ${shown.level}, ${m.date}, ${spots}${isSelected ? ", selected" : ""}`}
        className={cn(
          "flex items-center gap-4 rounded-lg border-2 bg-surface p-4 transition",
          isSelected
            ? "border-ink"
            : "border-transparent shadow-[0_1px_0_var(--border)] hover:border-line",
          big && "p-5",
        )}
      >
        <div
          className={cn(
            "grid shrink-0 place-items-center rounded-md bg-surface-soft text-center font-display leading-tight font-semibold",
            big ? "size-16 text-lg" : "size-14",
          )}
        >
          {m.day.slice(0, 3)}
        </div>
        <div className="flex-1">
          <p className={cn("font-semibold", big ? "text-xl" : "text-lg")}>
            {m.day} {m.time}
          </p>
          <p className="text-muted">
            {m.date} · {shown.level}
            {shown.instructor ? ` · ${shown.instructor}` : ""} · {shown.location}
          </p>
          <p className="mt-1 text-sm font-semibold text-success">{spots}</p>
        </div>
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border-2",
            isSelected ? "border-ink bg-ink text-white" : "border-line",
          )}
        >
          {isSelected ? <Check className="size-4" strokeWidth={3} /> : null}
        </span>
      </Link>
      {later.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 pl-2 text-sm">
          <span className="text-muted">Or</span>
          {later.map((l) => {
            const lm = lessonMoment(l.startsAt, l.timezone);
            return (
              <Link
                key={l.occurrenceId}
                href={href(l)}
                scroll={false}
                replace
                className="inline-flex h-9 items-center rounded-full bg-surface px-3 font-semibold shadow-[0_1px_0_var(--border)] hover:bg-surface-soft"
              >
                {lm.date}
              </Link>
            );
          })}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ outcomes

async function bookedMakeup(db: Db, bookingId: string, children: FamilyChildView[]) {
  const { data } = await db
    .from("makeup_bookings")
    .select(
      "child_id, class_occurrences (starts_at, classes (level_id, levels!classes_organisation_id_level_id_fkey (name), locations (name, timezone))), makeup_credits (class_occurrences (starts_at))",
    )
    .eq("id", bookingId)
    .eq("status", "booked")
    .maybeSingle();
  const row = data as unknown as {
    child_id: string;
    class_occurrences: {
      starts_at: string;
      classes: {
        levels: { name: string } | null;
        locations: { name: string; timezone: string } | null;
      } | null;
    } | null;
    makeup_credits: { class_occurrences: { starts_at: string } | null } | null;
  } | null;
  const child = children.find((c) => c.id === row?.child_id);
  if (!row?.class_occurrences || !child) return null;
  const tz = row.class_occurrences.classes?.locations?.timezone ?? "Australia/Sydney";
  const when = lessonMoment(row.class_occurrences.starts_at, tz);
  const missed = row.makeup_credits?.class_occurrences?.starts_at;
  return {
    child: child.firstName,
    slug: child.slug,
    when: `${when.day} ${when.time}`,
    detail: `${when.date} · ${row.class_occurrences.classes?.levels?.name ?? ""} · ${row.class_occurrences.classes?.locations?.name ?? child.organisation}`,
    missedDay: missed ? lessonMoment(missed, tz).day : null,
  };
}

function Booked({
  child,
  slug,
  when,
  detail,
  missedDay,
}: {
  child: string;
  slug: string;
  when: string;
  detail: string;
  missedDay: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center">
      <div className="animate-pop grid size-24 place-items-center rounded-full bg-success text-white shadow-[0_12px_30px_-10px_var(--success)]">
        <Check aria-hidden className="size-12" strokeWidth={3} />
      </div>
      <div role="status">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          You&apos;re booked in!
        </h1>
        <p className="mt-2 text-lg text-muted">{child}&apos;s make-up is locked in.</p>
      </div>
      <div className="flex w-full items-center gap-4 rounded-lg bg-surface p-5 text-left shadow-[0_1px_0_var(--border)]">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#dcf1e7] text-[#23694c] [&_svg]:size-6">
          <CalendarCheck2 aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">{when}</p>
          <p className="text-muted">{detail}</p>
        </div>
      </div>
      {missedDay ? (
        <p className="text-muted">
          {child}&apos;s {missedDay} spot is now free for another family.
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-3">
        <Button asChild size="lg">
          <Link href={`/family/kids/${slug}`}>See {child}&apos;s progress</Link>
        </Button>
        <Button asChild variant="soft" size="lg">
          <Link href="/family">Back home</Link>
        </Button>
      </div>
    </div>
  );
}

async function absenceWithoutCredit(db: Db, absenceId: string, children: FamilyChildView[]) {
  const { data } = await db
    .from("absences")
    .select("child_id, make_up_eligible, organisation_id")
    .eq("id", absenceId)
    .maybeSingle();
  const child = children.find((c) => c.id === data?.child_id);
  if (!data || data.make_up_eligible || !child) return null;
  const policy = await getPolicy(db, data.organisation_id);
  return {
    child: child.firstName,
    organisation: child.organisation,
    rules: policySummary(policy, child.primary?.level ?? null),
  };
}

function NoCredit({
  child,
  organisation,
  rules,
}: {
  child: string;
  organisation: string;
  rules: string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/family">Home</BackLink>
      <div role="status">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          Thanks, {organisation} knows
        </h1>
        <p className="mt-2 text-lg text-muted">
          {child}&apos;s instructor will see they&apos;re away. This absence doesn&apos;t come with
          a make-up credit.
        </p>
      </div>
      <section aria-labelledby="rules" className="rounded-lg bg-surface-soft p-5">
        <h2 id="rules" className="mb-3 inline-flex items-center gap-2 font-semibold">
          <Info aria-hidden className="size-5" />
          How make-ups work at {organisation}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {rules.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <Button asChild variant="soft" size="lg">
        <Link href="/family">Back home</Link>
      </Button>
    </div>
  );
}
