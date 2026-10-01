"use client";

import { useState, useTransition } from "react";
import { setLessonReminders } from "@/lib/family/actions";

// Lesson-day reminder emails, on or off.
export function RemindersSwitch({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between gap-4 px-5 py-4">
      <span>
        <span className="block text-lg font-semibold">Lesson-day reminders</span>
        <span className="block text-sm text-muted">
          An email at 7am on days your children have a lesson.
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setValue(next);
          start(async () => {
            await setLessonReminders(next);
          });
        }}
        className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-ink checked:before:translate-x-5"
      />
    </label>
  );
}
