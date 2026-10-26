import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the app running on the local backend (no
// Supabase, mock AI), so they need nothing provisioned. CI builds first and
// serves with `next start`; locally the dev server is reused if it's up.
//
// PLAYWRIGHT_CHROMIUM_EXECUTABLE points at a preinstalled Chromium when the
// one matching this Playwright version can't be downloaded.

const PORT = 3200;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EMPIRE_BACKEND: "local",
      EMPIRE_AI_PROVIDER: "mock",
      EMPIRE_DATA_DIR: ".data/e2e",
      APP_URL: `http://localhost:${PORT}`,
      EMPIRE_EMAIL_OPTIN: "on",
      EMPIRE_SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
      ADMIN_EMAILS: "founder@example.test",
    },
  },
});
