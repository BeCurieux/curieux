import { defineConfig, devices } from "@playwright/test";

// M0 smoke test: the built server boots and serves the public landing page.
// Flows on a real development store arrive with M10; they need a logged-in
// admin session and cannot run on a CI runner.
const PORT = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Containers that ship a Chromium build set this rather than download one.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      // Placeholders: the landing page needs the app configured, not connected.
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY || "e2e-api-key",
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET || "e2e-api-secret",
      SHOPIFY_APP_URL:
        process.env.SHOPIFY_APP_URL || `http://localhost:${PORT}`,
      SCOPES: process.env.SCOPES || "write_products",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/subscribundle",
    },
  },
});
