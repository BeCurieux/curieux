import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M8d acceptance path (docs/M8_NETWORK.md): the owner turns on the school's
// waiting-list page; a new family, signed out, joins it; the owner adds
// them, and they're on the waiting list with an invite. The school and
// people are the test's own, removed at the end.

const run = Date.now();
const password = `e2e-wlpage-${run}`;
const ownerEmail = `e2e.wlpage.owner.${run}@example.test`;
const familyEmail = `e2e.wlpage.family.${run}@example.test`;
const slug = `e2e-wlpage-${run}`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

test.describe("a waiting-list page for new families", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", slug);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("the owner opens the page; a new family joins; the owner adds them", async ({ page }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Harbour Swim",
        slug,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const { data: created } = await db.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
      user_metadata: { name: "Hana Owner" },
    });
    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_id", created.user!.id)
      .single();
    await db
      .from("staff_memberships")
      .insert({ user_id: profile!.id, organisation_id: orgId, role: "owner" });
    await db.from("locations").insert({ organisation_id: orgId, name: "Harbour Pool" });
    const { data: program } = await db
      .from("programs")
      .insert({ organisation_id: orgId, name: "Learn to swim" })
      .select("id")
      .single();
    await db
      .from("levels")
      .insert({ organisation_id: orgId, program_id: program!.id, name: "Starfish" });

    // Closed until the owner opens it.
    await page.goto(`/waiting-list/${slug}`);
    await expect(page.getByRole("heading", { name: "This waiting list isn't open" })).toBeVisible();

    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings");
    await page.getByRole("link", { name: /Waiting list/ }).click();
    await page.getByRole("switch", { name: /Waiting-list page for new families/ }).check();
    await expect(page.getByText("On. Share the link below on your website.")).toBeVisible();

    // A new family, signed out, joins.
    await page.context().clearCookies();
    await page.goto(`/waiting-list/${slug}`);
    await expect(page.getByRole("heading", { name: "Join the waiting list" })).toBeVisible();
    await page.getByLabel("First name").fill("Lulu");
    await page.getByLabel("Last name").fill("Harbour");
    await page.getByLabel("Date of birth").fill("2020-06-01");
    await page.getByLabel(/^Level/).selectOption({ label: "Starfish" });
    await page.getByRole("group", { name: "Days that work" }).getByText("Wed").click();
    await page.getByLabel("Your name").fill("Lee Harbour");
    await page.getByLabel("Email", { exact: true }).fill(familyEmail);
    await page.getByRole("button", { name: "Join the waiting list" }).click();
    // Without the consent box ticked, it's refused and nothing is lost.
    await expect(page.getByText("Tick the box so the school can keep your details.")).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue("Lulu");
    await page.getByLabel("Harbour Swim may keep these details").check();
    await page.getByRole("button", { name: "Join the waiting list" }).click();
    await expect(page.getByText("Thanks, you're on the list.")).toBeVisible();

    // The owner adds them.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/demand");
    const families = page.getByRole("region", { name: "New families" });
    await expect(families).toContainText("Lulu Harbour · born 2020-06-01");
    await expect(families).toContainText("Wed, 3:30pm to 6:00pm · Starfish");
    await families.getByRole("button", { name: "Add to the waiting list" }).click();
    await expect(page.getByRole("region", { name: "New families" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Every open request" })).toContainText(
      "Lulu (Harbour Family)",
    );

    const { data: invites } = await db
      .from("family_invites")
      .select("email, status")
      .eq("organisation_id", orgId);
    expect(invites).toEqual([{ email: familyEmail, status: "pending" }]);
  });
});
