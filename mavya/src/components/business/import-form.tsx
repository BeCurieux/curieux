"use client";

import { useActionState, useTransition, useState } from "react";
import { ActionForm, FormShell } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { checkImport, confirmImport, undoImport, type ImportState } from "@/lib/business/actions";
import type { Counts, ImportProblem } from "@/lib/domain/imports";
import type { FormState } from "@/lib/forms";

const KINDS: { key: keyof Counts; one: string; many: string }[] = [
  { key: "classes", one: "class", many: "classes" },
  { key: "families", one: "family", many: "families" },
  { key: "children", one: "child", many: "children" },
  { key: "enrolments", one: "place in a class", many: "places in classes" },
];

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function FileField({ name, label, hint }: { name: string; label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`file-${name}`}>
        {label} <span className="font-normal text-muted">(CSV)</span>
      </Label>
      <input
        id={`file-${name}`}
        name={name}
        type="file"
        accept=".csv,text/csv"
        aria-describedby={`file-${name}-hint`}
        className="rounded-sm border border-line bg-surface p-3 text-base file:mr-4 file:h-10 file:rounded-full file:border-0 file:bg-surface-soft file:px-4 file:font-semibold"
      />
      <p id={`file-${name}-hint`} className="text-sm text-muted">
        {hint}
      </p>
    </div>
  );
}

export function Problems({ problems, title }: { problems: ImportProblem[]; title: string }) {
  if (problems.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-semibold">
        {title} ({problems.length})
      </h3>
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {[...problems]
          .sort((a, b) => (a.file === b.file ? a.row - b.row : a.file === "classes" ? -1 : 1))
          .map((p, i) => (
            <li key={i} className="rounded-md bg-surface-soft px-4 py-3">
              <span className="font-semibold">
                {p.file === "classes" ? "Classes" : "Students"} file, row {p.row}:
              </span>{" "}
              {p.message}
            </li>
          ))}
      </ul>
    </section>
  );
}

// Upload → check → confirm. Nothing is saved until the owner confirms.
export function ImportForm() {
  const [checked, check, checking] = useActionState(checkImport, {} as ImportState);
  const report = checked.report;
  const adds = report ? KINDS.filter((k) => report.added[k.key] > 0) : [];
  const already = report ? KINDS.filter((k) => report.existing[k.key] > 0) : [];
  return (
    <div className="flex flex-col gap-6">
      <FormShell
        action={check}
        state={checked}
        pending={checking}
        submitLabel="Check the files"
        pendingLabel="Checking…"
      >
        <FileField
          name="classes"
          label="Classes"
          hint="One row per class: Class, Level, Location, Day, Start time, Duration (minutes), Capacity, and Instructor email if you like."
        />
        <FileField
          name="students"
          label="Students"
          hint="One row per child: First name, Last name, Date of birth, Parent name, Parent email, Parent phone, and their Class (with Class day and Class time if names repeat)."
        />
      </FormShell>

      {report ? (
        <section
          aria-labelledby="import-check"
          className="flex flex-col gap-5 rounded-lg border-2 border-ink bg-surface p-5"
        >
          <h2 id="import-check" className="font-display text-xl font-semibold">
            {adds.length ? "Importing these files will add:" : "Nothing new to add."}
          </h2>
          {adds.length ? (
            <ul className="flex flex-col gap-1 text-lg">
              {adds.map((k) => (
                <li key={k.key}>
                  <strong>{count(report.added[k.key], k.one, k.many)}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          {already.length ? (
            <p className="text-muted">
              Already in Ovyko, so skipped:{" "}
              {already.map((k) => count(report.existing[k.key], k.one, k.many)).join(", ")}.
            </p>
          ) : null}
          <Problems problems={report.problems} title="Rows that won't come across" />
          <Problems problems={report.notes} title="Worth knowing" />
          {adds.length && checked.rows ? (
            <ActionForm
              action={confirmImport}
              submitLabel="Import now"
              pendingLabel="Importing…"
              variant="warm"
            >
              <input type="hidden" name="rows" value={checked.rows} />
              <p className="text-muted">
                You can undo this for 14 days, until lessons are marked or families start using it.
              </p>
            </ActionForm>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function UndoImportButton({ batchId }: { batchId: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {state.error ? (
        <p role="alert" className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-md bg-[#dcf1e7] px-4 py-3 font-semibold text-[#1d5a41]">
          {state.ok}
        </p>
      ) : sure ? (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="warm"
            disabled={pending}
            onClick={() => start(async () => setState(await undoImport(batchId)))}
          >
            {pending ? "Undoing…" : "Yes, remove everything it added"}
          </Button>
          <Button variant="ghost" onClick={() => setSure(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button variant="soft" className="w-fit" onClick={() => setSure(true)}>
          Undo this import
        </Button>
      )}
    </div>
  );
}
