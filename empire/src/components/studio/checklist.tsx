"use client";

import { useRef, useState, useTransition } from "react";
import { updateTaskAction } from "@/app/studio/actions";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/domain/records";

export interface ChecklistRow {
  id: string;
  category: string;
  label: string;
  what: string;
  why: string;
  output: string;
  tool: string;
  status: TaskStatus;
  notes: string;
}

const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

function Task({ task, readOnly }: { task: ChecklistRow; readOnly: boolean }) {
  const [status, setStatus] = useState(task.status);
  const [notes, setNotes] = useState(task.notes);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = (patch: { status?: TaskStatus; notes?: string }) => {
    setSaved("saving");
    startTransition(async () => {
      const result = await updateTaskAction(task.id, patch);
      setSaved(result.ok ? "saved" : "error");
    });
  };

  return (
    <li className="border-line bg-paper rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3
          className={`font-sans text-lg font-semibold ${status === "complete" ? "text-success" : "text-ink"}`}
        >
          {task.label}
        </h3>
        <div className="flex items-center gap-2">
          <label htmlFor={`s-${task.id}`} className="sr-only">
            Status for {task.label}
          </label>
          <select
            id={`s-${task.id}`}
            value={status}
            disabled={readOnly}
            onChange={(e) => {
              const next = e.target.value as TaskStatus;
              setStatus(next);
              save({ status: next });
            }}
            className="field-input min-h-11 w-auto py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">What to do</dt>
          <dd className="text-ink-soft">{task.what}</dd>
        </div>
        <div>
          <dt className="font-semibold">Why it matters</dt>
          <dd className="text-ink-soft">{task.why}</dd>
        </div>
        <div>
          <dt className="font-semibold">You'll end up with</dt>
          <dd className="text-ink-soft">{task.output}</dd>
        </div>
        <div>
          <dt className="font-semibold">Use</dt>
          <dd className="text-ink-soft">{task.tool}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <label htmlFor={`n-${task.id}`} className="text-sm font-semibold">
          Notes
        </label>
        <textarea
          id={`n-${task.id}`}
          value={notes}
          readOnly={readOnly}
          rows={2}
          maxLength={2000}
          onChange={(e) => {
            const value = e.target.value;
            setNotes(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => save({ notes: value }), 800);
          }}
          className="field-input mt-1 text-sm"
        />
        <p aria-live="polite" className="text-ink-soft mt-1 h-4 text-xs">
          {saved === "saving"
            ? "Saving…"
            : saved === "saved"
              ? "Saved"
              : saved === "error"
                ? "Couldn't save — check your connection."
                : ""}
        </p>
      </div>
    </li>
  );
}

export function Checklist({ tasks, readOnly }: { tasks: ChecklistRow[]; readOnly: boolean }) {
  const categories = [...new Set(tasks.map((t) => t.category))];
  return (
    <div className="space-y-10">
      {categories.map((category) => {
        const rows = tasks.filter((t) => t.category === category);
        const done = rows.filter(
          (t) => t.status === "complete" || t.status === "not_applicable",
        ).length;
        return (
          <section key={category} aria-labelledby={`c-${category}`}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 id={`c-${category}`} className="text-2xl">
                {category}
              </h2>
              <p className="text-ink-soft text-sm">
                {done} of {rows.length}
              </p>
            </div>
            <ul className="space-y-3">
              {rows.map((t) => (
                <Task key={t.id} task={t} readOnly={readOnly} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
