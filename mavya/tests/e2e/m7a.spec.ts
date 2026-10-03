import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M7a acceptance path: docs/M7_PAYMENTS.md. It makes a school, an owner and
// a family of its own, so it runs once, on the phone project, and removes
// them at the end (with the secret key, as only setting up and tidying up).

const run = Date.now();
const password = `e2e-accounts-${run}`;
const ownerEmail = `e2e.accounts.owner.${run}@example.test`;
const parentEmail = `e2e.accounts.parent.${run}@example.test`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const localDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(d);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondaysBetween = (from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1))
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 1) n += 1;
  return n;
};

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

test.describe("family accounts", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", `e2e-accounts-${run}`);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === parentEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("an owner prices a class, adds term fees and records a payment; the parent sees it", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Fees Swim",
        slug: `e2e-accounts-${run}`,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Fay Owner");
    const parentId = await account(parentEmail, "Pia Parent");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    const { data: loc } = await db
      .from("locations")
      .insert({ organisation_id: orgId, name: "Fees Pool" })
      .select("id")
      .single();
    const { data: program } = await db
      .from("programs")
      .insert({ organisation_id: orgId, name: "Learn to swim" })
      .select("id")
      .single();
    const { data: level } = await db
      .from("levels")
      .insert({ organisation_id: orgId, program_id: program!.id, name: "Dolphin" })
      .select("id")
      .single();
    const { data: klass } = await db
      .from("classes")
      .insert({
        organisation_id: orgId,
        location_id: loc!.id,
        program_id: program!.id,
        level_id: level!.id,
        name: "Dolphin 3",
        weekday: 1,
        start_time: "16:00",
        duration_minutes: 30,
        capacity: 4,
      })
      .select("id")
      .single();
    const { data: fam } = await db
      .from("families")
      .insert({ organisation_id: orgId, display_name: "Pia Family" })
      .select("id")
      .single();
    await db.from("family_members").insert({
      family_id: fam!.id,
      user_id: parentId,
      relationship: "parent",
      is_primary_guardian: true,
    });
    const { data: child } = await db
      .from("children")
      .insert({
        organisation_id: orgId,
        family_id: fam!.id,
        first_name: "Ivy",
        last_name: "Pia",
        date_of_birth: "2019-03-01",
      })
      .select("id")
      .single();
    await db
      .from("enrolments")
      .insert({ organisation_id: orgId, child_id: child!.id, class_id: klass!.id });
    const today = localDate(new Date());
    const term = { starts: addDays(today, 30), ends: addDays(today, 100) };
    const { data: t } = await db
      .from("terms")
      .insert({
        organisation_id: orgId,
        name: "Term B",
        starts_on: term.starts,
        ends_on: term.ends,
      })
      .select("id")
      .single();
    const lessons = mondaysBetween(term.starts, term.ends);
    const fee = lessons * 25;

    // The owner prices the class at $25 a lesson.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto(`/business/classes/${klass!.id}/edit`);
    await page.getByLabel(/Price per lesson/).fill("25");
    await page.getByRole("button", { name: "Save class" }).click();
    await expect(page).toHaveURL(/\/business\/classes\/[^/]+$/);

    // Term fees from the term's page.
    await page.goto(`/business/settings/terms/${t!.id}`);
    await page.getByRole("button", { name: "Create term fees" }).click();
    await expect(page.getByText("Added 1 term fee.")).toBeVisible();
    await page.getByRole("button", { name: "Create term fees" }).click();
    await expect(page.getByText("Everyone already has their fees for this term.")).toBeVisible();

    // The family owes the fee; the owner records part of it paid.
    await page.goto(`/business/families/${fam!.id}`);
    const accountBox = page.getByRole("region", { name: "Account" });
    await expect(accountBox.getByText(`$${fee} owing`)).toBeVisible();
    await expect(
      accountBox.getByText(`Ivy · ${lessons} lessons × $25`, { exact: false }),
    ).toBeVisible();
    await accountBox.getByText("Record a payment").click();
    await accountBox.getByLabel("Amount ($)").first().fill("50");
    await accountBox.getByLabel("Paid by").selectOption("bank_transfer");
    await accountBox.getByRole("button", { name: "Record payment" }).click();
    await expect(accountBox.getByText("Payment of $50 recorded.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Account" }).getByText(`$${fee - 50} owing`),
    ).toBeVisible();

    // The owner's accounts list shows them.
    await page.goto("/business/settings/accounts");
    await expect(page.getByRole("link", { name: /Pia Family/ })).toContainText(
      `$${fee - 50} owing`,
    );

    // The parent sees their statement.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/account");
    await page.getByRole("link", { name: "Fees and payments" }).click();
    const statement = page.getByRole("region", { name: "Pia Family" });
    await expect(statement.getByText(`$${fee - 50} owing`)).toBeVisible();
    await expect(statement.getByText("Term B · Dolphin 3")).toBeVisible();
    await expect(statement.getByText("Payment received")).toBeVisible();
    await expect(statement.getByRole("button", { name: /Cancel/ })).toHaveCount(0);
  });
});
