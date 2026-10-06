import type { Json } from "@/lib/supabase/database.types";
import { DomainError, explain, must, type Db } from "./db";
import {
  FILE_LABELS,
  matchColumns,
  needLabel,
  parseCsv,
  readMoney,
  splitName,
  type Chosen,
  type ImportFile,
} from "./import-columns";

// Moving a school in (docs/M6_MIGRATION_PILOT.md, M6a). This file only reads
// the school's CSV files into tidy rows. Matching, checks and saving all
// happen in the database's import_school, so the rules live in one place.

export type { ImportFile } from "./import-columns";
export { parseCsv } from "./import-columns";
// A problem row didn't come across; a note (note: true) did, with a caveat.
export type ImportProblem = { file: ImportFile; row: number; message: string; note?: boolean };

export type ClassRow = {
  row: number;
  name: string;
  level: string;
  program: string | null;
  location: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  instructor_email: string | null;
};

export type StudentRow = {
  row: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  class: string | null;
  class_weekday: number | null;
  class_time: string | null;
};

// Positive when the family owes, negative when it's in credit.
export type BalanceRow = {
  row: number;
  parent_email: string | null;
  parent_phone: string | null;
  balance_cents: number;
  due_on: string | null;
};

export type CreditRow = {
  row: number;
  parent_email: string | null;
  parent_phone: string | null;
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null;
  credits: number;
  expires_on: string | null;
};

export const MAX_ROWS = 5000;

// ------------------------------------------------------------------ values

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function readWeekday(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (/^[1-7]$/.test(v)) return Number(v);
  const i = DAYS.findIndex((d) => v.startsWith(d));
  return i < 0 ? null : i + 1;
}

// "16:30", "4:30pm", "4.30 PM", "4pm", "0930" → "HH:MM".
export function readTime(value: string): string | null {
  const m = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.]?(\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] ?? "0");
  if (m[3] === "pm" && hours < 12) hours += 12;
  if (m[3] === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59 || (m[3] && Number(m[1]) > 12)) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Australian order: "31/12/2019", "31-12-19", or ISO "2019-12-31".
export function readDate(value: string): string | null {
  const v = value.trim();
  let y: number, mo: number, d: number;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    return null;
  return date.toISOString().slice(0, 10);
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number) as [number, number];
  const [eh, em] = end.split(":").map(Number) as [number, number];
  return eh * 60 + em - (sh * 60 + sm);
}

const text = (v: string | undefined) => (v?.trim() ? v.trim() : null);

// ------------------------------------------------------------------ files

type Read<T> = { rows: T[]; problems: ImportProblem[] };
type Record_ = { row: number; get: (k: string) => string | undefined };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The file's rows, each read by detail. Null, with the problem, when a
// detail the file needs has no column.
function table(
  csv: string,
  file: ImportFile,
  chosen?: Chosen,
): { records: Record_[]; problems: ImportProblem[] } {
  const all = parseCsv(csv);
  if (all.length === 0)
    return { records: [], problems: [{ file, row: 1, message: "This file is empty." }] };
  if (all.length - 1 > MAX_ROWS)
    throw new DomainError(`That file has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  const { columns, missing } = matchColumns(
    file,
    all[0]!.map((h) => h.trim()),
    chosen,
  );
  if (missing.length)
    return {
      records: [],
      problems: [
        {
          file,
          row: 1,
          message: `The ${FILE_LABELS[file].toLowerCase()} file needs a column for: ${missing
            .map((k) => needLabel(file, k))
            .join(", ")}.`,
        },
      ],
    };
  const records = all.slice(1).map((cells, i) => ({
    // Row numbers as the school sees them in a spreadsheet: the header is row 1.
    row: i + 2,
    get: (k: string) => {
      const at = columns[k];
      return at === null || at === undefined ? undefined : cells[at];
    },
  }));
  return { records, problems: [] };
}

// A child's name from first and last name columns, or one name column.
function childName(r: Record_) {
  const full = text(r.get("full_name"));
  const split = full ? splitName(full) : { first: "", last: "" };
  return {
    first: text(r.get("first_name")) ?? (split.first || null),
    last: text(r.get("last_name")) ?? (split.last || null),
  };
}

export function readClasses(csv: string, chosen?: Chosen): Read<ClassRow> {
  const { records, problems } = table(csv, "classes", chosen);
  const rows: ClassRow[] = [];
  for (const r of records) {
    const say = (message: string) => problems.push({ file: "classes", row: r.row, message });
    const weekday = readWeekday(r.get("weekday") ?? "");
    const start = readTime(r.get("start_time") ?? "");
    const end = r.get("end_time") ? readTime(r.get("end_time")!) : null;
    const duration = r.get("duration_minutes")?.trim()
      ? Number(r.get("duration_minutes")!.replace(/[^\d.]/g, ""))
      : start && end
        ? minutesBetween(start, end)
        : NaN;
    const capacity = Number(r.get("capacity")?.trim());
    if (!text(r.get("name"))) say("This class has no name.");
    else if (weekday === null) say(`"${r.get("weekday") ?? ""}" isn't a day of the week.`);
    else if (start === null) say(`"${r.get("start_time") ?? ""}" isn't a time, like 4:30pm.`);
    else if (!Number.isInteger(duration) || duration < 5 || duration > 480)
      say("The class length should be between 5 and 480 minutes.");
    else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200)
      say("Capacity should be a whole number from 1 to 200.");
    else if (!text(r.get("level"))) say("This class has no level.");
    else if (!text(r.get("location"))) say("This class has no location.");
    else
      rows.push({
        row: r.row,
        name: text(r.get("name"))!,
        level: text(r.get("level"))!,
        program: text(r.get("program")),
        location: text(r.get("location"))!,
        weekday,
        start_time: start,
        duration_minutes: duration,
        capacity,
        instructor_email: text(r.get("instructor_email"))?.toLowerCase() ?? null,
      });
  }
  return { rows, problems };
}

