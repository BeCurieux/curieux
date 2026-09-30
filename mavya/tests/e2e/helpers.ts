import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_PASSWORD ?? "";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (password === PASSWORD) await expect(page).not.toHaveURL(/\/sign-in$/);
}

// Takes back the Burrows family's upcoming absences and make-ups, so a demo
// path starts from the seed. Needs the parent signed in.
export async function resetDemo(page: Page) {
  await page.goto("/family/account");
  await page.getByRole("button", { name: "Reset the demo" }).click();
  await expect(page).not.toHaveURL(/\/family\/account$/);
}

// Signs in as someone else in the same browser.
export async function switchTo(page: Page, email: string) {
  await page.context().clearCookies();
  await signIn(page, email);
}
