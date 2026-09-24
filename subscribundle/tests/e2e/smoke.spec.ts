import { expect, test } from "@playwright/test";

test("landing page offers the shop login form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("a shop parameter is sent into the embedded app", async ({ request }) => {
  const response = await request.get("/?shop=example.myshopify.com", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toContain(
    "/app?shop=example.myshopify.com",
  );
});
