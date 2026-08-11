// Read .env.local, the same way, once.
//
// Three scripts wanted settings and did three different things: the check
// script parsed the file itself, the seed expected the variables to already
// be exported into the shell, and the job runner read some and not others.
// So the seed failed with
//
//     Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//
// on a machine where both were set correctly, in a file the app itself reads
// without difficulty. Next loads .env.local natively; anything run with plain
// `node` does not, and that difference is invisible from the outside.
//
// Two things it has to get right, both learned the hard way:
//
//   Line endings. Git for Windows converts them on checkout, so every line
//   arrives with a carriage return, and a regex ending in `(.*)$` matches
//   none of them — JS `.` does not match \r. That reported every setting as
//   missing to somebody who had set them all.
//
//   Key names. Supabase renamed `anon` to publishable and `service_role` to
//   secret. Whichever the dashboard showed you is the one you will have
//   pasted, so both are accepted.

import { readFileSync } from "node:fs";

/** Load .env.local into process.env, without overriding a real environment. */
export function loadEnv(from = new URL("../.env.local", import.meta.url)) {
  let raw;
  try {
    raw = readFileSync(from, "utf8");
  } catch {
    return; // A missing file is a legitimate state; callers report it plainly.
  }

  for (const line of raw.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    // Values are sometimes pasted with quotes around them, and a key wrapped
    // in quotes fails against the API with an error mentioning neither.
    process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

export const projectUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;

export const publishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  undefined;

export const secretKey = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;

/**
 * Stop with a message that names the setting and where to find it.
 *
 * The old message named a variable under a name the dashboard no longer
 * uses, and said nothing about which file it belonged in.
 */
export function requireSupabase({ needSecret = false } = {}) {
  loadEnv();
  const missing = [];
  if (!projectUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL — Project Settings → API → Project URL");
  if (needSecret && !secretKey()) {
    missing.push("SUPABASE_SECRET_KEY — Project Settings → API Keys → secret (sb_secret_…)");
  }
  if (!needSecret && !publishableKey()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — Project Settings → API Keys → publishable");
  }

  if (missing.length > 0) {
    console.error(`\nMissing from .env.local:\n  ${missing.join("\n  ")}\n`);
    process.exit(1);
  }

  return { url: projectUrl(), key: needSecret ? secretKey() : publishableKey() };
}
