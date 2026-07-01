import { defineConfig } from '@playwright/test';

// E2E boots the built app and drives it in a real browser. The full install →
// save → push → click flow needs a live dev store + Supabase + VAPID; the smoke
// spec runs with none of that (the admin shell renders standalone).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    // Point at a pre-installed Chromium via PW_CHROMIUM to skip the download
    // (e.g. PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome).
    // Falls back to Playwright's own managed browser when unset.
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:3000',
        timeout: 60_000,
        reuseExistingServer: true,
      },
});
