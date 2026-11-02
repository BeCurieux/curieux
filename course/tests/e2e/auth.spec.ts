import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { service, signIn, uniqueEmail } from "./helpers";

test("signed out, /learn sends her to sign in and back", async ({ page }) => {
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/login\?next=%2Flearn$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("the gate is on the server, not only in the proxy", async ({ request }) => {
  // No cookie, no redirect-following: the page itself must not render.
  const response = await request.get("/learn", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login");
  expect(await response.text()).not.toContain("Signed in as");
});

test("sign-in page is accessible and rejects a bad address", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.getByLabel("Your email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That doesn't look like an email address.",
  );
});

test("smoke: signs in with a magic link", async ({ page }) => {
  const email = uniqueEmail("smoke");
  const link = await signIn(page, email);

  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByTestId("signed-in-email")).toHaveText(email);

  // The trigger created her profile on first sign-in.
  const { data: profile, error } = await service
    .from("profiles")
    .select("email, marketing_opt_in")
    .eq("email", email)
    .single();
  expect(error).toBeNull();
  expect(profile).toEqual({ email, marketing_opt_in: false });

  // Signed in, /login sends her straight on.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/learn$/);

  // Sign out, and the gate is back.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/login/);

  // The link worked once; a second tap explains instead of failing silently.
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=1/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "expired or has already been used",
  );
});

test("an admin is recognised from the admins table", async ({ page }) => {
  const email = uniqueEmail("admin");
  await signIn(page, email);
  await expect(page.getByTestId("signed-in-email")).toHaveText(email);
  await expect(page.getByText("You're an admin.")).toHaveCount(0);

  const { data: profile } = await service
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .single();
  const { error } = await service.from("admins").insert({ user_id: profile!.user_id });
  expect(error).toBeNull();

  await page.reload();
  await expect(page.getByText("You're an admin.")).toBeVisible();
});
