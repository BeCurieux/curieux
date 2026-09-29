import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M1 acceptance: the three demo paths in docs/ACCEPTANCE_TESTS.md, step by
// step, plus the demo's tenancy and accessibility checks. Each test starts
// in a fresh browser, so a fresh demo.

// Serious or critical WCAG A/AA problems on the current page. Run with
// reduced motion so contrast is measured on settled text, not mid-fade.
async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) =>
      v.nodes.map((n) => `${page.url()}: ${v.id} ${n.target.join(" ")} ${n.any[0]?.message ?? ""}`),
    );
}

test.describe("parent demo path", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("report an absence, book a Saturday make-up, see Ava's progress", async ({ page }) => {
    await signIn(page, USERS.burrowsParent.email);

    // 1–2. Family home shows Ava's Wednesday swimming lesson.
    await expect(page).toHaveURL(/\/family$/);
    const avaPass = page.locator('a[href="/family/kids/ava"]').first();
    await expect(avaPass).toContainText("Ava");
    await expect(avaPass).toContainText("Swimming");
    await expect(avaPass).toContainText("Wednesday · 4:30pm");

    // 3–4. Can't make it → confirm absence.
    await page.getByRole("link", { name: "Can't make it" }).click();
    await expect(page.getByRole("heading", { name: "Let Aqua House know" })).toBeVisible();
    await expect(page.getByText("Your make-up credit lasts 60 days")).toBeVisible();
    await page.getByLabel(/Reason/).fill("Birthday party");
    await page.getByRole("button", { name: "Confirm absence" }).click();

    // 5. Make-up options.
    await expect(page).toHaveURL(/\/family\/makeups$/);
    await expect(page.getByRole("heading", { name: "We found 3 classes that fit" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    // 6–8. Select Saturday 9:00, confirm, see success.
    await page.getByRole("link", { name: /Saturday 9:00am/ }).click();
    await expect(page.getByRole("link", { name: /Saturday 9:00am.*selected/ })).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("status")).toContainText("You're booked in!");
    await expect(page.getByText("Saturday 9:00am", { exact: true })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    // 9–10. Open Ava, see progress. Progress is real since M3, and the
    // instructor path below changes it, so only its shape is checked here.
    await page.getByRole("link", { name: "See Ava's progress" }).click();
    await expect(page.getByRole("heading", { name: "Ava" })).toBeVisible();
    await expect(page.getByText(/^\d+%$/)).toBeVisible();
    await expect(page.getByText(/\d of 5 skills achieved/)).toBeVisible();
    await expect(page.getByText("Saturday 9:00am (make-up)")).toBeVisible();

    // Home now reflects the booking.
    await page.getByRole("link", { name: "Home" }).last().click();
    await expect(page.getByText("Ava's make-up is booked")).toBeVisible();
  });

  test("every tab in the bottom bar opens a page", async ({ page }) => {
    await signIn(page, USERS.burrowsParent.email);
    const nav = page.getByRole("navigation", { name: "Family" });
    for (const [tab, heading] of [
      ["Calendar", "This week"],
      ["Kids", "Kids"],
      ["Messages", "Messages"],
      ["Account", "Account"],
      ["Home", "Hi Sarah"],
    ] as const) {
      await nav.getByRole("link", { name: tab }).click();
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    }
  });
});

test.describe("business demo path", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("see 4 vacancies, open the candidates, inspect Dolphin 3", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email);

    // 1–2. Dashboard with 4 temporary vacancies.
    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByText("Temporary vacancies").locator("..")).toContainText("4");

    // 3–4. Fill 4 open spots → eligible candidates.
    await page.getByRole("link", { name: "Fill 4 open spots" }).click();
    await expect(page.getByRole("heading", { name: "4 open spots, ready to offer" })).toBeVisible();
    await expect(page.getByText("Harper Lee")).toBeVisible();
    await page.getByRole("button", { name: "Offer spot to Harper Lee" }).click();
    await expect(page.getByText("Offered")).toBeVisible();

    // 5–6. Dolphin 3 with occupancy and absences.
    await page.getByRole("link", { name: "Classes" }).click();
    await page.getByRole("link", { name: /Wednesday 4:30pm/ }).click();
    await expect(page).toHaveURL(/\/business\/classes\/dolphin-3$/);
    await expect(page.getByRole("heading", { name: "Dolphin 3" })).toBeVisible();
    await expect(
      page.getByRole("img", { name: "11 of 14 places filled, 1 open to fill" }),
    ).toBeVisible();
    await expect(page.getByText("Absences").locator("..")).toContainText("1");
    await expect(page.getByText("Zoe Martin").locator("..").locator("..")).toContainText(
      "Reported away",
    );
  });

  test("families can be searched", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email);
    await page.goto("/business/families");
    await page.getByRole("searchbox", { name: "Search families" }).fill("priya");
    await expect(page.getByText("1 family")).toBeVisible();
    await expect(page.getByText("Patel family")).toBeVisible();
  });
});

