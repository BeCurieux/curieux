import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M7d part 1 acceptance path: docs/M7_PAYMENTS.md. Makes a school, an
// owner and a family of its own, and removes them at the end.

const run = Date.now();
const password = `e2e-vouchers-${run}`;
const ownerEmail = `e2e.vouchers.owner.${run}@example.test`;
const parentEmail = `e2e.vouchers.parent.${run}@example.test`;

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

test.describe("government vouchers", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", `e2e-vouchers-${run}`);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === parentEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("an owner takes vouchers; a parent hands one over; the owner redeems it", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Voucher Swim",
        slug: `e2e-vouchers-${run}`,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Vic Owner");
    const parentId = await account(parentEmail, "Val Parent");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    const { data: fam } = await db
      .from("families")
      .insert({ organisation_id: orgId, display_name: "Val Family" })
      .select("id")
      .single();
    await db.from("family_members").insert({
      family_id: fam!.id,
      user_id: parentId,
      relationship: "parent",
      is_primary_guardian: true,
    });
    await db.from("children").insert({
      organisation_id: orgId,
      family_id: fam!.id,
      first_name: "Ivo",
      last_name: "Val",
      date_of_birth: "2018-05-01",
    });
    await db.from("ledger_entries").insert({
      organisation_id: orgId,
      family_id: fam!.id,
      kind: "charge",
      amount_cents: 23000,
      description: "Term 4 fees",
      due_on: "2027-01-01",
    });

    // The owner takes Active and Creative Kids vouchers.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings/accounts");
    await page.getByLabel(/Active and Creative Kids/).check();
    await page.getByRole("button", { name: "Save vouchers" }).click();
    await expect(page.getByText(/Families can hand over these vouchers/)).toBeVisible();

    // The parent hands one over.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/fees");
    const vouchers = page.getByRole("region", { name: "Activity vouchers: Val Family" });
    await vouchers.getByLabel("Voucher code").fill("abcd 2026");
    await vouchers.getByRole("button", { name: "Hand it over" }).click();
    await expect(vouchers.getByText(/Your activity provider will redeem it/)).toBeVisible();
    await expect(
      vouchers.getByText("ABCD2026 · Handed over: waiting for the school"),
    ).toBeVisible();

    // The owner redeems it.
    await page.context().clearCookies();
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings/accounts");
    const waiting = page.getByRole("listitem", {
      name: "Active and Creative Kids (NSW) voucher from Val Family",
    });
    await expect(waiting.getByText("ABCD2026")).toBeVisible();
    await waiting.getByRole("button", { name: "Redeemed" }).click();
    await expect(page.getByText("No vouchers waiting to be redeemed.")).toBeVisible();
    await expect(page.getByText("$50 credited")).toBeVisible();

    // The parent sees it come off their fees.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/fees");
    await expect(
      page.getByRole("region", { name: "Val Family" }).getByText("$180 owing"),
    ).toBeVisible();
    await expect(page.getByText("ABCD2026 · Redeemed: $50 off")).toBeVisible();
  });
});
