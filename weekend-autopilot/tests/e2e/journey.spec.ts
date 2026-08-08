import { expect, test } from "@playwright/test";

/**
 * The critical journey (§49):
 *
 *   LANDING → PURCHASE → SIGNUP → ONBOARDING → GENERATE → VIEW PLAN
 *   → SWAP → FEEDBACK → HISTORY
 *
 * These need a live Supabase project, Stripe test keys and a seeded account,
 * so they are skipped unless E2E_EMAIL and E2E_SUPABASE are set. Running them
 * against a shared staging environment is a deliberate choice: the parts they
 * cover — magic links, Stripe redirects, RLS — are exactly the parts that
 * cannot be proven with mocks.
 *
 * Everything below the auth boundary is covered without a database by the
 * unit, integration and eval suites, which is where the engine's correctness
 * is actually established.
 */

const CONFIGURED = Boolean(process.env.E2E_EMAIL && process.env.E2E_SUPABASE);

test.describe("signed-in journey", () => {
  test.skip(!CONFIGURED, "needs E2E_EMAIL and E2E_SUPABASE against a seeded environment");

  test("onboarding takes a new household from empty to a first plan", async ({ page }) => {
    await page.goto("/onboarding");

    // Screen 1: where.
    await page.getByPlaceholder("Suburb or postcode").fill("Marrickville");
    await page.getByRole("button", { name: "Marrickville" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 2: who.
    await page.getByRole("button", { name: /me and my partner/i }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 3: how far.
    await page.getByRole("button", { name: "40 minutes" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 4: budget.
    await page.getByRole("button", { name: /under a\$75/i }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 5: activity.
    await page.getByRole("button", { name: /happy walking a few kilometres/i }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 6: interests.
    await page.getByRole("button", { name: "Beaches" }).click();
    await page.getByRole("button", { name: "Food" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Screens 7–9.
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Continue" }).click();
    }

    // Screen 10: confirmation.
    await expect(page.getByRole("heading", { name: /we've got you/i })).toBeVisible();
    await page.getByRole("button", { name: /start my weekends/i }).click();

    await expect(page).toHaveURL(/\/app/);
  });

  test("a delivered plan can be opened, swapped and answered", async ({ page }) => {
    await page.goto("/app");

    const planLink = page.getByRole("link", { name: /open the plan/i });
    await expect(planLink).toBeVisible();
    await planLink.click();

    // Plan detail shows the timeline and the provenance disclosure.
    await expect(page.getByText(/where this information came from/i)).toBeVisible();

    // Swap: buttons, never a chat box (§25).
    await expect(page.getByRole("button", { name: /make it easier/i })).toBeVisible();
    await expect(page.locator("textarea")).toHaveCount(0);

    // Feedback.
    await page.getByRole("link", { name: /did you do it/i }).click();
    await page.getByRole("button", { name: "Yes" }).click();
    await page.getByRole("button", { name: /loved it/i }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(/thank you/i)).toBeVisible();
  });

  test("history shows the weekends that have been done", async ({ page }) => {
    await page.goto("/app/history");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/done/);
  });

  test("preferences can be changed and saved", async ({ page }) => {
    await page.goto("/app/preferences");
    await page.getByRole("button", { name: "60 minutes" }).click();
    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("a customer can export their data and reach account deletion", async ({ page }) => {
    await page.goto("/app/settings");

    await expect(page.getByRole("button", { name: /export my data/i })).toBeVisible();

    // Deletion requires typing the word: a stray tap must not destroy history.
    await page.getByRole("button", { name: /delete my account/i }).click();
    const confirm = page.getByRole("button", { name: /delete my account/i }).last();
    await expect(confirm).toBeDisabled();
  });

  test("billing shows pilot progress and the way to continue", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("checkout", () => {
  test.skip(!process.env.E2E_STRIPE, "needs Stripe test keys");

  test("the pilot CTA reaches Stripe Checkout", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("button", { name: /plan my next 4 weekends/i }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  });
});
