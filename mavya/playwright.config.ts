import { defineConfig, devices } from "@playwright/test";

// Auth smoke tests against a running app and the local Supabase stack.
// In CI the app is built first and served with `next start`; locally the
// dev server is reused if it's already up.
//
// PLAYWRIGHT_CHROMIUM_EXECUTABLE points at a preinstalled Chromium when the
// one matching this Playwright version can't be downloaded.

const PORT = 3100;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The parent app is phone-first; 390px is the width the docs name.
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
