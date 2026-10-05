"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { ActionForm, FormShell } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { checkImport, confirmImport, undoImport, type ImportState } from "@/lib/business/actions";
import {
  FIELDS,
  FILE_LABELS,
  FILES,
  matchColumns,
  needLabel,
  readHeaders,
  type Chosen,
  type ImportFile,
} from "@/lib/domain/import-columns";
import type { Counts, ImportProblem, Money } from "@/lib/domain/imports";
import { formatMoney } from "@/lib/domain/accounts";
import type { FormState } from "@/lib/forms";

const KINDS: { key: keyof Counts; one: string; many: string }[] = [
  { key: "classes", one: "class", many: "classes" },
  { key: "families", one: "family", many: "families" },
  { key: "children", one: "child", many: "children" },
  { key: "enrolments", one: "place in a class", many: "places in classes" },
  { key: "balances", one: "family balance", many: "family balances" },
  { key: "credits", one: "make-up credit", many: "make-up credits" },
];

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

const HINTS: Record<ImportFile, string> = {
  classes:
    "One row per class: Class, Level, Location, Day, Start time, Length (or End time), Places, and Instructor email if you like.",
  students:
    "One row per child: First and last name (or one Name column), Date of birth, Parent name, email and phone, and their Class (with Class day and Class time if names repeat).",
  balances:
    "One row per family: Parent email (or phone) and their Balance owing. A family in credit has a negative balance, or use a Credit column. Due date if you like.",
  credits:
    "One row per child with unused make-up credits: their name, Parent email or phone (or Date of birth), the number of Make-up credits, and when they expire.",
};

