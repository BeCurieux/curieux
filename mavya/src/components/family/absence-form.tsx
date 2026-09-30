"use client";

import { Check } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { Label } from "@/components/ui/label";
import { reportAbsence } from "@/lib/family/actions";
import { cn } from "@/lib/utils";

export type AbsenceLesson = { occurrenceId: string; title: string; detail: string };

// Which lesson, an optional reason, and the school's rules before confirming.
export function AbsenceForm({
  childId,
  lessons,
  rules,
  organisation,
}: {
  childId: string;
  lessons: AbsenceLesson[];
  rules: string[];
  organisation: string;
}) {
  return (
    <ActionForm
      action={reportAbsence}
      submitLabel="Confirm absence"
      pendingLabel="Letting them know…"
      variant="warm"
    >
      <input type="hidden" name="childId" value={childId} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-xl font-semibold">Which lesson?</legend>
        {lessons.map((lesson, i) => (
          <label key={lesson.occurrenceId} className="relative block cursor-pointer">
            <input
              type="radio"
              name="occurrenceId"
              value={lesson.occurrenceId}
              defaultChecked={i === 0}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex items-center gap-4 rounded-lg border-2 border-transparent bg-surface p-4 shadow-[0_1px_0_var(--border)] transition",
                "peer-checked:border-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt",
                "[&_.tick]:opacity-0 peer-checked:[&_.tick]:opacity-100",
              )}
            >
              <span className="flex-1">
                <span className="block text-lg font-semibold">{lesson.title}</span>
                <span className="block text-muted">{lesson.detail}</span>
              </span>
              <Check aria-hidden className="tick size-6 shrink-0" />
            </span>
          </label>
        ))}
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

      <section aria-labelledby="rules" className="rounded-lg bg-surface-soft p-5">
        <h2 id="rules" className="mb-3 font-semibold">
          How make-ups work at {organisation}
        </h2>
        <ul className="flex flex-col gap-2">
          {rules.map((line) => (
            <li key={line} className="flex gap-3">
              <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={3} />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </ActionForm>
  );
}
