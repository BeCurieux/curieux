import { ArrowRight, CalendarCheck2, CalendarX2, MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityPass } from "@/components/demo/activity-pass";
import { EmptyState } from "@/components/demo/empty-state";
import { ProgressRing } from "@/components/demo/progress-ring";
import { Button } from "@/components/ui/button";
import { firstName, familyContext } from "@/lib/demo/context";
import { AVA_ID, MESSAGES, PRIMARY_CLASS_ID } from "@/lib/demo/data";
import { familyChildren } from "@/lib/demo/family";
import { EMPTY_STATE } from "@/lib/demo/state-schema";
import { myNotifications } from "@/lib/domain/notifications";

export const metadata: Metadata = { title: "Home" };

export default async function FamilyHome() {
  const { viewer, state, db, demo } = await familyContext();
  const children = await familyChildren(db, demo ? state : EMPTY_STATE);
  const familyName = viewer.families.map((f) => f.displayName).join(" · ");
  const passes = children.flatMap((child) => child.classes.map((klass) => ({ child, klass })));

  if (passes.length === 0) {
    return (
      <>
        <Greeting name={viewer.name} family={familyName} />
        <EmptyState icon={<CalendarCheck2 />} title="Nothing on this week">
          When your activity provider adds your classes, your week will show up here.
        </EmptyState>
      </>
    );
  }

  // The absence card is demo until M4, for Ava only.
  const ava = demo ? children.find((c) => c.id === AVA_ID) : undefined;
  const learning = children.filter((c) => c.progress);
  // The newest achievement, or else the demo's newest message.
  const [newest] = await myNotifications(db, 1);
  const demoMessage = MESSAGES[0]!.messages[0]!;
  const latest = newest
    ? { from: newest.organisation, title: `${newest.childFirstName} achieved ${newest.skill}` }
    : demo
      ? { from: demoMessage.from, title: demoMessage.title }
      : null;

  return (
    <div className="rise flex flex-col gap-6">
      <Greeting name={viewer.name} family={familyName} />

      <section aria-labelledby="this-week" className="flex flex-col gap-4">
        <h2 id="this-week" className="font-display text-xl font-semibold">
          This week
        </h2>
        {passes.map(({ child, klass }) => (
          <Link
            key={`${child.id}-${klass.id}`}
            href={`/family/kids/${child.slug}`}
            className="rounded-lg focus-visible:outline-offset-4"
          >
            <ActivityPass
              colour={child.colour}
              provider={child.organisation}
              activity={klass.program === "Learn to Swim" ? "Swimming" : klass.program}
              level={klass.level}
              child={child.firstName}
              when={`${klass.day} · ${klass.time}`}
              status={
                child.away && klass.id === PRIMARY_CLASS_ID ? (
                  <span className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">
                    Away
                  </span>
                ) : null
              }
            />
          </Link>
        ))}
      </section>

      {ava ? (
        <ActionCard
          state={ava.makeup ? "booked" : ava.away ? "credit" : "ask"}
          makeupWhen={ava.makeup ? `${ava.makeup.day} ${ava.makeup.time}` : null}
        />
      ) : null}

      {learning.map((child) => {
        const next = child.progress!.skills.find((s) => s.status !== "achieved");
        return (
          <Link
            key={child.id}
            href={`/family/kids/${child.slug}`}
            className="flex items-center gap-4 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)] transition hover:bg-white/70"
          >
            <ProgressRing
              value={child.progress!.progress}
              size={76}
              stroke={9}
              className="shrink-0 text-cobalt [&_span]:text-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted">Next milestone</p>
              <p className="text-lg leading-snug font-semibold">
                {next
                  ? `${child.firstName} is working on ${next.name}`
                  : `${child.firstName} has every skill!`}
              </p>
            </div>
            <ArrowRight aria-hidden className="size-5 shrink-0 text-muted" />
          </Link>
        );
      })}

      {latest ? (
        <Link
          href="/family/messages"
          className="flex items-start gap-4 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)] transition hover:bg-white/70"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-butter [&_svg]:size-5">
            <MessageCircle aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{latest.from}</p>
            <p className="font-semibold">{latest.title}</p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}

function Greeting({ name, family }: { name: string; family: string }) {
  return (
    <div>
      <p className="font-semibold text-muted">{family}</p>
      <h1 className="font-display text-[2.5rem] leading-tight font-semibold tracking-tight">
        Hi {firstName(name)}
      </h1>
    </div>
  );
}

function ActionCard({
  state,
  makeupWhen,
}: {
  state: "ask" | "credit" | "booked";
  makeupWhen: string | null;
}) {
  if (state === "booked") {
    return (
      <div className="flex items-center gap-4 rounded-lg bg-[#dcf1e7] p-5 text-[#1d5a41]">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/70 [&_svg]:size-6">
          <CalendarCheck2 aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">Ava&apos;s make-up is booked</p>
          <p>{makeupWhen} · Dolphin 3</p>
        </div>
      </div>
    );
  }

  if (state === "credit") {
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-ink p-5 text-white">
        <div className="flex items-center gap-3">
          <Sparkles aria-hidden className="size-6 text-butter" />
          <p className="text-lg font-semibold">Ava has a make-up credit</p>
        </div>
        <Button asChild variant="warm" size="lg">
          <Link href="/family/makeups">Find a make-up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-ink p-5 text-white">
      <div className="flex items-center gap-3">
        <CalendarX2 aria-hidden className="size-6 text-coral" />
        <div>
          <p className="text-lg font-semibold">Can&apos;t make Wednesday?</p>
          <p className="text-white/75">Let Aqua House know and get a make-up.</p>
        </div>
      </div>
      <Button asChild variant="warm" size="lg">
        <Link href="/family/absence">Can&apos;t make it</Link>
      </Button>
    </div>
  );
}