// A file, and which of its columns Ovyko will read for each detail. The
// matches are worked out in the browser as soon as a file is chosen, and
// sent with it (map.<file>.<detail>), so the owner's choices are used.
function FileField({ file }: { file: ImportFile }) {
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [chosen, setChosen] = useState<Chosen>({});
  const [unreadable, setUnreadable] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The form is reset after each check; start again with it.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const clear = () => {
      setHeaders(null);
      setChosen({});
    };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    setChosen({});
    setUnreadable(false);
    if (!picked) return setHeaders(null);
    try {
      const found = readHeaders(await picked.slice(0, 64 * 1024).text());
      setHeaders(found.length ? found : null);
    } catch {
      setHeaders(null);
      setUnreadable(true);
    }
  }

  const matches = headers ? matchColumns(file, headers, chosen) : null;
  const columnOf = (key: string) => {
    const at = matches?.columns[key];
    return at === null || at === undefined ? "" : headers![at]!;
  };
  const pick = (key: string, header: string) => setChosen((c) => ({ ...c, [key]: header }));
  const found = matches ? FIELDS[file].filter((f) => columnOf(f.key) !== "") : [];
  const id = `file-${file}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {FILE_LABELS[file]} <span className="font-normal text-muted">(CSV)</span>
      </Label>
      <input
        ref={input}
        id={id}
        name={file}
        type="file"
        accept=".csv,text/csv"
        aria-describedby={`${id}-hint`}
        onChange={choose}
        className="rounded-sm border border-line bg-surface p-3 text-base file:mr-4 file:h-10 file:rounded-full file:border-0 file:bg-surface-soft file:px-4 file:font-semibold"
      />
      <p id={`${id}-hint`} className="text-sm text-muted">
        {HINTS[file]}
      </p>
      {unreadable ? (
        <p className="text-sm font-semibold text-[#9c3b29]">
          That file can&apos;t be read. Export it as CSV and choose it again.
        </p>
      ) : null}

      {matches ? (
        <div
          role="group"
          aria-label={`Columns read from the ${FILE_LABELS[file].toLowerCase()} file`}
          className="flex flex-col gap-3 rounded-md bg-surface-soft p-4"
        >
          {/* Every detail is sent, matched or not, so the server reads the
              file exactly as shown here. */}
          {FIELDS[file].map((f) => (
            <input
              key={f.key}
              type="hidden"
              name={`map.${file}.${f.key}`}
              value={columnOf(f.key)}
            />
          ))}
          {matches.missing.map((key) => (
            <ColumnSelect
              key={key}
              id={`${id}-need-${key}`}
              label={`Which column has the ${needLabel(file, key).toLowerCase()}?`}
              headers={headers!}
              value={columnOf(key)}
              onChange={(h) => pick(key, h)}
              urgent
            />
          ))}
          {found.length ? (
            <p className="text-sm">
              <span className="font-semibold">Reading: </span>
              {found.map((f) => `${f.label} ← “${columnOf(f.key)}”`).join(" · ")}
            </p>
          ) : null}
          <details>
            <summary className="cursor-pointer text-sm font-semibold underline">
              Change which column is read
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {FIELDS[file].map((f) => (
                <ColumnSelect
                  key={f.key}
                  id={`${id}-col-${f.key}`}
                  label={f.label}
                  headers={headers!}
                  value={columnOf(f.key)}
                  onChange={(h) => pick(f.key, h)}
                />
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function ColumnSelect({
  id,
  label,
  headers,
  value,
  onChange,
  urgent = false,
}: {
  id: string;
  label: string;
  headers: string[];
  value: string;
  onChange: (header: string) => void;
  urgent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={urgent ? "font-semibold text-[#9c3b29]" : "text-sm"}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-sm border border-line bg-surface px-3 text-base"
      >
        <option value="">{urgent ? "Choose a column…" : "Not in this file"}</option>
        {[...new Set(headers)]
          .filter((h) => h !== "")
          .map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
      </select>
    </div>
  );
}

const ORDER: ImportFile[] = [...FILES];

export function Problems({ problems, title }: { problems: ImportProblem[]; title: string }) {
  if (problems.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-semibold">
        {title} ({problems.length})
      </h3>
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {[...problems]
          .sort((a, b) =>
            a.file === b.file ? a.row - b.row : ORDER.indexOf(a.file) - ORDER.indexOf(b.file),
          )
          .map((p, i) => (
            <li key={i} className="rounded-md bg-surface-soft px-4 py-3">
              <span className="font-semibold">
                {FILE_LABELS[p.file] ?? p.file} file, row {p.row}:
              </span>{" "}
              {p.message}
            </li>
          ))}
      </ul>
    </section>
  );
}

// What the balances add up to, to check against the old system's totals.
export function MoneyCheck({ money, saved = false }: { money: Money; saved?: boolean }) {
  if (money.owingFamilies + money.creditFamilies === 0) return null;
  return (
    <section
      aria-label="Balances to check"
      className="flex flex-col gap-2 rounded-md border border-line p-4"
    >
      <h3 className="font-display text-lg font-semibold">Check the balances add up</h3>
      <ul className="tabular flex flex-col gap-1">
        {money.owingFamilies ? (
          <li>
            {count(money.owingFamilies, "family owes", "families owe")}{" "}
            <strong>{formatMoney(money.owingCents)}</strong> in all
          </li>
        ) : null}
        {money.creditFamilies ? (
          <li>
            {count(money.creditFamilies, "family is", "families are")} in credit by{" "}
            <strong>{formatMoney(money.creditCents)}</strong> in all
          </li>
        ) : null}
      </ul>
      <p className="text-sm text-muted">
        {saved
          ? "Compare these with your current system's totals."
          : "Compare these with your current system. If owing and in credit look the wrong way round, tick “My system shows money owed as a negative number” and check again."}
      </p>
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
        {FILES.map((f) => (
          <FileField key={f} file={f} />
        ))}
        <label className="flex items-start gap-3">
          <input type="checkbox" name="owing_negative" className="mt-1 size-5" />
          <span>
            My system shows money owed as a negative number
            <span className="block text-sm text-muted">
              Only for the balances file. Leave it unticked if a family who owes $120 shows as 120.
            </span>
          </span>
        </label>
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
          <MoneyCheck money={report.money} />
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
