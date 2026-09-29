import { CalendarX2, Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reportAbsence } from "@/lib/demo/actions";
import { familyContext } from "@/lib/demo/context";
import { MAKEUP_RULE, ORGANISATION } from "@/lib/demo/data";
import { findChild } from "@/lib/demo/service";

export const metadata: Metadata = { title: "Can't make it" };

export default async function AbsencePage() {
  const { state, demo } = await familyContext();
  if (!demo) {
    return (
      <EmptyState icon={<CalendarX2 />} title="No classes to miss">
        Once you have classes booked, you can let your provider know here.
      </EmptyState>
    );
  }

  const ava = findChild("ava", state)!;
  if (ava.away) redirect("/family/makeups");

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family">Home</BackLink>
      <div>
        <p className="font-semibold text-muted">Can&apos;t make it?</p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          Let {ORGANISATION.name} know
        </h1>
      </div>

      <form action={reportAbsence} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-display text-xl font-semibold">Which class?</legend>
          <div className="flex items-center gap-4 rounded-lg border-2 border-ink bg-surface p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-coral font-display text-xl font-semibold">
              A
            </span>
            <div className="flex-1">
              <p className="text-lg font-semibold">Ava · Swimming, {ava.level}</p>
              <p className="text-muted">
                {ava.schedule.day} {ava.schedule.time} · with {ORGANISATION.instructor}
              </p>
            </div>
            <Check aria-hidden className="size-6" />
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">
            Reason <span className="font-normal text-muted">(optional)</span>
          </Label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            maxLength={200}
            placeholder="Birthday party, feeling unwell…"
            className="w-full rounded-sm border border-line bg-surface px-4 py-3 text-base placeholder:text-muted focus-visible:border-cobalt"
          />
        </div>

        <section aria-labelledby="rule" className="rounded-lg bg-surface-soft p-5">
          <h2 id="rule" className="mb-3 font-semibold">
            How make-ups work at {ORGANISATION.name}
          </h2>
          <ul className="flex flex-col gap-2">
            {MAKEUP_RULE.map((line) => (
              <li key={line} className="flex gap-3">
                <Check
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-success"
                  strokeWidth={3}
                />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <Button type="submit" variant="warm" size="lg">
          Confirm absence
        </Button>
      </form>
    </div>
  );
}