test.describe("instructor demo path", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("take attendance, update Kick 10m, and the parent sees it", async ({ page }, testInfo) => {
    // Attendance and progress are real since M3: one run writes them, so the
    // phone and desktop projects don't race on the same rows.
    test.skip(testInfo.project.name !== "phone", "writes shared demo rows");
    await signIn(page, USERS.aquaInstructor.email);

    // 1–2. Instructor home → Dolphin 3.
    await page.getByRole("link", { name: "Dolphin 3, Wednesday 4:30pm" }).click();
    await expect(page).toHaveURL(/\/instructor\/class\/dolphin-3$/);

    // 3. Mark a child present and another absent.
    await page.getByRole("button", { name: "Mark Oliver Chen here" }).click();
    await expect(page.getByRole("button", { name: "Mark Oliver Chen here" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Mark Zoe Martin away" }).click();
    await expect(page.getByText("1 here · 2 of 12 marked")).toBeVisible();

    // 4–6. Open Ava, Kick 10m → achieved, save, see confirmation. First put
    // Kick 10m back to developing, where the seed has it, so a rerun starts
    // from the same place.
    await page.getByRole("link", { name: "Ava Burrows" }).click();
    await page.getByLabel("Kick 10m: Developing").check({ force: true });
    await page.getByRole("button", { name: "Save progress" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await expect(page.getByText("60%")).toBeVisible();
    await page.getByLabel("Kick 10m: Achieved").check({ force: true });
    await page.getByRole("button", { name: "Save progress" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await expect(page.getByText("70%")).toBeVisible();
    await expect(page.getByLabel("Kick 10m: Achieved")).toBeChecked();

    // The proof loop: the parent sees the update in the same browser.
    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, USERS.burrowsParent.email);
    await page.goto("/family/kids/ava");
    await expect(page.getByText("70%")).toBeVisible();
    await expect(page.getByText("3 of 5 skills achieved")).toBeVisible();

    // …and hears about it: a dot on Messages until they've looked.
    const messages = page.getByRole("navigation", { name: "Family" }).getByRole("link", {
      name: /Messages/,
    });
    await expect(messages).toHaveAccessibleName(/new/);
    await messages.click();
    await expect(page.getByText("Ava achieved Kick 10m").first()).toBeVisible();
    await expect(messages).not.toHaveAccessibleName(/new/);
  });
});

test.describe("demo tenancy", () => {
  test("another family never sees the Burrows demo", async ({ page }) => {
    await signIn(page, USERS.chenParent.email);
    // The Chens see their own real class at their own provider, and nothing of Ava's.
    await expect(page.getByText("Peak Gymnastics")).toBeVisible();
    await expect(page.getByText("Mei").first()).toBeVisible();
    await expect(page.getByText("Ava")).toHaveCount(0);
    await expect(page.getByText("Can't make Wednesday?")).toHaveCount(0);
    await page.goto("/family/kids/ava");
    await expect(page.getByText("Ava")).toHaveCount(0);
  });

  test("another provider never sees Aqua House's demo", async ({ page }) => {
    await signIn(page, USERS.peakOwner.email);
    // Peak sees its own real class, and none of Aqua House's demo numbers.
    await expect(page.getByText("Classes each week")).toBeVisible();
    await expect(page.getByText("can be filled this week")).toHaveCount(0);
    await page.goto("/business/classes/dolphin-3");
    await expect(page.getByText("Zoe Martin")).toHaveCount(0);
    await page.goto("/business/families");
    await expect(page.getByText("Burrows Family")).toHaveCount(0);
    await page.goto("/business/fill");
    await expect(page.getByText("Harper Lee")).toHaveCount(0);
  });
});

test.describe("accessibility", () => {
  // Checked with animations off, so contrast is measured on settled text
  // rather than mid-fade.
  test.use({ reducedMotion: "reduce" });

  const pages = [
    {
      user: USERS.burrowsParent.email,
      paths: [
        "/family",
        "/family/absence",
        "/family/kids/ava",
        "/family/calendar",
        "/family/messages",
      ],
    },
    {
      user: USERS.aquaOwner.email,
      paths: [
        "/business",
        "/business/fill",
        "/business/classes",
        "/business/classes/dolphin-3",
        "/business/families",
        "/business/progress",
      ],
    },
    {
      user: USERS.aquaInstructor.email,
      paths: ["/instructor", "/instructor/class/dolphin-3", "/instructor/child/ava"],
    },
  ];

  for (const { user, paths } of pages) {
    test(`no serious axe violations for ${user}`, async ({ page }) => {
      await signIn(page, user);
      await page.waitForURL(/(family|business|instructor)$/);
      for (const path of paths) {
        await page.goto(path);
        expect(await seriousViolations(page)).toEqual([]);
      }
    });
  }
});
