import { defineConfig } from "@playwright/test";

// Records the website's demo video (scripts/demo-video/README.md): the
// capture step drives the real app on the seeded demo school. Run against a
// freshly reset local database.

const PORT = 3100;

export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
    reducedMotion: "reduce",
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    cwd: "../..",
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
