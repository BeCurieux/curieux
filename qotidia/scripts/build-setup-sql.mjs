// Build supabase/setup.sql from the migrations.
//
// SETUP.md tells a person to open one file, copy all of it, and paste it
// into the Supabase SQL editor. That file was maintained by hand and had
// silently fallen four migrations behind — so following the instructions
// exactly would have produced a database the application cannot run
// against, and the first sign of it would have been a 500 on the first page
// after signing up.
//
// So it is generated now, and verify-schema.sh applies the generated file to
// its own database and checks it produces the same schema the migrations do.
// A stale setup.sql fails the check rather than reaching somebody's evening.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const header = `-- Qotidia — the whole schema, in one file.
--
-- GENERATED. Do not edit: run \`npm run build:setup\` instead, or edit the
-- migration it came from. This is the concatenation of
-- supabase/migrations/*.sql in order, provided so that setting up a new
-- project is one paste rather than ${files.length}.
--
-- Safe to run once on an empty project. It is not idempotent in the way a
-- migration runner is — if you have already run some of it, run the
-- individual migrations you are missing instead.
--
-- Built from ${files.length} migrations: ${files[0]} … ${files[files.length - 1]}
`;

const body = files
  .map((f) => {
    const sql = readFileSync(join(dir, f), "utf8").trimEnd();
    return `\n\n-- ${"=".repeat(70)}\n-- ${f}\n-- ${"=".repeat(70)}\n\n${sql}\n`;
  })
  .join("");

const out = `${header}${body}`;
writeFileSync(join(root, "supabase", "setup.sql"), out);

// The whole file, not just the part this script assembled. It reported the
// body only, so the number here and the number GitHub shows disagreed by the
// length of the header — and that number was being used to tell somebody
// whether they were looking at a stale copy.
// Counted the way wc and GitHub count: newlines, not fragments. Splitting
// on "\n" yields one extra for the empty string after the final newline,
// which put this one line above what a person reading the file is shown.
const lines = out.split("\n").length - (out.endsWith("\n") ? 1 : 0);
console.log(`supabase/setup.sql — ${files.length} migrations, ${lines} lines`);
