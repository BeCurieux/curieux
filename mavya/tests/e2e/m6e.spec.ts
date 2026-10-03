import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M6e acceptance path: docs/M6_MIGRATION_PILOT.md. It makes a school, an
// owner and a family of its own, so it runs once, on the phone project, and
// removes them at the end (with the secret key, as only setting up and
// tidying up).

const run = Date.now();
const password = `e2e-terms-${run}`;
const ownerEmail = `e2e.terms.owner.${run}@example.test`;
const parentEmail = `e2e.terms.parent.${run}@example.test`;

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

test.describe("term re-enrolment", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", `e2e-terms-${run}`);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === parentEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("an owner asks who's staying and offers a move up; a parent answers in one tap", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Term Swim",
        slug: `e2e-terms-${run}`,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Tia Owner");
    const parentId = await account(parentEmail, "Pat Parent");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    const { data: loc } = await db
      .from("locations")
      .insert({ organisation_id: orgId, name: "Term Pool" })
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
    const base = {
      organisation_id: orgId,
      location_id: loc!.id,
      program_id: program!.id,
      level_id: level!.id,
      start_time: "16:00",
      duration_minutes: 30,
      capacity: 4,
    };
    const { data: classes } = await db
      .from("classes")
      .insert([
        { ...base, name: "Dolphin 3", weekday: 1 },
        { ...base, name: "Dolphin 4", weekday: 5 },
      ])
      .select("id, name");
    const { data: fam } = await db
      .from("families")
      .insert({ organisation_id: orgId, display_name: "Parent Family" })
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
        first_name: "Ava",
        last_name: "Tern",
        date_of_birth: "2019-03-01",
      })
      .select("id")
      .single();
    await db.from("enrolments").insert({
      organisation_id: orgId,
      child_id: child!.id,
      class_id: classes!.find((c) => c.name === "Dolphin 3")!.id,
    });

    const today = localDate(new Date());

    // The owner adds this term and the next.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings");
    await page.getByRole("link", { name: /Terms/ }).click();
    await expect(page.getByRole("heading", { name: "No terms yet" })).toBeVisible();
    for (const [name, starts, ends] of [
      ["Term A", addDays(today, -30), addDays(today, 20)],
      ["Term B", addDays(today, 30), addDays(today, 100)],
    ] as const) {
      await page.goto("/business/settings/terms/new");
      await page.getByLabel("Name").fill(name);
      await page.getByLabel("First day").fill(starts);
      await page.getByLabel("Last day").fill(ends);
      await page.getByRole("button", { name: "Add term" }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    }

    // Lessons only in term.
    await page.goto("/business/settings/terms");
    await page.getByRole("switch", { name: /Lessons only during terms/ }).check();
    await expect(page.getByText("Lessons now run only during your terms.")).toBeVisible();

    // Get ready, offer Ava a move up, ask.
    await page.getByRole("link", { name: /Term B/ }).click();
    await page.getByRole("button", { name: "Get ready to ask families" }).click();
    const dolphin3 = page.getByRole("article", { name: "Dolphin 3" });
    await expect(dolphin3.getByText("Ava Tern")).toBeVisible();
    await dolphin3
      .getByLabel("Move Ava Tern next term to")
      .selectOption({ label: "Move to Dolphin 4 · Fri 4:00pm" });
    await dolphin3.getByRole("button", { name: "Save" }).first().click();
    await expect(dolphin3.getByText("Move offered.")).toBeVisible();
    await page.getByRole("button", { name: "Ask families" }).click();
    await expect(page.getByText("Asked 1 family.")).toBeVisible();

    // The parent answers.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    const card = page.getByRole("article", { name: "Ava, Term B" });
    await expect(card.getByRole("heading", { name: "Ava is ready to move up" })).toBeVisible();
    await card.getByRole("button", { name: "Move up to Dolphin 4" }).click();
    await expect(card.getByRole("status")).toHaveText("Moving to Dolphin 4");

    // The owner sees it.
    await page.context().clearCookies();
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings/terms");
    await page.getByRole("link", { name: /Term B/ }).click();
    await expect(
      page.getByRole("article", { name: "Dolphin 3" }).getByText("Moving up · offered Dolphin 4"),
    ).toBeVisible();
    const dolphin4 = page.getByRole("article", { name: "Dolphin 4" });
    await expect(dolphin4.getByText("Offered a place here:")).toBeVisible();
    await expect(dolphin4.getByText("3 of 4 free next term")).toBeVisible();
    await expect(page.getByText("Everyone has answered.")).toBeVisible();
  });
});
