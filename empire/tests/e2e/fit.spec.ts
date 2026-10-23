import { expect, test } from "@playwright/test";
import { signIn, takeQuiz } from "./fit-helpers";

// The Income Fit Test, converted: the 20-question Fit Finder, its report,
// calculator and dated 14-day plan, saved to the account.

test("without the Income Fit Test: the top three, then an honest offer", async ({ page }) => {
  await signIn(page);
  await takeQuiz(page);
  await expect(page.getByRole("heading", { name: "Vee, here's what fits." })).toBeVisible();
  await expect(page.getByText(/^Test .+ first\./)).toBeVisible();
  // Free: the top three ideas, one line each on why.
  const top = page.getByRole("list", { name: "Your top ideas" }).getByRole("listitem");
  await expect(top).toHaveCount(3);
  for (const item of await top.all()) await expect(item.locator("p")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: /Your full report is part of The Income Fit Test/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Does it add up?" })).toHaveCount(0);
});

test("with the Income Fit Test: full report, calculator and 14-day plan, saved", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/account");
  await page.getByRole("button", { name: "Local only: give me the Income Fit Test" }).click();
  await expect(page.getByText("The Income Fit Test", { exact: true })).toBeVisible();
  await takeQuiz(page);

  await expect(page.getByRole("heading", { name: "Side by side." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why it fits you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check these first." })).toBeVisible();
  await expect(page.getByText(/Rules Guide, checked 17 October 2026/)).toBeVisible();
  await expect(
    page.getByText(/Research on this idea last checked 1[67] October 2026/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Go, adjust or stop." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not enough evidence yet" })).toBeVisible();
  await expect(page.getByText(/^Or, in a slow-buying market/)).toBeVisible();

  // Calculator: nothing until real numbers go in.
  await expect(page.getByText(/a made-up price would be a made-up result/)).toBeVisible();
  await page.getByLabel(/^Price per /).fill("60");
  await page.getByLabel(/^Hours per /).fill("1.5");
  await expect(page.getByText(/to win back your start-up/)).toBeVisible();
  // 2 unpaid hours a week come off the hours that can be sold.
  await expect(page.getByLabel("Unpaid hours a week")).toHaveValue("2");
  await expect(page.getByText(/in your \d+ paid hrs\/week/)).toBeVisible();
  await expect(page.locator("#calc-status")).toHaveText("Saved to your account");

  // Tick Day 4 and it stays ticked.
  await page.getByLabel("Day 4 done").check();
  await expect(page.locator("#plan-status")).toHaveText("Saved to your account");
  await page.reload();
  await expect(page.getByLabel("Day 4 done")).toBeChecked();
  await expect(page.getByLabel(/^Price per /)).toHaveValue("60");
});
