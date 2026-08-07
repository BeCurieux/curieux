// Which key, under which name.
//
// Supabase renamed its API keys. What the dashboard used to call the `anon`
// key is now the **publishable** key (`sb_publishable_…`), and `service_role`
// is now the **secret** key (`sb_secret_…`). Both styles work with
// supabase-js; only the names on the settings page changed.
//
// Both spellings are accepted here because the alternative is the worst kind
// of setup failure: somebody follows a guide, copies the value the dashboard
// actually shows them, puts it under the name the guide actually names, and
// the application starts with an undefined key and fails on the first
// request with something that mentions neither.
//
// The distinction that matters is not the naming, it is which is which.
//
//   The publishable key is **not a secret**. It ships inside the browser
//   bundle by design, and everything it can reach is reachable only through
//   row-level security. Pasting it into a chat, a screenshot or an issue is
//   fine.
//
//   The secret key bypasses row-level security completely. It is the one
//   credential in this product that can read every family's archive at once.
//   It belongs in .env.local and in a deployment's environment, and nowhere
//   a person could read it — not in a message, not in a support ticket, not
//   in a repository.

/** The browser-safe key, under either name. */
export function publishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

/** The key that bypasses every policy. Server only, always. */
export function secretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

export function projectUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

/**
 * What is missing, in words somebody can act on.
 *
 * A misconfigured project used to surface as `Invalid URL` or as a fetch to
 * `undefined/auth/v1/token` — errors that name neither the setting nor the
 * page it comes from. Whoever hits this is usually setting the product up
 * for the first time, which is the worst moment to be handed a stack trace.
 */
export function whatIsMissing(): string | null {
  const missing: string[] = [];
  if (!projectUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL (Project Settings → API → Project URL)");
  if (!publishableKey()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Project Settings → API Keys → publishable)");
  }
  if (missing.length === 0) return null;

  return (
    `Qotidia has no database to talk to. Missing from .env.local:\n  ${missing.join("\n  ")}\n\n` +
    `To run the whole product with no database at all, set DEMO_MODE=1 instead.`
  );
}
