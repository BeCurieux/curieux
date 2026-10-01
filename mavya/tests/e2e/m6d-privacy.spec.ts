import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ORGS, USERS } from "../../scripts/fixtures";
import { totp } from "../totp";
import { signIn } from "./helpers";

// M6d part 2 acceptance paths: docs/M6_MIGRATION_PILOT.md. They make a
// school, an owner and a family of their own, so they run once, on the phone
// project, and remove them at the end (with the secret key, as only tidying
// up).

const run = Date.now();
const ownerEmail = `e2e.two-step.${run}@example.test`;
const password = `e2e-two-step-${run}`;
const familyName = `Erase Me ${run}`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// A fresh code, never the one just used (each code works once).
async function freshCode(page: Page, secret: string, used?: string) {
  let code = totp(secret);
  while (code === used) {
    await page.waitForTimeout(1000);
    code = totp(secret);
  }
  return code;
}

test.describe("protecting children, part 2", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().like("slug", "e2e-two-step-%");
    await db.from("families").delete().eq("display_name", familyName);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    const user = data?.users.find((u) => u.email === ownerEmail);
    if (user) await db.auth.admin.deleteUser(user.id);
  });

  test("an owner sets up two-step sign-in, then is asked for a code at every sign-in", async ({
    page,
  }) => {
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({ name: "Two Step Swim", slug: `e2e-two-step-${run}`, activity_type: "swimming" })
      .select("id")
      .single();
    const { data: auth } = await db.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
      user_metadata: { name: "Tess Owner" },
    });
    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_id", auth.user!.id)
      .single();
    await db
      .from("staff_memberships")
      .insert({ user_id: profile!.id, organisation_id: org!.id, role: "owner" });

    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/two-step$/);
    await expect(page.getByRole("heading", { name: "Protect your school" })).toBeVisible();
    await page.getByRole("button", { name: "Set up" }).click();
    await expect(page.getByAltText(/QR code/)).toBeVisible();
    const secret = (await page.getByTestId("totp-secret").innerText()).trim();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Finish set-up" }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();
    const first = await freshCode(page, secret);
    await page.getByLabel("6-digit code").fill(first);
    await page.getByRole("button", { name: "Finish set-up" }).click();
    await expect(page).toHaveURL(/\/business$/);

    // Signed out and back in: the password isn't enough.
    await page.context().clearCookies();
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/two-step$/);
    await page.goto("/business/families");
    await expect(page).toHaveURL(/\/two-step$/);
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await page.getByLabel("6-digit code").fill(await freshCode(page, secret, first));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/business$/);
  });

  test("an owner downloads a family's data, then deletes the family", async ({ page }) => {
    const db = admin();
    const { data: fam } = await db
      .from("families")
      .insert({ organisation_id: ORGS.aqua.id, display_name: familyName })
      .select("id")
      .single();
    await db.from("children").insert({
      organisation_id: ORGS.aqua.id,
      family_id: fam!.id,
      first_name: "Wren",
      last_name: "Eraseme",
      date_of_birth: "2018-06-01",
    });

    await signIn(page, USERS.aquaOwner.email);
    await page.goto(`/business/families/${fam!.id}`);
    const data = page.getByRole("region", { name: "Their data" });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      data.getByRole("button", { name: "Download their data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ovyko-family-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(file.family.name).toBe(familyName);
    expect(file.children[0].first_name).toBe("Wren");

    await data.getByRole("link", { name: "Delete this family" }).click();
    await expect(page.getByRole("heading", { name: `Delete ${familyName}?` })).toBeVisible();
    await expect(page.getByText(/Wren, and their classes/)).toBeVisible();
    await page.getByLabel(`Type ${familyName} to confirm`).fill("Erase Me");
    await page.getByRole("button", { name: "Delete this family for good" }).click();
    await expect(page.getByText("Type the family's name exactly")).toBeVisible();
    await page.getByLabel(`Type ${familyName} to confirm`).fill(familyName);
    await page.getByRole("button", { name: "Delete this family for good" }).click();
    await expect(page).toHaveURL(/\/business\/families\?deleted=1$/);
    await expect(page.getByRole("status")).toContainText("has been deleted");
    await expect(page.getByText(familyName)).toHaveCount(0);
  });
});
