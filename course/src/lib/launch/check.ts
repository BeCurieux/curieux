import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { splitFrontmatter } from "../content/load";

// The launch check (SPEC.md → Build order, step 9): what must be true before
// real customers arrive. `npm run launch:check` runs it against the content
// in the repository and the environment it is given (production's values).
// Pure functions here so the rules are unit tested; scripts/launch-check.ts
// prints the report.

export interface Finding {
  area: "content" | "env" | "gst" | "database";
  /** What's wrong, in a sentence the founder can act on. */
  message: string;
  /** "fail" blocks launch; "warn" is worth a look. */
  level: "fail" | "warn";
}

function files(dir: string, ext: RegExp): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full, ext) : ext.test(name) ? [full] : [];
    });
  } catch {
    return [];
  }
}

const isReadme = (file: string) => /readme\.md$/i.test(file);

/** A markdown file is still a draft if its frontmatter says so. */
export function isDraft(source: string): boolean {
  try {
    const { data } = splitFrontmatter(source);
    return (data as { draft?: unknown } | null)?.draft === true;
  } catch {
    return false;
  }
}

/** Lesson and module files have no draft flag; the placeholders say "placeholder". */
export function isPlaceholder(source: string): boolean {
  return /\bplaceholder\b/i.test(source);
}

/**
 * Copy that isn't final: page and email copy marked `draft: true`, the
 * Hype Check rubric while it's the starter list, and placeholder lessons.
 */
export function checkContent(root: string): Finding[] {
  const out: Finding[] = [];
  const rel = (file: string) => path.relative(root, file);
  for (const dir of ["content/pages", "content/emails"])
    for (const file of files(path.join(root, dir), /\.md$/))
      if (!isReadme(file) && isDraft(readFileSync(file, "utf8")))
        out.push({
          area: "content",
          level: "fail",
          message: `${rel(file)} is still draft copy (draft: true).`,
        });
  const rubric = path.join(root, "content/hype/rubric.json");
  try {
    const parsed = JSON.parse(readFileSync(rubric, "utf8")) as { draft?: unknown };
    if (parsed.draft === true)
      out.push({
        area: "content",
        level: "fail",
        message: `${rel(rubric)} is still the starter word list (draft: true).`,
      });
  } catch {
    out.push({ area: "content", level: "fail", message: `${rel(rubric)} is missing or broken.` });
  }
  for (const file of files(path.join(root, "content/modules"), /\.md$/))
    if (!isReadme(file) && isPlaceholder(readFileSync(file, "utf8")))
      out.push({
        area: "content",
        level: "fail",
        message: `${rel(file)} is still a placeholder.`,
      });
  return out;
}

/** GST, or a tax line, anywhere in what customers read or what Stripe is asked to do. */
export const GST = /\bGST\b/;
export const STRIPE_TAX = /\b(?:automatic_tax|tax_rates|tax_id_collection|tax_behavior)\b/;

export function checkGst(root: string): Finding[] {
  const rel = (file: string) => path.relative(root, file);
  // The Hype Check rubric and scorer only spot phrases; the tests and this
  // checker name GST to forbid it.
  const sources = [
    ...files(path.join(root, "content"), /\.(?:md|json)$/),
    ...files(path.join(root, "emails"), /\.tsx?$/),
    ...files(path.join(root, "src"), /\.tsx?$/).filter(
      (f) => !f.includes(`${path.sep}launch${path.sep}`),
    ),
  ];
  const out: Finding[] = [];
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    if (GST.test(text))
      out.push({ area: "gst", level: "fail", message: `${rel(file)} mentions GST.` });
    if (STRIPE_TAX.test(text))
      out.push({
        area: "gst",
        level: "fail",
        message: `${rel(file)} sets a Stripe tax option; nothing should add tax.`,
      });
  }
  return out;
}

type Env = Record<string, string | undefined>;

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPPORT_EMAIL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_TOKEN_SECRET",
  "CRON_SECRET",
] as const;

