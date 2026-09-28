import { expect, test, type Page } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";

// M0 acceptance (auth): unauthenticated users are sent to sign-in, role
// determines the app shell, and signing out ends the session.

const PASSWORD = process.env.SEED_PASSWORD ?? "";

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("signed out", () => {
  for (const path of ["/", "/business", "/instructor", "/family", "/family/anything"]) {
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
    await expect(page.getByRole("heading", { name: "Aqua House" })).toBeVisible();
  });

  test("an instructor lands in the instructor app", async ({ page }) => {
    await signIn(page, USERS.aquaInstructor.email);
    await expect(page).toHaveURL(/\/instructor$/);
    await expect(page.getByRole("heading", { name: "Hi Mia" })).toBeVisible();
  });

  test("a parent lands in the family app and sees only their own children", async ({ page }) => {
    await signIn(page, USERS.burrowsParent.email);
    await expect(page).toHaveURL(/\/family$/);
    const kids = page.getByRole("listitem");
    await expect(kids).toHaveText(["AAva", "LLeo"]);
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

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  const authCookies = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(authCookies).toEqual([]);

  await page.goto("/family");
  await expect(page).toHaveURL(/\/sign-in$/);
});
