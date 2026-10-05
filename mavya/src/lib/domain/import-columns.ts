// Which column of a school's file holds which detail (docs/M6_MIGRATION_PILOT.md,
// M6a and M6h). Pure, so the browser can show the matches as soon as a file
// is chosen, and the server reads the file with the same rules.

export type ImportFile = "classes" | "students" | "balances" | "credits";

export const FILES = [
  "classes",
  "students",
  "balances",
  "credits",
] as const satisfies readonly ImportFile[];

export const FILE_LABELS: Record<ImportFile, string> = {
  classes: "Classes",
  students: "Students",
  balances: "Balances",
  credits: "Make-up credits",
};

type Field = { key: string; label: string; aliases: string[] };

// Header names as other systems and spreadsheets write them, compared with
// only their letters ("Guardian 1 E-mail" → "guardianemail"). The first
// column that matches a detail is the one read.
const PARENT_EMAIL = [
  "email",
  "emailaddress",
  "parentemail",
  "parentemailaddress",
  "guardianemail",
  "contactemail",
  "primaryemail",
  "primaryemailaddress",
  "primaryguardianemail",
  "familyemail",
  "accountemail",
  "accountholderemail",
  "billingemail",
];
const PARENT_PHONE = [
  "phone",
  "mobile",
  "mobilephone",
  "mobilenumber",
  "cellphone",
  "cell",
  "phonenumber",
  "parentphone",
  "parentmobile",
  "guardianphone",
  "guardianmobile",
  "contactphone",
  "contactnumber",
  "primaryphone",
  "primaryphonenumber",
  "primarymobile",
  "primaryguardianphone",
  "familyphone",
  "accountphone",
  "homephone",
];
const FIRST_NAME = [
  "firstname",
  "childfirstname",
  "studentfirstname",
  "swimmerfirstname",
  "participantfirstname",
  "givenname",
  "preferredname",
];
const LAST_NAME = [
  "lastname",
  "surname",
  "familyname",
  "childlastname",
  "childsurname",
  "studentlastname",
  "studentsurname",
  "swimmerlastname",
  "participantlastname",
];
const FULL_NAME = [
  "name",
  "fullname",
  "student",
  "studentname",
  "studentfullname",
  "child",
  "childname",
  "childsname",
  "swimmer",
  "swimmername",
  "participant",
  "participantname",
];
const BIRTH = [
  "dateofbirth",
  "dob",
  "birthdate",
  "birthday",
  "studentbirthdate",
  "studentbirthday",
  "studentdob",
  "childdob",
  "childdateofbirth",
];

