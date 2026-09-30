import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Problems, UndoImportButton } from "@/components/business/import-form";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { getImport, importSummary, type Counts } from "@/lib/domain/imports";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Import" };

const KINDS: { key: keyof Counts; label: string }[] = [
  { key: "classes", label: "Classes" },
  { key: "families", label: "Families" },
  { key: "children", label: "Children" },
  { key: "enrolments", label: "Places in classes" },
];

export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwner();
  const batch = /^[0-9a-f-]{36}$/.test(id) ? await getImport(db, id) : null;
  if (!batch) notFound();
  const { inOvyko, canUndo } = await importSummary(db, batch.id);
  const problems = batch.problems.filter((p) => !p.note);
  const notes = batch.problems.filter((p) => p.note);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings/import">Move your school in</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {batch.undoneAt ? "Import undone" : "Import saved"}
        </h1>
        <p className="mt-2 text-muted">
          {formatDateTime(batch.createdAt)}
          {batch.fileNames.length ? ` · ${batch.fileNames.join(", ")}` : null}
        </p>
      </div>

      <section
        aria-labelledby="matches"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div>
          <h2 id="matches" className="font-display text-xl font-semibold">
            Does it match?
          </h2>
          <p className="text-muted">
            Check these against your old system before you switch. The files had{" "}
            {batch.rows.classes} class rows and {batch.rows.students} student rows.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {KINDS.map((k) => (
            <li key={k.key} className="rounded-md border border-line p-4">
              <p className="font-semibold">{k.label}</p>
              <dl className="tabular mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Added</dt>
                  <dd className="font-display text-2xl font-semibold">{batch.added[k.key]}</dd>
                </div>
                <div>
                  <dt className="text-muted">Already here</dt>
                  <dd className="font-display text-2xl font-semibold">{batch.existing[k.key]}</dd>
                </div>
                <div>
                  <dt className="text-muted">In Ovyko now</dt>
                  <dd className="font-display text-2xl font-semibold">{inOvyko[k.key]}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          &ldquo;In Ovyko now&rdquo; counts what this import added that&apos;s still here.
        </p>
      </section>

      {problems.length ? (
        <Problems problems={problems} title="Rows that didn't come across" />
      ) : (
        <p className="rounded-lg bg-[#dcf1e7] p-5 font-semibold text-[#1d5a41]">
          Every row came across.
        </p>
      )}

      <Problems problems={notes} title="Worth knowing" />

      {!batch.undoneAt ? (
        canUndo ? (
          <section aria-labelledby="undo" className="flex flex-col gap-3">
            <h2 id="undo" className="font-display text-xl font-semibold">
              Something wrong?
            </h2>
            <p className="text-muted">
              Undo removes everything this import added. You can do it for 14 days, until lessons
              are marked or families start using it.
            </p>
            <UndoImportButton batchId={batch.id} />
          </section>
        ) : (
          <p className="text-muted">
            This import can no longer be undone: it&apos;s more than 14 days old, or what it added
            is being used. Change things one by one instead.
          </p>
        )
      ) : (
        // Also what the owner sees straight after undoing: the page reloads
        // without the undo button, so the confirmation lives here.
        <p role="status" className="rounded-lg bg-[#dcf1e7] p-5 font-semibold text-[#1d5a41]">
          Undone {formatDateTime(batch.undoneAt)}. Everything this import added has been removed.
        </p>
      )}
    </div>
  );
}
