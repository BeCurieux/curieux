#!/usr/bin/env tsx
/**
 * pnpm deploy:check
 *
 * Is the environment this is about to serve from actually configured to serve?
 *
 * The failure this exists for is quiet in the worst way. `storeNameFromEnv()`
 * picks the Supabase adapter when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
 * are both set, and the filesystem adapter otherwise. That fallback is right
 * on a laptop and catastrophic on Vercel: a deployment missing either variable
 * boots cleanly, serves the workbench, and answers every published shop URL
 * with a 404 — no error, no log line, nothing to search for. The first signal
 * is a merchant saying their link is broken.
 *
 * So this refuses rather than warns on anything that would produce that state,
 * and is meant to run against the deployment's own environment — `vercel env
 * pull` locally, or as a build step where the real variables exist.
 *
 * It does not connect to anything. `pnpm rls:check` is the one that proves the
 * database answers; this proves the app would ask it.
 */

import { hasAnthropicKey } from "../src/lib/anthropic-key";

const ok = (message: string) => process.stdout.write(`  ✓ ${message}\n`);
const bad = (message: string) => process.stderr.write(`  × ${message}\n`);
const note = (message: string) => process.stdout.write(`  · ${message}\n`);

interface Finding {
  fatal: boolean;
  message: string;
}

function check(): Finding[] {
  const findings: Finding[] = [];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origin = process.env.PUBLIC_ORIGIN ?? process.env.NEXT_PUBLIC_ORIGIN;

  if (!url || !key) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(" and ");
    findings.push({
      fatal: true,
      message: `${missing} not set. The app would fall back to the filesystem store, which does not exist in a deployment — every published shop URL would 404 and nothing would say why.`,
    });
  } else {
    ok("Supabase adapter: both variables present, so no silent fallback to the filesystem store.");
  }

  // The prefix is not a convention, it is an instruction to inline the value
  // into the browser bundle. Set by mistake, the secret ships to every shopper.
  for (const name of Object.keys(process.env)) {
    if (/^NEXT_PUBLIC_/.test(name) && /(SERVICE|SECRET|_KEY$|API_KEY)/.test(name)) {
      findings.push({
        fatal: true,
        message: `${name} is set. A NEXT_PUBLIC_ variable is inlined into the browser bundle; this one is named like a secret. If it is the service-role key, it bypasses row-level security for anyone who reads the page source.`,
      });
    }
  }

  if (!origin) {
    findings.push({
      fatal: true,
      message: "PUBLIC_ORIGIN not set. Published shop URLs are built from it, so the link handed to a merchant would be wrong or relative.",
    });
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(origin);
    } catch {
      /* reported below */
    }
    if (!parsed) {
      findings.push({ fatal: true, message: `PUBLIC_ORIGIN is not a URL: ${origin}` });
    } else if (parsed.protocol !== "https:") {
      findings.push({
        fatal: true,
        // Not pedantry: the link goes in an Instagram bio and gets opened on a
        // phone. http here means a redirect at best.
        message: `PUBLIC_ORIGIN is ${parsed.protocol}//, not https. Shop links are shared and opened on phones.`,
      });
    } else if (parsed.pathname !== "/") {
      findings.push({
        fatal: true,
        message: `PUBLIC_ORIGIN has a path (${parsed.pathname}). Shop URLs are origin + slug; a path here produces links with a segment nobody expects.`,
      });
    } else {
      ok(`Shop links will be built from ${parsed.origin}`);
    }
  }

  if (hasAnthropicKey()) {
    // Worth saying rather than failing: it is not wrong, but the deployment
    // serves published shops and records events — it does not generate. A key
    // sitting in an environment that never calls the API is one more copy of a
    // secret than the job needs.
    findings.push({
      fatal: false,
      message: "An Anthropic API key is set here. Generation runs from a workstation, not the deployment — this environment has no code path that calls the API.",
    });
  }

  return findings;
}

process.stdout.write("\n  Checking the environment this deployment would serve from.\n\n");

const findings = check();
for (const finding of findings) (finding.fatal ? bad : note)(finding.message);

if (findings.some((f) => f.fatal)) {
  process.stderr.write("\n  Not safe to deploy. Fix the above, then re-run.\n\n");
  process.exit(1);
}

if (process.env.WORKBENCH) {
  note(
    `WORKBENCH=${process.env.WORKBENCH} is set. The development workbench at "/" is served on this deployment — it lists every shop in the local cache and shows the command that fills it. Intended on a preview URL; on the domain merchants are sent to, unset it.`,
  );
}

process.stdout.write(
  "\n  Configuration is deployable. One thing this cannot see: whether the\n" +
    "  database answers — `pnpm rls:check`.\n\n",
);