/** Production's environment: everything set, live Stripe keys, no test stand-ins. */
export function checkEnv(env: Env): Finding[] {
  const out: Finding[] = [];
  const fail = (message: string) => out.push({ area: "env", level: "fail", message });
  const warn = (message: string) => out.push({ area: "env", level: "warn", message });
  for (const name of REQUIRED) if (!env[name]?.trim()) fail(`${name} isn't set.`);

  const https = (name: string) => {
    const value = env[name];
    if (!value) return;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || /^(localhost|127\.|0\.0\.0\.0)/.test(url.hostname))
        fail(`${name} must be the public https address, not ${value}.`);
    } catch {
      fail(`${name} isn't a web address.`);
    }
  };
  https("APP_URL");
  https("NEXT_PUBLIC_SUPABASE_URL");

  const stripe = env.STRIPE_SECRET_KEY;
  if (stripe && !/^(?:sk|rk)_live_/.test(stripe))
    fail("STRIPE_SECRET_KEY is a test key; use the live secret key (sk_live_…).");
  const hook = env.STRIPE_WEBHOOK_SECRET;
  if (hook && (!hook.startsWith("whsec_") || hook === "whsec_e2e_test"))
    fail("STRIPE_WEBHOOK_SECRET must be the live endpoint's signing secret (whsec_…).");
  if (env.RESEND_API_KEY && !env.RESEND_API_KEY.startsWith("re_"))
    fail("RESEND_API_KEY doesn't look like a Resend key (re_…).");
  if (env.RESEND_API_KEY === "re_fake") fail("RESEND_API_KEY is the test suite's stand-in.");

  for (const name of ["STRIPE_API_BASE", "RESEND_API_BASE"])
    if (env[name])
      fail(`${name} is set: it points at the test suite's stand-in server. Remove it.`);

  if (env.EMAIL_FROM && /example\.(?:com|test|org)/i.test(env.EMAIL_FROM))
    fail(`EMAIL_FROM is still an example address (${env.EMAIL_FROM}).`);
  if (env.SUPPORT_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL))
    fail("SUPPORT_EMAIL isn't an email address.");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 24)
    fail("CRON_SECRET is too short; use a random string of 24 characters or more.");
  if (env.EMAIL_TOKEN_SECRET && env.EMAIL_TOKEN_SECRET.length < 32)
    fail("EMAIL_TOKEN_SECRET is too short; use a random string of 32 characters or more.");
  if (env.EMAIL_TOKEN_SECRET && env.EMAIL_TOKEN_SECRET === env.SUPABASE_SECRET_KEY)
    warn("EMAIL_TOKEN_SECRET is the same as SUPABASE_SECRET_KEY; give it its own value.");
  if (!env.BUNNY_STREAM_LIBRARY_ID)
    warn("BUNNY_STREAM_LIBRARY_ID isn't set: only YouTube lesson videos will play.");
  return out;
}

export interface DatabaseState {
  products: {
    tier: string;
    stripe_price_id_aud: string | null;
    stripe_price_id_usd: string | null;
  }[];
  admins: number;
  lessons: number;
}

/** Production's database: Stripe prices written back, an admin, lessons seeded. */
export function checkDatabase(db: DatabaseState): Finding[] {
  const out: Finding[] = [];
  for (const p of db.products)
    if (p.tier !== "free" && (!p.stripe_price_id_aud || !p.stripe_price_id_usd))
      out.push({
        area: "database",
        level: "fail",
        message: `The ${p.tier} product has no Stripe price ids: run \`npm run stripe:setup\` with the live key.`,
      });
  if (db.admins === 0)
    out.push({
      area: "database",
      level: "fail",
      message: "Nobody is an admin: sign in once, then `npm run admin:add -- you@…`.",
    });
  if (db.lessons === 0)
    out.push({
      area: "database",
      level: "fail",
      message: "No lessons in the database: run `npm run content:seed`.",
    });
  return out;
}