export function readStudents(csv: string, chosen?: Chosen): Read<StudentRow> {
  const { records, problems } = table(csv, "students", chosen);
  const rows: StudentRow[] = [];
  for (const r of records) {
    const say = (message: string) => problems.push({ file: "students", row: r.row, message });
    const name = childName(r);
    const dob = readDate(r.get("date_of_birth") ?? "");
    const classDay = text(r.get("class_weekday"));
    const classTime = text(r.get("class_time"));
    const weekday = classDay ? readWeekday(classDay) : null;
    const time = classTime ? readTime(classTime) : null;
    const email = text(r.get("parent_email"))?.toLowerCase() ?? null;
    if (!name.first) say("This child has no first name.");
    else if (dob === null)
      say(`"${r.get("date_of_birth") ?? ""}" isn't a date of birth, like 31/12/2019.`);
    else if (email && !EMAIL.test(email)) say(`"${email}" isn't an email address.`);
    else if (classDay && weekday === null) say(`"${classDay}" isn't a day of the week.`);
    else if (classTime && time === null) say(`"${classTime}" isn't a time, like 4:30pm.`);
    else
      rows.push({
        row: r.row,
        first_name: name.first,
        last_name: name.last ?? "",
        date_of_birth: dob,
        parent_name: text(r.get("parent_name")),
        parent_email: email,
        parent_phone: text(r.get("parent_phone")),
        class: text(r.get("class")),
        class_weekday: weekday,
        class_time: time,
      });
  }
  return { rows, problems };
}

// One row per family. owingNegative: the school's system writes money owed
// as a negative number, so the balance column is read the other way round.
export function readBalances(
  csv: string,
  chosen?: Chosen,
  owingNegative = false,
): Read<BalanceRow> {
  const { records, problems } = table(csv, "balances", chosen);
  const rows: BalanceRow[] = [];
  for (const r of records) {
    const say = (message: string) => problems.push({ file: "balances", row: r.row, message });
    const email = text(r.get("parent_email"))?.toLowerCase() ?? null;
    const balance = readMoney(r.get("balance") ?? "");
    const credit = readMoney(r.get("credit") ?? "");
    const dueText = text(r.get("due_on"));
    const due = dueText ? readDate(dueText) : null;
    if (balance === null) say(`"${r.get("balance")}" isn't an amount of money, like 120.50.`);
    else if (credit === null) say(`"${r.get("credit")}" isn't an amount of money, like 120.50.`);
    else if (email && !EMAIL.test(email)) say(`"${email}" isn't an email address.`);
    else if (dueText && due === null) say(`"${dueText}" isn't a date, like 31/12/2026.`);
    else {
      const cents = (owingNegative ? -balance : balance) - Math.abs(credit);
      if (cents === 0) continue;
      rows.push({
        row: r.row,
        parent_email: email,
        parent_phone: text(r.get("parent_phone")),
        balance_cents: cents,
        due_on: due,
      });
    }
  }
  return { rows, problems };
}

// One row per child.
export function readCredits(csv: string, chosen?: Chosen): Read<CreditRow> {
  const { records, problems } = table(csv, "credits", chosen);
  const rows: CreditRow[] = [];
  for (const r of records) {
    const say = (message: string) => problems.push({ file: "credits", row: r.row, message });
    const name = childName(r);
    const email = text(r.get("parent_email"))?.toLowerCase() ?? null;
    const creditsText = text(r.get("credits")) ?? "0";
    const credits = Number(creditsText);
    const dobText = text(r.get("date_of_birth"));
    const dob = dobText ? readDate(dobText) : null;
    const expiresText = text(r.get("expires_on"));
    const expires = expiresText ? readDate(expiresText) : null;
    if (!name.first) say("This row has no child's first name.");
    else if (!Number.isInteger(credits) || credits < 0 || credits > 50)
      say(`"${creditsText}" isn't a number of credits from 0 to 50.`);
    else if (email && !EMAIL.test(email)) say(`"${email}" isn't an email address.`);
    else if (dobText && dob === null) say(`"${dobText}" isn't a date of birth, like 31/12/2019.`);
    else if (expiresText && expires === null)
      say(`"${expiresText}" isn't a date, like 31/12/2026.`);
    else if (credits > 0)
      rows.push({
        row: r.row,
        parent_email: email,
        parent_phone: text(r.get("parent_phone")),
        first_name: name.first,
        last_name: name.last,
        date_of_birth: dob,
        credits,
        expires_on: expires,
      });
  }
  return { rows, problems };
}