export const FIELDS: Record<ImportFile, Field[]> = {
  classes: [
    { key: "name", label: "Class name", aliases: ["class", "classname", "name", "classtitle"] },
    {
      key: "level",
      label: "Level",
      aliases: ["level", "levelname", "skilllevel", "classlevel", "stage"],
    },
    { key: "program", label: "Program", aliases: ["program", "programme", "programname"] },
    {
      key: "location",
      label: "Location",
      aliases: ["location", "venue", "pool", "site", "centre", "center", "facility", "room"],
    },
    { key: "weekday", label: "Day", aliases: ["day", "days", "weekday", "dayofweek", "classday"] },
    {
      key: "start_time",
      label: "Start time",
      aliases: ["start", "starttime", "time", "classtime", "begins"],
    },
    { key: "end_time", label: "End time", aliases: ["end", "endtime", "finish", "finishtime"] },
    {
      key: "duration_minutes",
      label: "Length (minutes)",
      aliases: [
        "duration",
        "durationminutes",
        "durationmins",
        "length",
        "lengthminutes",
        "classlength",
        "minutes",
        "mins",
      ],
    },
    {
      key: "capacity",
      label: "Places",
      aliases: [
        "capacity",
        "places",
        "maxstudents",
        "size",
        "max",
        "maxsize",
        "maximum",
        "classsize",
        "maxenrollment",
        "maxenrolment",
        "maxcapacity",
      ],
    },
    {
      key: "instructor_email",
      label: "Instructor email",
      aliases: [
        "instructor",
        "instructoremail",
        "instructors",
        "teacher",
        "teacheremail",
        "coach",
        "coachemail",
        "staffemail",
      ],
    },
  ],
  students: [
    { key: "first_name", label: "First name", aliases: FIRST_NAME },
    { key: "last_name", label: "Last name", aliases: LAST_NAME },
    { key: "full_name", label: "Full name", aliases: FULL_NAME },
    { key: "date_of_birth", label: "Date of birth", aliases: BIRTH },
    {
      key: "parent_name",
      label: "Parent name",
      aliases: [
        "parent",
        "parentname",
        "guardian",
        "guardianname",
        "contactname",
        "primaryguardian",
        "primaryguardianname",
        "primarycontact",
        "primarycontactname",
        "accountholder",
        "accountholdername",
        "accountname",
        "parentfullname",
      ],
    },
    { key: "parent_email", label: "Parent email", aliases: PARENT_EMAIL },
    { key: "parent_phone", label: "Parent phone", aliases: PARENT_PHONE },
    {
      key: "class",
      label: "Class",
      aliases: [
        "class",
        "classname",
        "enrolledclass",
        "currentclass",
        "classes",
        "enrolment",
        "enrollment",
      ],
    },
    {
      key: "class_weekday",
      label: "Class day",
      aliases: ["classday", "day", "weekday", "dayofweek"],
    },
    {
      key: "class_time",
      label: "Class time",
      aliases: ["classtime", "time", "starttime", "classstarttime"],
    },
  ],
  balances: [
    { key: "parent_email", label: "Parent email", aliases: PARENT_EMAIL },
    { key: "parent_phone", label: "Parent phone", aliases: PARENT_PHONE },
    {
      key: "balance",
      label: "Balance owing",
      aliases: [
        "balance",
        "accountbalance",
        "familybalance",
        "currentbalance",
        "balanceowing",
        "balancedue",
        "amountowing",
        "amountdue",
        "owing",
        "outstanding",
        "outstandingbalance",
        "totaldue",
        "due",
      ],
    },
    {
      key: "credit",
      label: "Credit held",
      aliases: ["credit", "accountcredit", "creditbalance", "familycredit", "incredit"],
    },
    { key: "due_on", label: "Due date", aliases: ["duedate", "dueon", "datedue", "paymentdue"] },
  ],
  credits: [
    { key: "first_name", label: "First name", aliases: FIRST_NAME },
    { key: "last_name", label: "Last name", aliases: LAST_NAME },
    { key: "full_name", label: "Full name", aliases: FULL_NAME },
    { key: "date_of_birth", label: "Date of birth", aliases: BIRTH },
    { key: "parent_email", label: "Parent email", aliases: PARENT_EMAIL },
    { key: "parent_phone", label: "Parent phone", aliases: PARENT_PHONE },
    {
      key: "credits",
      label: "Make-up credits",
      aliases: [
        "credits",
        "makeupcredits",
        "makeups",
        "makeupsavailable",
        "availablemakeups",
        "makeupsremaining",
        "creditsremaining",
        "creditsavailable",
        "makeuptokens",
        "tokens",
        "lessoncredits",
        "makeuplessons",
      ],
    },
    {
      key: "expires_on",
      label: "Credits expire",
      aliases: [
        "expires",
        "expiry",
        "expirydate",
        "expireson",
        "expirationdate",
        "creditsexpire",
        "creditexpiry",
        "makeupexpiry",
        "validuntil",
      ],
    },
  ],
};

// Each inner list is one thing the file needs: any one of its details.
export const NEEDS: Record<ImportFile, string[][]> = {
  classes: [
    ["name"],
    ["level"],
    ["location"],
    ["weekday"],
    ["start_time"],
    ["duration_minutes", "end_time"],
    ["capacity"],
  ],
  students: [["first_name", "full_name"], ["last_name", "full_name"], ["date_of_birth"]],
  balances: [
    ["parent_email", "parent_phone"],
    ["balance", "credit"],
  ],
  credits: [["first_name", "full_name"], ["credits"]],
};

