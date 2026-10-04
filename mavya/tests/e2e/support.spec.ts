import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { totp } from "../totp";
import { signIn } from "./helpers";

// M6g acceptance path (support access): docs/M6_MIGRATION_PILOT.md. A
// school, its owner and an Ovyko support person of the test's own are made
// with the secret key and removed at the end.

const run = Date.now();
const password = `e2e-support-${run}`;
const ownerEmail = `e2e.support.owner.${run}@example.test`;
const supportEmail = `e2e.support.staff.${run}@example.test`;
const slug = `e2e-support-${run}`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function account(email: string, name: string) {
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  const { data: profile } = await db
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  return profile!.id as string;
}

test.describe("support access", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", slug);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === supportEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("an owner lets support in; support looks; the owner sees it and ends it", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Helpdesk Swim",
        slug,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Hana Owner");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    await db
      .from("locations")
      .insert({ organisation_id: orgId, name: "Riverside Pool", timezone: "Australia/Sydney" });
    const supportId = await account(supportEmail, "Sky Support");
    await db.from("platform_admins").insert({ user_id: supportId });

    // The owner lets support in.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings/support");
    await expect(
      page.getByRole("heading", { name: "Support can't see your school" }),
    ).toBeVisible();
    await page.getByLabel(/What do you need help with/).fill("Our pool isn't showing");
    await page.getByRole("button", { name: "Let Ovyko support in for 48 hours" }).click();
    await expect(page.getByRole("heading", { name: "Support can see your school" })).toBeVisible();
    await expect(page.getByText("Nobody from Ovyko has looked at your school.")).toBeVisible();

    // Support signs in with two-step and looks.
    const other = await browser.newContext();
    const support = await other.newPage();
    await signIn(support, supportEmail, password);
    await expect(support).toHaveURL(/\/two-step$/);
    await support.getByRole("button", { name: "Set up" }).click();
    const secret = (await support.getByTestId("totp-secret").innerText()).trim();
    await support.getByLabel("6-digit code").fill(totp(secret));
    await support.getByRole("button", { name: "Finish set-up" }).click();
    await expect(support).toHaveURL(/\/platform$/);
    await support.getByRole("link", { name: "Helpdesk Swim" }).click();
    await expect(support.getByRole("heading", { name: "Helpdesk Swim" })).toBeVisible();
    await expect(support.getByText("“Our pool isn't showing”")).toBeVisible();
    await expect(support.getByText("Riverside Pool")).toBeVisible();

    // The owner sees the look, and ends it.
    await page.reload();
    await expect(page.getByText("Sky Support")).toBeVisible();
    await page.getByRole("button", { name: "End support access now" }).click();
    await expect(
      page.getByRole("heading", { name: "Support can't see your school" }),
    ).toBeVisible();

    // Support is shut out at once.
    const response = await support.goto(`/platform/support/${orgId}`);
    expect(response?.status()).toBe(404);
    await support.goto("/platform");
    await expect(support.getByRole("link", { name: "Helpdesk Swim" })).toHaveCount(0);
    await other.close();
  });
});
