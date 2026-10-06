import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./helpers";

// M8c acceptance path (docs/M8_NETWORK.md): the owner offers a free place to
// a waiting family; the parent, whose child has no class yet, accepts it on
// Home and the class appears in their week. The school and people are the
// test's own, removed at the end.

const run = Date.now();
const password = `e2e-offers-${run}`;
const ownerEmail = `e2e.offers.owner.${run}@example.test`;
const parentEmail = `e2e.offers.parent.${run}@example.test`;
const slug = `e2e-offers-${run}`;

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

test.describe("free places offered to waiting families", () => {
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

  test("the owner offers a place; the parent accepts it on Home", async ({ page }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Offer Swim",
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
    await db.from("classes").insert({
      organisation_id: orgId,
      location_id: loc!.id,
      program_id: program!.id,
      level_id: level!.id,
      name: "Starfish Tue",
      weekday: 2,
      start_time: "16:30",
      duration_minutes: 30,
      capacity: 4,
    });
    const { data: family } = await db
      .from("families")
      .insert({ organisation_id: orgId, display_name: "Waiting Family" })
      .select("id")
      .single();
    await db.from("family_members").insert({
      family_id: family!.id,
      user_id: parentId,
      relationship: "parent",
      is_primary_guardian: true,
    });
    const { data: kid } = await db
      .from("children")
      .insert({
        organisation_id: orgId,
        family_id: family!.id,
        first_name: "Mila",
        last_name: "Waiting",
        date_of_birth: "2019-05-01",
      })
      .select("id")
      .single();
    await db.from("place_wishes").insert({
      organisation_id: orgId,
      family_id: family!.id,
      child_id: kid!.id,
      level_id: level!.id,
      weekdays: [2],
      earliest: "16:00",
      latest: "17:00",
      created_by: parentId,
    });

    // The owner offers Mila the place.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/demand");
    await expect(
      page.getByRole("switch", { name: /Offer free places automatically/ }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Offer the place" }).click();
    // The request moves from "Places that match now" to waiting for an answer.
    const waiting = page.getByRole("region", { name: "Waiting for an answer" });
    await expect(waiting).toContainText("Mila (Waiting Family)");
    await expect(waiting).toContainText("Starfish Tue · Tuesday 4:30pm · held until");

    // The parent, whose child has no class yet, sees it on Home and says yes.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    const card = page.getByRole("region", { name: "A place for Mila" });
    await expect(card).toContainText("Tuesdays at 4:30pm · Starfish · Riverside");
    await expect(card).toContainText("Offer Swim is holding it for you until");
    await card.getByRole("button", { name: "Yes, enrol Mila" }).click();
    await expect(page.getByText("You're in! The class is now in your week.")).toBeVisible();
    await expect(page.getByRole("region", { name: "A place for Mila" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();

    const { data: wish } = await db
      .from("place_wishes")
      .select("status")
      .eq("child_id", kid!.id)
      .single();
    expect(wish!.status).toBe("placed");
  });
});
