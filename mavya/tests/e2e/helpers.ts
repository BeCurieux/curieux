import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_PASSWORD ?? "";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (password === PASSWORD) await expect(page).not.toHaveURL(/\/sign-in$/);
}
