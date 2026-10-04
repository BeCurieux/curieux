import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { totp } from "../totp";
import { signIn } from "./helpers";
import { USERS } from "../../scripts/fixtures";

// Ovyko's own totals (docs/PLATFORM_TOTALS.md). A platform admin of the
// test's own is made with the secret key and removed at the end.

const run = Date.now();
const email = `e2e.platform.${run}@example.test`;
const password = `e2e-platform-${run}`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

test.describe("Ovyko's totals", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    const user = data?.users.find((u) => u.email === email);
    if (user) await db.auth.admin.deleteUser(user.id);
  });

  test("a school owner can't open them", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email, process.env.SEED_PASSWORD!);
    await expect(page).toHaveURL(/\/business$/);
    const response = await page.goto("/platform");
    expect(response?.status()).toBe(404);
  });

  test("a platform admin sees them after two-step sign-in", async ({ page }) => {
    const db = admin();
    const { data: auth } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Pat Platform" },
    });
    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_id", auth.user!.id)
      .single();
    await db.from("platform_admins").insert({ user_id: profile!.id });

    // Two-step sign-in is asked for straight after the password.
    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/two-step$/);
    await page.getByRole("button", { name: "Set up" }).click();
    const secret = (await page.getByTestId("totp-secret").innerText()).trim();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Finish set-up" }).click();
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole("heading", { name: "Ovyko totals" })).toBeVisible();
    await expect(page.getByText("Ovyko's share, last 30 days")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Month by month" })).toBeVisible();
  });
});
