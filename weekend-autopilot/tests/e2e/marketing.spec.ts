import { expect, test } from "@playwright/test";

/**
 * The public surface (§49).
 *
 * These run without a database or a signed-in user, so they are the specs that
 * work in any environment — which makes them the ones worth having in CI.
 */

test.describe("landing page", () => {
  test("leads with the promise and both calls to action", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("52 weekends");
    await expect(page.getByRole("link", { name: /plan my next 4 weekends/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /see an example/i })).toBeVisible();
  });

  test("shows a complete example weekend rather than describing one", async ({ page }) => {
    await page.goto("/");

    const example = page.locator("#example");
    await expect(example).toContainText("Coastal walk");
    // The four facts that decide whether a plan happens.
    await expect(example).toContainText("24°C");
    await expect(example).toContainText("A$65");
    await expect(example).toContainText("min from home");
  });

  test("makes the comparison the brief asks for", async ({ page }) => {
    await page.goto("/");

    // The phrase appears in the section heading as well as the quotation, so
    // assert on the two quoted cards specifically.
    await expect(page.getByText("“Here are 47 things you could do.”")).toBeVisible();
    // Typographic apostrophe in the copy, so match either form.
    await expect(page.getByText(/^“Here['’]s what you['’]re doing Saturday\.”$/)).toBeVisible();
  });

  test("states the privacy position plainly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/not your movements/i)).toBeVisible();
  });

  test("offers the waitlist for people outside Sydney", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/not in your city yet/i).first()).toBeVisible();
    await expect(page.getByPlaceholder("Your city")).toBeVisible();
  });

  test("has no horizontal overflow on a phone", async ({ page, isMobile }) => {
    test.skip(!isMobile, "layout check is about the phone");
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });
});

test.describe("pricing", () => {
  test("sells the four-week pilot", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("four weekends");
    await expect(page.getByText("Your next 4 weekends")).toBeVisible();
  });

  test("says we take no cut of where you go", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/don't take a cut/i)).toBeVisible();
  });

  test("does not show annual or monthly while the flags are off", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("A year of weekends")).toHaveCount(0);
  });
});

test.describe("example page", () => {
  test("shows the plan and its backup, both labelled as illustrations", async ({ page }) => {
    await page.goto("/example");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/illustration rather than a live recommendation/i)).toBeVisible();
    await expect(page.getByText(/and the backup/i)).toBeVisible();
  });

  test("renders the full timeline", async ({ page }) => {
    await page.goto("/example");
    await expect(page.getByText("Easy 5.4 km waterfront walk")).toBeVisible();
    await expect(page.getByText(/home around/i)).toBeVisible();
  });
});

test.describe("legal and support pages", () => {
  for (const path of ["/privacy", "/terms", "/faq"]) {
    test(`${path} renders and links back`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible();
    });
  }

  test("privacy commits to approximate location only", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/we do not track your location/i)).toBeVisible();
  });

  test("terms are clear that we do not operate the activities", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByText(/we are not the operator/i)).toBeVisible();
  });
});

test.describe("auth entry points", () => {
  test("login asks for an email and nothing else", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("the app redirects an anonymous visitor to login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin is not reachable without an account", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("PWA", () => {
  test("serves a manifest naming the product from config", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as { name: string; start_url: string };
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe("/app");
  });

  test("serves an icon", async ({ request }) => {
    const response = await request.get("/icon.svg");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  });
});
