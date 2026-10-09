import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Try it yourself acceptance path (docs/TRY_IT_YOURSELF.md): a visitor taps
// "Try it yourself" on the website and lands in a pretend swim school of
// their own, as its owner, clearly marked, with payments switched off. The
// school is cleaned up at the end by the same job that runs every hour.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

test.describe("try it yourself", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test("a visitor opens a pretend school of their own", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await page.getByRole("button", { name: "Try it yourself" }).first().click();
    await expect(page).toHaveURL(/\/business$/, { timeout: 30_000 });

    const banner = page.getByRole("region", { name: "Demo school" });
    await expect(banner).toContainText("This is a pretend school, just for you.");
    await expect(banner).toContainText("nothing here sends emails or takes payments");
    await expect(page.getByRole("heading", { name: "Hi Alex" })).toBeVisible();
    await expect(page.getByText("3 families are showing warning signs")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Getting set up" })).toHaveCount(0);
    await expect(page.getByText("2 spots can be filled this week")).toBeVisible();

    // The tour's first step: fill a spot someone can't make.
    const tour = page.getByRole("region", { name: "Try these four things" });
    await tour.getByRole("link", { name: /Fill a spot/ }).click();
    await expect(page.getByRole("heading", { name: "2 open spots, ready to offer" })).toBeVisible();
    await page.getByRole("button", { name: "Offer spot" }).first().click();
    await expect(page.getByText("Offered").first()).toBeVisible();

    // The last: the Harpers' account, where a payment is recorded.
    await page.goto("/business");
    await tour.getByRole("link", { name: /Record a payment/ }).click();
    await expect(page.getByRole("heading", { name: "Harper Family" })).toBeVisible();

    await page.goto("/business/families");
    await expect(page.getByText("Harper Family")).toBeVisible();

    await page.goto("/business/settings/payments");
    await expect(page.getByRole("heading", { name: "Switched off in the demo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Set up payments" })).toHaveCount(0);

    // Leaving signs out.
    await page.goto("/business");
    await banner.getByRole("button", { name: "Leave the demo" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test.afterAll(async () => {
    const db = admin();
    await db
      .from("organisations")
      .update({ demo_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .not("demo_expires_at", "is", null);
    await db.rpc("forget_demo_schools");
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email?.endsWith("@demo.ovyko.invalid")) await db.auth.admin.deleteUser(u.id);
  });
});
