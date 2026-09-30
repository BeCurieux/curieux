import type { Json } from "@/lib/supabase/database.types";
import { DomainError, explain, must, type Db } from "./db";

// Moving a school in (docs/M6_MIGRATION_PILOT.md, M6a). This file only reads
// the school's CSV files into tidy rows. Matching, checks and saving all
// happen in the database's import_school, so the rules live in one place.

export type ImportFile = "classes" | "students";
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

export const MAX_ROWS = 5000;

// ------------------------------------------------------------------ CSV

// RFC 4180: commas, quoted fields with "" for a quote, CRLF or LF. A byte
// order mark (Excel adds one) is dropped. Blank lines are skipped.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Headers people actually use, all mapped to one name.
const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const CLASS_COLUMNS: Record<string, keyof ClassRow | "end_time"> = {
  class: "name",
  classname: "name",
  name: "name",
  level: "level",
  levelname: "level",
  program: "program",
  programme: "program",
  location: "location",
  venue: "location",
  pool: "location",
  site: "location",
  day: "weekday",
  weekday: "weekday",
  dayofweek: "weekday",
  start: "start_time",
  starttime: "start_time",
  time: "start_time",
  end: "end_time",
  endtime: "end_time",
  duration: "duration_minutes",
  durationminutes: "duration_minutes",
  length: "duration_minutes",
  minutes: "duration_minutes",
  capacity: "capacity",
  places: "capacity",
  maxstudents: "capacity",
  size: "capacity",
  instructor: "instructor_email",
  instructoremail: "instructor_email",
  teacher: "instructor_email",
  teacheremail: "instructor_email",
};

const STUDENT_COLUMNS: Record<string, keyof StudentRow> = {
  firstname: "first_name",
  childfirstname: "first_name",
  studentfirstname: "first_name",
  givenname: "first_name",
  lastname: "last_name",
  surname: "last_name",
  familyname: "last_name",
  childlastname: "last_name",
  studentlastname: "last_name",
  dateofbirth: "date_of_birth",
  dob: "date_of_birth",
  birthdate: "date_of_birth",
  birthday: "date_of_birth",
  parent: "parent_name",
  parentname: "parent_name",
  guardian: "parent_name",
  guardianname: "parent_name",
  contactname: "parent_name",
  email: "parent_email",
  parentemail: "parent_email",
  guardianemail: "parent_email",
  contactemail: "parent_email",
  phone: "parent_phone",
  mobile: "parent_phone",
  parentphone: "parent_phone",
  parentmobile: "parent_phone",
  contactphone: "parent_phone",
  class: "class",
  classname: "class",
  classday: "class_weekday",
  classtime: "class_time",
};

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

