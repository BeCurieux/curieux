import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * Use a pre-installed Chromium when one is present (CI images and this
 * development container ship one), falling back to Playwright's own download
 * locally. Without this the suite fails on a machine that has a browser but
 * not the exact build this Playwright version expects.
 */
const PREINSTALLED_CHROMIUM = [
  process.env.CHROMIUM_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
].find((path): path is string => Boolean(path) && existsSync(path!));

const launch = PREINSTALLED_CHROMIUM ? { executablePath: PREINSTALLED_CHROMIUM } : {};

/**
 * E2E configuration (§49).
 *
 * Mobile viewport by default, because that is where this product is used: a
 * layout bug on an iPhone is a real bug, and one on a 1440px desktop mostly
 * is not. A desktop project runs the same specs as a secondary check.
 *
 * The suite runs against the app with mock providers configured, so no paid
 * provider request is ever made from a test (§48).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // iPhone 14 metrics with Chromium underneath: we are testing our layout at
    // a phone viewport, not WebKit compatibility.
    {
      name: "mobile",
      use: { ...devices["iPhone 14"], defaultBrowserType: "chromium", launchOptions: launch },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: launch } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          AI_PROVIDER: "mock",
          PLACES_PROVIDER: "mock",
          ROUTES_PROVIDER: "mock",
          WEATHER_PROVIDER: "mock",
          NOTIFICATIONS_PROVIDER: "mock",
        },
      },
});
