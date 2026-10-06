import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M8e acceptance path (docs/M8_NETWORK.md): the owner sees on Today that a
// family is showing warning signs, opens the list, reads why, and marks the
// family followed up so it leaves the list. The school and people are the
// test's own, removed at the end.

const run = Date.now();
const password = `e2e-retention-${run}`;
const ownerEmail = `e2e.retention.owner.${run}@example.test`;
const slug = `e2e-retention-${run}`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

test.describe("families who might leave", () => {
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

  test("the owner sees a family with a paused place and follows up", async ({ page }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Retention Swim",
        slug,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const { data: user, error } = await db.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
      user_metadata: { name: "Rhea Owner" },
    });
    if (error) throw error;
    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_id", user.user.id)
      .single();
    await db
      .from("staff_memberships")
      .insert({ user_id: profile!.id, organisation_id: orgId, role: "owner" });
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
    const { data: cls } = await db
      .from("classes")
      .insert({
        organisation_id: orgId,
        location_id: loc!.id,
        program_id: program!.id,
        level_id: level!.id,
        name: "Starfish Tue",
        weekday: 2,
        start_time: "16:30",
        duration_minutes: 30,
        capacity: 4,
      })
      .select("id")
      .single();
    const { data: family } = await db
      .from("families")
      .insert({
        organisation_id: orgId,
        display_name: "Quiet Family",
        primary_contact_name: "Quinn Quiet",
        primary_contact_phone: "0400 111 222",
      })
      .select("id")
      .single();
    const { data: kid } = await db
      .from("children")
      .insert({
        organisation_id: orgId,
        family_id: family!.id,
        first_name: "Remy",
        last_name: "Quiet",
        date_of_birth: "2018-03-01",
      })
      .select("id")
      .single();
    await db.from("enrolments").insert({
      organisation_id: orgId,
      child_id: kid!.id,
      class_id: cls!.id,
      status: "paused",
    });

    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByText("1 family is showing warning signs")).toBeVisible();
    await page.getByRole("link", { name: "See who" }).click();
    await expect(page).toHaveURL(/\/business\/retention$/);

    const card = page.getByRole("region", { name: "Quiet Family" });
    await expect(card).toContainText("Remy’s place in Starfish Tue is paused.");
    await expect(card.getByRole("link", { name: "0400 111 222" })).toHaveAttribute(
      "href",
      "tel:0400 111 222",
    );
    await card.getByLabel("Note about Quiet Family").fill("Called, back after the holidays");
    await card.getByRole("button", { name: "Followed up" }).click();
    await expect(page.getByText("No warning signs right now.")).toBeVisible();

    const { data: notes } = await db
      .from("retention_followups")
      .select("note")
      .eq("family_id", family!.id);
    expect(notes).toEqual([{ note: "Called, back after the holidays" }]);
  });
});
