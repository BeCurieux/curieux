import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the app and a real local Supabase stack
// (`npm run db:start`, which needs Docker). Sign-in goes through the real
// magic-link email, read back from the stack's Mailpit inbox.
//
// Unset variables are read from the running local stack (`supabase status`),
// so no keys are written down here. Set them to point the tests elsewhere.
//
// PLAYWRIGHT_CHROMIUM_EXECUTABLE points at a preinstalled Chromium when the
// one matching this Playwright version can't be downloaded.

const PORT = 3300;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

function localStack(): Record<string, string> {
  try {
    const out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Object.fromEntries(
      [...out.matchAll(/^([A-Z_]+)="?(.*?)"?$/gm)].map((m) => [m[1]!, m[2]!]),
    );
  } catch {
    return {};
  }
}

const needsStack = !(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.SUPABASE_SECRET_KEY &&
  process.env.MAILPIT_URL
);
const stack = needsStack ? localStack() : {};

export const supabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? stack.API_URL ?? "http://127.0.0.1:54521",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? stack.PUBLISHABLE_KEY ?? "",
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? stack.SECRET_KEY ?? "",
  MAILPIT_URL: process.env.MAILPIT_URL ?? stack.MAILPIT_URL ?? "http://127.0.0.1:54524",
};

if (!supabaseEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !supabaseEnv.SUPABASE_SECRET_KEY)
  throw new Error(
    "No Supabase keys: run `npm run db:start` first, or set them in the environment.",
  );

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: the magic link comes back to the stack's
    // site_url (supabase/config.toml), and cookies are per host.
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: process.env.CI ? `npm run start` : `npm run dev`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: supabaseEnv.SUPABASE_SECRET_KEY,
      APP_URL: `http://localhost:${PORT}`,
      // The stand-in Stripe server (tests/e2e/fake-stripe.ts); not real keys.
      STRIPE_SECRET_KEY: "sk_test_fake",
      STRIPE_WEBHOOK_SECRET: "whsec_e2e_test",
      STRIPE_API_BASE: "http://127.0.0.1:12111",
      SUPPORT_EMAIL: "help@example.test",
      // The stand-in Resend server (tests/e2e/fake-resend.ts); not a real key.
      RESEND_API_KEY: "re_fake",
      RESEND_API_BASE: "http://127.0.0.1:12112",
      EMAIL_FROM: "Her Little Empire <hello@example.test>",
      EMAIL_TOKEN_SECRET: "e2e-email-token-secret",
      CRON_SECRET: "e2e-cron-secret-at-least-24-chars",
    },
  },
});
