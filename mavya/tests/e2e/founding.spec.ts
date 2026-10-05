import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The founding-schools waitlist page (docs/WAITLIST_PAGE.md): a signed-out
// visitor finds it from the website and joins; the details are saved.

const run = Date.now();
const email = `e2e.founding.${run}@swimschool.example`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

test.describe("founding schools waitlist", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    await admin().from("waitlist_signups").delete().eq("email", email);
  });

  test("a visitor joins from the website", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Join the founding schools" }).click();
    await expect(page).toHaveURL(/\/founding$/);
    await expect(
      page.getByRole("heading", { name: "Your swim school, on autopilot." }),
    ).toBeVisible();

    const form = page.getByRole("region", { name: /Founding schools/ });
    await form.getByLabel("Your name").fill("Fran Founder");
    await form.getByLabel("Swim school").fill("Fin Swim");
    await form.getByLabel("Suburb").fill("Dee Why");
    await form.getByLabel("Email", { exact: true }).fill(email);
    await form.getByLabel(/About how many swimmers/).selectOption({ label: "500 to 1,000" });

    // Consent is needed first.
    await form.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(form.getByText("Tick the box so we can email you")).toBeVisible();

    await form.getByLabel(/Email me about Ovyko/).check();
    await form.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.getByText("You're on the list. Thank you.")).toBeVisible();

    const { data } = await admin()
      .from("waitlist_signups")
      .select("school, suburb, swimmers")
      .eq("email", email)
      .single();
    expect(data).toEqual({ school: "Fin Swim", suburb: "Dee Why", swimmers: "500_1000" });
  });
});
