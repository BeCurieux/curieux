import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// The public website at "/": what a signed-out visitor sees.

test("a signed-out visitor sees the website, can book a demo and can sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fill classes.");
  await expect(page.getByRole("link", { name: "Book a demo" })).toHaveAttribute(
    "href",
    /^mailto:hello@ovyko\.com\.au/,
  );
  await expect(page.getByText("Ovyko is made by Sounding Labs · ABN 38 813 430 864")).toBeVisible();

  // The demo video is on the page and its file is served.
  const video = page.getByLabel("Ovyko demo video");
  await expect(video).toBeVisible();
  const src = await video.locator("source").getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200);

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  // Nothing is wider than the screen, at desktop or phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page
    .getByRole("navigation", { name: "Site" })
    .getByRole("link", { name: "Sign in" })
    .click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a signed-in person going to the website is taken to their app", async ({ page }) => {
  await signIn(page, USERS.aquaOwner.email);
  await page.goto("/");
  await expect(page).toHaveURL(/\/business$/);
});
