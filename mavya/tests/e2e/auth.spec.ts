import { expect, test } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M0 acceptance (auth): unauthenticated users are sent to sign-in, role
// determines the app shell, and signing out ends the session.

test.describe("signed out", () => {
  for (const path of ["/business", "/instructor", "/family", "/family/anything"]) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    });
  }

  test("a wrong password is refused without saying which part was wrong", async ({ page }) => {
    await signIn(page, USERS.burrowsParent.email, "not-the-password");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "That email and password don't match. Try again." }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("role determines the app shell", () => {
  test("an owner lands in the business app", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email);
    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByRole("heading", { name: "Hi Sarah" })).toBeVisible();
    await expect(page.getByText(/^Aqua House/).first()).toBeVisible();
  });

  test("an instructor lands in the instructor app", async ({ page }) => {
    await signIn(page, USERS.aquaInstructor.email);
    await expect(page).toHaveURL(/\/instructor$/);
    await expect(page.getByRole("heading", { name: "Hi Mia" })).toBeVisible();
  });

  test("a parent lands in the family app and sees only their own children", async ({ page }) => {
    await signIn(page, USERS.burrowsParent.email);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/kids");
    await expect(page.getByRole("link", { name: /Ava/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Leo/ })).toBeVisible();
    await expect(page.getByText("Mei")).toHaveCount(0);
  });

  test("a parent can't open the business or instructor app", async ({ page }) => {
    await signIn(page, USERS.burrowsParent.email);
    await expect(page).toHaveURL(/\/family$/);
    for (const path of ["/business", "/instructor"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/family$/);
    }
  });

  test("an instructor can't open the business app", async ({ page }) => {
    await signIn(page, USERS.aquaInstructor.email);
    await expect(page).toHaveURL(/\/instructor$/);
    await page.goto("/business");
    await expect(page).toHaveURL(/\/instructor$/);
  });
});

test("signing out ends the session", async ({ page, context }) => {
  await signIn(page, USERS.burrowsParent.email);
  await expect(page).toHaveURL(/\/family$/);

  await page.goto("/family/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  const authCookies = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(authCookies).toEqual([]);

  await page.goto("/family");
  await expect(page).toHaveURL(/\/sign-in$/);
});
