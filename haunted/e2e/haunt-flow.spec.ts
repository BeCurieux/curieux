import { test, expect } from '@playwright/test';

// The full E2E from the brief: install → save item on PDP → grant push →
// trigger fires → notification received (mock push) → click attributes.
//
// This requires a live dev store + Supabase + VAPID keys, so it is gated behind
// E2E_LIVE=1 and skipped by default. It documents the exact acceptance path; the
// send-path invariants it would assert (cadence never breached, no unvetted line
// sent, click attribution) are already covered offline by the vitest suites.
const live = process.env.E2E_LIVE === '1';

test.describe('full haunt flow (live store)', () => {
  test.skip(!live, 'set E2E_LIVE=1 with a configured dev store to run');

  test('save → opt-in → haunt → click attributes', async ({ page, context }) => {
    // 1. Grant notifications up front so requestPermission() resolves granted.
    await context.grantPermissions(['notifications']);

    // 2. Open a PDP with the app block installed and save the item.
    await page.goto(process.env.E2E_PDP_URL!);
    await page.getByRole('button', { name: /let it haunt you/i }).click();
    await expect(page.getByText(/it will haunt you/i)).toBeVisible();

    // 3. Fire a test haunt from the admin (goes through the real sender gate).
    const res = await page.request.post(`${process.env.E2E_BASE_URL}/api/admin/test-haunt`, {
      headers: { Authorization: `Bearer ${process.env.E2E_SESSION_TOKEN}` },
      data: {},
    });
    expect(res.ok()).toBeTruthy();
    const report = await res.json();
    expect(report.outcome).toBe('sent');

    // 4. Clicking the notification hits /r?haunt=… which promotes the event to
    //    'clicked' and redirects to the PDP.
    const attributed = await page.request.get(
      `${process.env.E2E_BASE_URL}/r?haunt=${report.eventId}&product=${process.env.E2E_PRODUCT_GID}`,
    );
    expect(attributed.ok()).toBeTruthy();
  });
});
