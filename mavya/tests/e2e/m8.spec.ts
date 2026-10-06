import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M8 acceptance path (docs/M8_NETWORK.md): a parent asks for a time; with
// two other children asking the same, the owner sees a new class
// opportunity, creates the class from it and enrols the child. The owner
// also sees this month with Ovyko. The school and people are the test's
// own, removed at the end.

const run = Date.now();
const password = `e2e-m8-${run}`;
const ownerEmail = `e2e.m8.owner.${run}@example.test`;
const parentEmail = `e2e.m8.parent.${run}@example.test`;
const slug = `e2e-m8-${run}`;

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

test.describe("what families want", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", slug);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === parentEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("a parent asks for a time; the owner creates the class and enrols the child", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Demand Swim",
        slug,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Dana Owner");
    const parentId = await account(parentEmail, "Pat Parent");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    const { data: loc } = await db
      .from("locations")
      .insert({ organisation_id: orgId, name: "Riverside" })
      .select("id")
      .single();
    const { data: program } = await db
      .from("programs")
      .insert({ organisation_id: orgId, name: "Learn to swim" })
      .select("id")
      .single();
    const { data: level } = await db
      .from("levels")
      .insert({ organisation_id: orgId, program_id: program!.id, name: "Starfish" })
      .select("id")
      .single();
    // An existing Saturday class, so the school has a timetable.
    await db.from("classes").insert({
      organisation_id: orgId,
      location_id: loc!.id,
      program_id: program!.id,
      level_id: level!.id,
      name: "Starfish Sat",
      weekday: 6,
      start_time: "09:00",
      duration_minutes: 30,
      capacity: 6,
    });
    const { data: fams } = await db
      .from("families")
      .insert([
        { organisation_id: orgId, display_name: "Parent Family" },
        { organisation_id: orgId, display_name: "Other Family" },
      ])
      .select("id, display_name");
    const mine = fams!.find((f) => f.display_name === "Parent Family")!.id;
    const other = fams!.find((f) => f.display_name === "Other Family")!.id;
    await db.from("family_members").insert({
      family_id: mine,
      user_id: parentId,
      relationship: "parent",
      is_primary_guardian: true,
    });
    const kid = (family: string, first: string) => ({
      organisation_id: orgId,
      family_id: family,
      first_name: first,
      last_name: "Demand",
      date_of_birth: "2019-05-01",
    });
    const { data: kids } = await db
      .from("children")
      .insert([kid(mine, "Mila"), kid(other, "Noah"), kid(other, "Ivy")])
      .select("id, first_name");
    // Two other children already want Tuesdays at 4:30.
    await db.from("place_wishes").insert(
      kids!
        .filter((k) => k.first_name !== "Mila")
        .map((k) => ({
          organisation_id: orgId,
          family_id: other,
          child_id: k.id,
          level_id: level!.id,
          weekdays: [2],
          earliest: "16:30",
          latest: "16:30",
        })),
    );

    // The parent asks for Tuesdays at 4:30.
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/kids");
    await page.getByRole("link", { name: /Mila/ }).click();
    await expect(page.getByRole("heading", { name: "Want another time?" })).toBeVisible();
    await page.locator("label", { hasText: "Tue" }).click();
    await page.getByLabel("Earliest start").fill("16:30");
    await page.getByLabel("Latest start").fill("16:30");
    await page.getByLabel(/^Level/).selectOption({ label: "Starfish" });
    await page.getByRole("button", { name: "Send to your activity provider" }).click();
    await expect(page.getByText("Sent to your activity provider.")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Times you've asked for" }).getByText("Tue, 4:30pm"),
    ).toBeVisible();

    // The owner sees the opportunity and creates the class from it.
    await page.context().clearCookies();
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByRole("heading", { name: "This month with Ovyko" })).toBeVisible();
    await page.getByRole("link", { name: "See the month" }).click();
    await expect(page.getByRole("heading", { name: /This month with Ovyko/ })).toBeVisible();
    await expect(page.getByText("Done without the front desk")).toBeVisible();

    await page.goto("/business");
    await expect(page.getByText("1 new class opportunity")).toBeVisible();
    await page.getByRole("region", { name: "What families want" }).getByRole("link").click();
    await expect(page.getByText("3 children would come")).toBeVisible();
    await expect(page.getByText("Tuesday 4:30pm · Starfish · Riverside")).toBeVisible();
    await page.getByRole("link", { name: "Create this class" }).click();
    await expect(page.getByLabel("Start time")).toHaveValue("16:30");
    await page.getByLabel("Places").fill("4");
    await page.getByRole("button", { name: "Create class" }).click();
    await expect(page).toHaveURL(/\/business\/classes\/[0-9a-f-]{36}$/);

    // Now the requests match a class with room: enrol Mila.
    await page.goto("/business/demand");
    await expect(page.getByText("None yet.")).toBeVisible();
    await page.getByRole("button", { name: "Enrol Mila" }).click();
    await expect(page.getByText("Mila is enrolled. Their family has been emailed.")).toBeVisible();
    const { data: wish } = await db
      .from("place_wishes")
      .select("status")
      .eq("child_id", kids!.find((k) => k.first_name === "Mila")!.id)
      .single();
    expect(wish!.status).toBe("placed");
  });
});