export const headerKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function fieldLabel(file: ImportFile, key: string) {
  return FIELDS[file].find((f) => f.key === key)?.label ?? key;
}

// "First name or Full name": a need any of several columns can fill, by
// its first detail's key.
export function needLabel(file: ImportFile, key: string) {
  const need = NEEDS[file].find((n) => n[0] === key) ?? [key];
  return need.map((k) => fieldLabel(file, k)).join(" or ");
}

// A detail chosen by the owner: the header's exact text, or "" for "not in
// this file". Details without a choice are matched by name.
export type Chosen = Record<string, string>;

export type Matches = {
  // Detail → which column (0-based), or null when the file doesn't have it.
  columns: Record<string, number | null>;
  // Each need with nothing to read it from, as its first detail's key.
  missing: string[];
};

export function matchColumns(file: ImportFile, headers: string[], chosen: Chosen = {}): Matches {
  const columns: Record<string, number | null> = {};
  const keys = headers.map(headerKey);
  const taken = new Set<number>();
  // Columns the owner chose aren't also read as something else.
  for (const field of FIELDS[file]) {
    const pick = chosen[field.key];
    if (pick === undefined) continue;
    const at = pick === "" ? -1 : headers.indexOf(pick);
    columns[field.key] = at < 0 ? null : at;
    if (at >= 0) taken.add(at);
  }
  for (const field of FIELDS[file]) {
    if (field.key in columns) continue;
    // Aliases in order of preference, so "Student Name" beats a later "Name".
    let at = -1;
    for (const alias of field.aliases) {
      at = keys.findIndex((k, i) => k === alias && !taken.has(i));
      if (at >= 0) break;
    }
    columns[field.key] = at < 0 ? null : at;
    if (at >= 0) taken.add(at);
  }
  const missing = NEEDS[file]
    .filter((any) => !any.some((k) => columns[k] !== null && columns[k] !== undefined))
    .map((any) => any[0]!);
  return { columns, missing };
}

// ------------------------------------------------------------------ reading values

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

// The header row of a file, from its first part (enough for any header).
export function readHeaders(text: string): string[] {
  const firstLines = text.slice(0, 64 * 1024);
  const cut = firstLines.lastIndexOf("\n");
  const rows = parseCsv(cut > 0 ? firstLines.slice(0, cut) : firstLines);
  return (rows[0] ?? []).map((h) => h.trim());
}

// "Jane Smith" → Jane / Smith; "Smith, Jane" → Jane / Smith; "Jane" → Jane / "".
export function splitName(value: string): { first: string; last: string } {
  const v = value.trim().replace(/\s+/g, " ");
  const comma = v.indexOf(",");
  if (comma >= 0) return { first: v.slice(comma + 1).trim(), last: v.slice(0, comma).trim() };
  const space = v.indexOf(" ");
  if (space < 0) return { first: v, last: "" };
  return { first: v.slice(0, space), last: v.slice(space + 1) };
}

// Money as people write it, in cents: "$1,234.50", "-45", "(45.00)" and
// "45.00 CR" (both negative), "45.00 DR". Blank is 0; anything else, null.
export function readMoney(value: string): number | null {
  let v = value.trim().toUpperCase().replace(/\s+/g, "");
  if (v === "" || v === "-") return 0;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (v.endsWith("CR")) {
    negative = !negative;
    v = v.slice(0, -2);
  } else if (v.endsWith("DR")) v = v.slice(0, -2);
  if (v.endsWith("-")) {
    negative = !negative;
    v = v.slice(0, -1);
  }
  if (v.startsWith("-")) {
    negative = !negative;
    v = v.slice(1);
  }
  v = v
    .replace(/^(AUD|A\$|\$)/, "")
    .replace(/^\$/, "")
    .replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(v)) return null;
  const cents = Math.round(Number(v) * 100);
  return negative && cents !== 0 ? -cents : cents;
}
