import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Phase 1 entry points: the public FIT Finder page, coming back to it after
// sign-in, free-tool links on every page, and no buy button for a Launch
// Pack that isn't on sale (the e2e server has no Gumroad product set).

const unique = (name: string) =>
  `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;

test("the public FIT Finder page leads into the quiz, through sign-in and back", async ({
  page,
}) => {
  await page.goto("/fit");
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make your own money. Know what you're getting into.",
  );
  await expect(page.getByText("Your top three, with one line on why each fits")).toBeVisible();
  await page.getByRole("link", { name: "Start the FIT Finder" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fstudio%2Ffit/);
  await page.getByLabel("Your email").fill(unique("fit-landing"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/studio\/fit$/);
  await expect(page.getByText("1 of 20")).toBeVisible();
});

test("a crafted next link can't send her anywhere else", async ({ page }) => {
  await page.goto("/sign-in?next=https://evil.example/");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.getByLabel("Your email").fill(unique("next-safe"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/studio(\/new)?$/);
});

test("every page links to the free tools", async ({ page }) => {
  await page.goto("/pricing");
  const footer = page.getByRole("navigation", { name: "Footer" });
  await expect(footer.getByRole("link", { name: "Free FIT Finder" })).toHaveAttribute(
    "href",
    "/fit",
  );
  await expect(footer.getByRole("link", { name: "Free ads calculator" })).toHaveAttribute(
    "href",
    "/ads/tools/calculator",
  );
});

test("the Launch Pack says it isn't on sale yet, instead of a dead-end buy button", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByText("Not on sale yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get the Launch Pack" })).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText(/Launch Pack isn.t on sale yet/)).toBeVisible();
});

test("no serious accessibility issues on the FIT Finder page", async ({ page }) => {
  await page.goto("/fit");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious.map((v) => v.id)).toEqual([]);
});
