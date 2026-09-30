import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M6b acceptance path: docs/M6_MIGRATION_PILOT.md. It creates a real parent
// account, so it runs once, on the phone project, and removes the account at
// the end (with the secret key, as only tidying up).

const email = `e2e.joiner.${Date.now()}@example.test`;

test.describe("getting parents on", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  });

  test("an owner invites a parent, who joins with a password and sees their child", async ({
    page,
    browser,
  }) => {
    await signIn(page, USERS.aquaOwner.email);
    // Today lists what's left to set up; the demo school is done.
    await expect(page.getByRole("region", { name: "Getting set up" })).toHaveCount(0);

    await page.goto("/business/families");
    await page
      .getByRole("link", { name: /Thompson Family/ })
      .first()
      .click();
    const parents = page.getByRole("region", { name: "Parents on Ovyko" });
    await expect(parents).toContainText("Nobody from this family has joined yet.");
    await parents.getByLabel("Parent's email").fill(email);
    await parents.getByRole("button", { name: "Make an invite link" }).click();
    const shown = parents.getByRole("status");
    await expect(shown).toContainText(`Send this link to ${email}`);
    const link = (await shown.locator("p.font-mono").innerText()).trim();
    expect(link).toMatch(/\/join\/[0-9a-f]{64}$/);
    await expect(parents.getByRole("list", { name: "Invites waiting" })).toContainText(email);

    // The parent, on their own phone, not signed in.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const parent = await phone.newPage();
    await parent.goto(link);
    await expect(parent.getByText("Aqua House invited you")).toBeVisible();
    await expect(
      parent.getByRole("heading", { name: "Join the Thompson family on Ovyko" }),
    ).toBeVisible();
    await expect(parent.getByText(email)).toBeVisible();
    await parent.getByLabel("Your name").fill("Jo Thompson");
    await parent.getByLabel("Choose a password").fill("short");
    await parent.getByRole("button", { name: "Join" }).click();
    await expect(parent.getByText("Choose a password of at least 10 characters.")).toBeVisible();
    await parent.getByLabel("Choose a password").fill("a-long-e2e-password");
    await parent.getByRole("button", { name: "Join" }).click();
    await expect(parent).toHaveURL(/\/family$/);
    await expect(parent.getByText("Ruby").first()).toBeVisible();

    // The link is spent.
    await parent.goto(link);
    await expect(parent.getByText("This invite has already been used.")).toBeVisible();
    await phone.close();

    // The owner sees who joined.
    await page.reload();
    await expect(parents).toContainText(`Jo Thompson · ${email} · joined`);
  });
});
