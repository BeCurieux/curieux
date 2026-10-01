import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHILDREN, USERS } from "../../scripts/fixtures";
import { signIn, switchTo } from "./helpers";

// M6d part 1 acceptance path: docs/M6_MIGRATION_PILOT.md. It writes Ava's
// health notes and a restriction, so it runs once, on the phone project, and
// removes them at the end (with the secret key, as only tidying up).

async function tidy() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  await admin.from("child_health").delete().eq("child_id", CHILDREN.ava.id);
  await admin.from("child_restrictions").delete().eq("child_id", CHILDREN.ava.id);
  await admin.from("sensitive_views").delete().eq("child_id", CHILDREN.ava.id);
}

test.describe("protecting children", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });
  test.beforeAll(tidy);
  test.afterAll(tidy);

  test("a parent's allergy reaches the instructor, and the owner sees who looked", async ({
    page,
  }) => {
    // The parent adds an allergy.
    await signIn(page, USERS.burrowsParent.email);
    await page.goto("/family/kids/ava");
    const health = page.getByRole("region", { name: "Health notes" });
    await health.getByLabel(/Allergies/).fill("Peanuts. EpiPen in her bag.");
    await health.getByRole("button", { name: "Save health notes" }).click();
    await expect(health.getByRole("status")).toContainText("Saved.");

    // The instructor sees a flag on the roster and the allergy on Ava's page.
    await switchTo(page, USERS.aquaInstructor.email);
    await page.goto("/instructor/class/dolphin-3");
    const ava = page.getByRole("listitem").filter({ hasText: "Ava Burrows" });
    await expect(ava.getByText("Health")).toBeVisible();
    await expect(ava).not.toContainText("Peanuts");
    await ava.getByRole("link", { name: /Ava Burrows/ }).click();
    await expect(page.getByText("Peanuts. EpiPen in her bag.")).toBeVisible();

    // The owner sees that the instructor looked, and adds a restriction.
    await switchTo(page, USERS.aquaOwner.email);
    await page.goto(`/business/families/${CHILDREN.ava.family_id}/children/${CHILDREN.ava.id}`);
    await expect(page.getByRole("list", { name: "Looks" })).toContainText(
      `${USERS.aquaInstructor.name} · instructor`,
    );
    const pickup = page.getByRole("region", { name: "Pickup and contact" });
    await pickup.getByLabel("Person's name").fill("Jordan Burrows");
    await pickup.getByLabel("What isn't allowed").selectOption("no_collect");
    await pickup.getByLabel(/Details/).fill("Court order 2026/123.");
    await pickup.getByRole("button", { name: "Add restriction" }).click();
    await expect(pickup.getByRole("list", { name: "Restrictions" })).toContainText(
      "May not collect: Jordan Burrows",
    );

    // The instructor sees the warning, without the details.
    await switchTo(page, USERS.aquaInstructor.email);
    await page.goto(`/instructor/child/${CHILDREN.ava.id}`);
    await expect(page.getByRole("note")).toContainText("May not collect: Jordan Burrows");
    await expect(page.getByText("Court order")).toHaveCount(0);

    // The parent doesn't see it.
    await switchTo(page, USERS.burrowsParent.email);
    await page.goto("/family/kids/ava");
    await expect(page.getByText("Jordan Burrows")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Health notes" }).getByLabel(/Allergies/),
    ).toHaveValue("Peanuts. EpiPen in her bag.");
  });
});
