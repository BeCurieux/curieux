import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// Ovyko's plan (docs/SUBSCRIPTIONS.md). Makes a school past its free trial
// and its owner, and removes them at the end.

const run = Date.now();
const email = `e2e.plan.${run}@example.test`;
const password = `e2e-plan-${run}`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

test.describe("Ovyko's plan", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", `e2e-plan-${run}`);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    const user = data?.users.find((u) => u.email === email);
    if (user) await db.auth.admin.deleteUser(user.id);
  });

  test("after the trial, an owner is reminded and sets up the plan on Stripe's page", async ({
    page,
  }) => {
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Plan Swim",
        slug: `e2e-plan-${run}`,
        activity_type: "swimming",
        owner_two_step_required: false,
        created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    const { data: auth } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Pia Owner" },
    });
    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_id", auth.user!.id)
      .single();
    await db
      .from("staff_memberships")
      .insert({ user_id: profile!.id, organisation_id: org!.id, role: "owner" });
    await db.from("locations").insert([
      { organisation_id: org!.id, name: "North Pool" },
      { organisation_id: org!.id, name: "South Pool" },
    ]);
    await page.route(
      (url) => url.hostname !== "localhost",
      (route) => route.fulfill({ contentType: "text/html", body: "<h1>Stripe (test)</h1>" }),
    );

    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/business$/);
    await page
      .getByText("Your free trial has ended. Set up your Ovyko plan to keep going.")
      .click();
    await expect(page).toHaveURL(/\/business\/settings\/plan$/);
    await expect(page.getByRole("heading", { name: "Your free trial has ended" })).toBeVisible();
    await expect(page.getByText("2 locations: $798 a month.")).toBeVisible();
    await page.getByRole("button", { name: "Set up your plan" }).click();
    await expect(page.getByRole("heading", { name: "Stripe (test)" })).toBeVisible();
    const { data: sub } = await db
      .from("school_subscriptions")
      .select("stripe_customer_id")
      .eq("organisation_id", org!.id)
      .single();
    expect(sub!.stripe_customer_id).toMatch(/^cus_/);
  });
});
