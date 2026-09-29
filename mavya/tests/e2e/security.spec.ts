import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M2.5 acceptance: docs/SECURITY.md.

// Animations off, so contrast is measured on settled text, not mid-fade.
test.use({ reducedMotion: "reduce" });

test("an owner removes a staff member's access; the person is locked out at once; the owner restores it", async ({
  browser,
  page,
}, testInfo) => {
  // Both projects would change the same person at the same time.
  test.skip(testInfo.project.name !== "desktop", "changes shared seed data");

  // Sam is signed in elsewhere, on their own device.
  const samContext = await browser.newContext();
  const sam = await samContext.newPage();
  await signIn(sam, USERS.aquaCasual.email);
  await expect(sam).toHaveURL(/\/instructor$/);

  await signIn(page, USERS.aquaOwner.email);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: /Staff/ }).click();
  await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

  const card = page.getByRole("listitem", { name: "Sam Ortiz" });
  // A previous failed run may have left Sam without access.
  const restore = card.getByRole("button", { name: "Give Sam access again" });
  if (await restore.isVisible()) {
    await restore.click();
    await expect(card.getByRole("button", { name: "Remove access" })).toBeVisible();
  }

  // Owners can't remove themselves.
  await expect(
    page.getByRole("listitem", { name: "Sarah Morgan" }).getByRole("button"),
  ).toHaveCount(0);

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await card.getByRole("button", { name: "Remove access" }).click();
  await expect(card.getByText(/Remove Sam.s access now\?/)).toBeVisible();
  await card.getByRole("button", { name: "Remove Sam" }).click();
  await expect(card.getByText("No access")).toBeVisible();

  // Sam's next page load no longer opens the instructor app.
  await sam.goto("/instructor");
  await expect(sam).toHaveURL(/\/(sign-in|no-access)$/);
  await samContext.close();

  // The removal is in the activity log.
  await page.goto("/business/settings/activity");
  await expect(page.getByText("Removed a staff member's access").first()).toBeVisible();

  await page.goto("/business/settings/staff");
  await card.getByRole("button", { name: "Give Sam access again" }).click();
  await expect(card.getByText("Instructor")).toBeVisible();
});

test("repeated wrong passwords pause sign-in for that email, whether or not it has an account", async ({
  page,
}) => {
  const email = `nobody-${randomUUID().slice(0, 8)}@example.test`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await signIn(page, email, "wrong-password");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "That email and password don't match. Try again." }),
    ).toBeVisible();
  }
  await signIn(page, email, "wrong-password");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Too many attempts. Wait 15 minutes, then try again." }),
  ).toBeVisible();
});
