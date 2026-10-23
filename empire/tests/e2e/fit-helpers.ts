import { expect, type Page } from "@playwright/test";

// Shared steps for the Fit Finder tests.

const unique = () => `fit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;

export async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.getByLabel("Your email").fill(unique());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/studio/);
}

export async function takeQuiz(page: Page) {
  await page.goto("/studio/fit");
  // Her Little Empire's promise heads the Fit Finder.
  await expect(
    page.getByRole("heading", { name: "Make your own money. Know what you're getting into." }),
  ).toBeVisible();
  const choose = async (label: string) => {
    await page.getByRole("button", { name: label, exact: false }).first().click();
    await page.getByRole("button", { name: "Next →" }).click();
  };
  const next = () => page.getByRole("button", { name: "Next →" }).click();
  await choose("Australia");
  await page.getByRole("spinbutton").fill("10");
  await next();
  await choose("About 2 hours");
  await choose("No");
  await choose("Building something over time");
  await choose("No");
  await page.getByRole("spinbutton").fill("500");
  await next();
  await choose("No"); // car
  await choose("No"); // space
  await choose("Yes"); // checks
  await choose("Messaging only");
  await choose("Either");
  await choose("Either");
  await choose("High · I enjoy tech");
  await choose("Creative");
  await choose("Writing");
  await choose("Yes, remote only");
  await choose("No, keep me off camera");
  await page.getByRole("spinbutton").fill("30");
  await next();
  await page.getByLabel("What should we call you on your report?", { exact: true }).fill("Vee");
  await page.getByRole("button", { name: "Build my report →" }).click();
  await expect(page).toHaveURL(/\/studio\/fit\/[0-9a-f-]+$/);
}