// ------------------------------------------------------------------ the database

export type Counts = {
  classes: number;
  families: number;
  children: number;
  enrolments: number;
  // Families given a balance, and make-up credits (M6h).
  balances: number;
  credits: number;
};

// The balances brought across, to check against the old system's totals.
export type Money = {
  owingFamilies: number;
  owingCents: number;
  creditFamilies: number;
  creditCents: number;
};

type MoneyJson = {
  owing_families: number;
  owing_cents: number;
  credit_families: number;
  credit_cents: number;
};

const toMoney = (m: MoneyJson | undefined): Money => ({
  owingFamilies: m?.owing_families ?? 0,
  owingCents: Number(m?.owing_cents ?? 0),
  creditFamilies: m?.credit_families ?? 0,
  creditCents: Number(m?.credit_cents ?? 0),
});

// Imports from before M6h have no balances or credits.
const toCounts = (c: Partial<Counts> | undefined): Counts => ({
  classes: c?.classes ?? 0,
  families: c?.families ?? 0,
  children: c?.children ?? 0,
  enrolments: c?.enrolments ?? 0,
  balances: c?.balances ?? 0,
  credits: c?.credits ?? 0,
});

export type ImportReport = {
  batchId: string | null;
  added: Counts;
  existing: Counts;
  problems: ImportProblem[];
  notes: ImportProblem[];
  money: Money;
};

export type ImportRows = {
  classes: ClassRow[];
  students: StudentRow[];
  balances: BalanceRow[];
  credits: CreditRow[];
  fileNames: string[];
  // Rows the app couldn't read, listed with the database's own problems.
  readProblems: ImportProblem[];
};

// Checks the rows (commit = false) or saves them (commit = true).
export async function importSchool(
  db: Db,
  organisationId: string,
  input: ImportRows,
  commit: boolean,
): Promise<ImportReport> {
  const out = must(
    await db.rpc("import_school", {
      p_org: organisationId,
      p_classes: input.classes as unknown as Json,
      p_students: input.students as unknown as Json,
      p_file_names: input.fileNames,
      p_commit: commit,
      p_read_problems: input.readProblems as unknown as Json,
      p_balances: input.balances as unknown as Json,
      p_credits: input.credits as unknown as Json,
    }),
  ) as {
    batch_id: string | null;
    added: Counts;
    existing: Counts;
    problems: ImportProblem[];
    notes: ImportProblem[];
    money: MoneyJson;
  };
  return {
    batchId: out.batch_id,
    added: toCounts(out.added),
    existing: toCounts(out.existing),
    problems: out.problems,
    notes: out.notes,
    money: toMoney(out.money),
  };
}

export type ImportBatch = {
  id: string;
  createdAt: string;
  fileNames: string[];
  rows: Record<ImportFile, number>;
  added: Counts;
  existing: Counts;
  money: Money;
  problems: ImportProblem[];
  undoneAt: string | null;
};

type BatchRow = {
  id: string;
  created_at: string;
  file_names: string[];
  counts: Json;
  problems: Json;
  undone_at: string | null;
};

function toBatch(r: BatchRow): ImportBatch {
  const counts = r.counts as {
    rows: Partial<Record<ImportFile, number>>;
    added: Partial<Counts>;
    existing: Partial<Counts>;
    money?: MoneyJson;
  };
  return {
    id: r.id,
    createdAt: r.created_at,
    fileNames: r.file_names,
    rows: {
      classes: counts.rows?.classes ?? 0,
      students: counts.rows?.students ?? 0,
      balances: counts.rows?.balances ?? 0,
      credits: counts.rows?.credits ?? 0,
    },
    added: toCounts(counts.added),
    existing: toCounts(counts.existing),
    money: toMoney(counts.money),
    problems: r.problems as ImportProblem[],
    undoneAt: r.undone_at,
  };
}

export async function listImports(db: Db): Promise<ImportBatch[]> {
  return must(
    await db
      .from("import_batches")
      .select("id, created_at, file_names, counts, problems, undone_at")
      .order("created_at", { ascending: false }),
  ).map(toBatch);
}

export async function getImport(db: Db, id: string): Promise<ImportBatch | null> {
  const { data, error } = await db
    .from("import_batches")
    .select("id, created_at, file_names, counts, problems, undone_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toBatch(data) : null;
}

// What Ovyko holds from an import today, and whether it can still be undone.
export async function importSummary(
  db: Db,
  id: string,
): Promise<{ inOvyko: Counts; canUndo: boolean }> {
  const out = must(await db.rpc("import_summary", { p_batch: id })) as {
    in_ovyko: Counts;
    can_undo: boolean;
  };
  return { inOvyko: toCounts(out.in_ovyko), canUndo: out.can_undo };
}

export async function undoImport(db: Db, id: string) {
  const { error } = await db.rpc("undo_import", { p_batch: id });
  if (error) throw explain(error);
}