function table(
  csv: string,
  file: ImportFile,
  columns: Record<string, string>,
): {
  records: { row: number; get: (k: string) => string | undefined }[];
  problems: ImportProblem[];
} {
  const all = parseCsv(csv);
  if (all.length === 0)
    return { records: [], problems: [{ file, row: 1, message: "This file is empty." }] };
  if (all.length - 1 > MAX_ROWS)
    throw new DomainError(`That file has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  const header = all[0]!.map((h) => columns[key(h)]);
  const records = all.slice(1).map((cells, i) => ({
    // Row numbers as the school sees them in a spreadsheet: the header is row 1.
    row: i + 2,
    get: (k: string) => {
      const at = header.indexOf(k);
      return at < 0 ? undefined : cells[at];
    },
  }));
  return { records, problems: [] };
}

function missingColumns(csv: string, columns: Record<string, string>, needed: string[][]) {
  const header = (parseCsv(csv)[0] ?? []).map((h) => columns[key(h)]);
  return needed.filter((any) => !any.some((k) => header.includes(k))).map((any) => any[0]!);
}

const CLASS_NEEDS = [
  ["name"],
  ["level"],
  ["location"],
  ["weekday"],
  ["start_time"],
  ["duration_minutes", "end_time"],
  ["capacity"],
];
const STUDENT_NEEDS = [["first_name"], ["last_name"], ["date_of_birth"]];

const LABELS: Record<string, string> = {
  name: "Class",
  level: "Level",
  location: "Location",
  weekday: "Day",
  start_time: "Start time",
  duration_minutes: "Duration (or End time)",
  capacity: "Capacity",
  first_name: "First name",
  last_name: "Last name",
  date_of_birth: "Date of birth",
};

export function readClasses(csv: string): Read<ClassRow> {
  const missing = missingColumns(csv, CLASS_COLUMNS, CLASS_NEEDS);
  if (missing.length)
    return {
      rows: [],
      problems: [
        {
          file: "classes",
          row: 1,
          message: `The classes file needs these columns: ${missing.map((m) => LABELS[m]).join(", ")}.`,
        },
      ],
    };
  const { records, problems } = table(csv, "classes", CLASS_COLUMNS);
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

export function readStudents(csv: string): Read<StudentRow> {
  const missing = missingColumns(csv, STUDENT_COLUMNS, STUDENT_NEEDS);
  if (missing.length)
    return {
      rows: [],
      problems: [
        {
          file: "students",
          row: 1,
          message: `The students file needs these columns: ${missing.map((m) => LABELS[m]).join(", ")}.`,
        },
      ],
    };
  const { records, problems } = table(csv, "students", STUDENT_COLUMNS);
  const rows: StudentRow[] = [];
  for (const r of records) {
    const say = (message: string) => problems.push({ file: "students", row: r.row, message });
    const dob = readDate(r.get("date_of_birth") ?? "");
    const classDay = text(r.get("class_weekday"));
    const classTime = text(r.get("class_time"));
    const weekday = classDay ? readWeekday(classDay) : null;
    const time = classTime ? readTime(classTime) : null;
    const email = text(r.get("parent_email"))?.toLowerCase() ?? null;
    if (!text(r.get("first_name"))) say("This child has no first name.");
    else if (dob === null)
      say(`"${r.get("date_of_birth") ?? ""}" isn't a date of birth, like 31/12/2019.`);
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      say(`"${email}" isn't an email address.`);
    else if (classDay && weekday === null) say(`"${classDay}" isn't a day of the week.`);
    else if (classTime && time === null) say(`"${classTime}" isn't a time, like 4:30pm.`);
    else
      rows.push({
        row: r.row,
        first_name: text(r.get("first_name"))!,
        last_name: text(r.get("last_name")) ?? "",
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

// ------------------------------------------------------------------ the database

export type Counts = { classes: number; families: number; children: number; enrolments: number };

export type ImportReport = {
  batchId: string | null;
  added: Counts;
  existing: Counts;
  problems: ImportProblem[];
  notes: ImportProblem[];
};

export type ImportRows = {
  classes: ClassRow[];
  students: StudentRow[];
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
    }),
  ) as {
    batch_id: string | null;
    added: Counts;
    existing: Counts;
    problems: ImportProblem[];
    notes: ImportProblem[];
  };
  return {
    batchId: out.batch_id,
    added: out.added,
    existing: out.existing,
    problems: out.problems,
    notes: out.notes,
  };
}

export type ImportBatch = {
  id: string;
  createdAt: string;
  fileNames: string[];
  rows: { classes: number; students: number };
  added: Counts;
  existing: Counts;
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
    rows: { classes: number; students: number };
    added: Counts;
    existing: Counts;
  };
  return {
    id: r.id,
    createdAt: r.created_at,
    fileNames: r.file_names,
    rows: counts.rows,
    added: counts.added,
    existing: counts.existing,
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
  return { inOvyko: out.in_ovyko, canUndo: out.can_undo };
}

export async function undoImport(db: Db, id: string) {
  const { error } = await db.rpc("undo_import", { p_batch: id });
  if (error) throw explain(error);
}
