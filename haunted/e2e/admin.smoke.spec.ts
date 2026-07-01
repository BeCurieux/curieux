import { test, expect } from '@playwright/test';

// Smoke: the embedded admin shell renders its three controls + dashboard even
// with no backend (it falls back to defaults). Proves the app boots and the
// merchant-facing surface is intact.
test('admin shell renders the voice picker, cadence, triggers', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Haunted Wishlist/i })).toBeVisible();

  // All three personas are offered.
  await expect(page.getByText('The Clingy Ex')).toBeVisible();
  await expect(page.getByText('The Poet')).toBeVisible();
  await expect(page.getByText('The Deadpan')).toBeVisible();

  // Cadence: Normal is the recommended default.
  await expect(page.getByText('recommended')).toBeVisible();

  // The guardrail reassurance is visible to the merchant.
  await expect(page.getByText(/never becomes spam/i)).toBeVisible();
});
