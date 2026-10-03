import { expect, test } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { resetDemo, signIn, switchTo } from "./helpers";

// M4 acceptance paths: docs/M4_MAKEUPS.md. These write real absences,
// bookings, rules and cancellations, so each runs once, on the phone project.

test.describe("make-ups", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test("a parent books a make-up, the instructor sees it, then it's all taken back", async ({
    page,
  }) => {
    await signIn(page, USERS.burrowsParent.email);
    await resetDemo(page);

    // 1. Report next week's lesson and book the soonest Saturday.
    await page.goto("/family/absence?child=ava");
    await page.getByRole("group", { name: "Which lesson?" }).locator("label").nth(1).click();
    await page.getByRole("button", { name: "Confirm absence" }).click();
    await expect(page).toHaveURL(/\/family\/makeups$/);
    await page.getByRole("link", { name: /Saturday 9:00am/ }).click();
    await expect(page.getByRole("link", { name: /Saturday 9:00am.*selected/ })).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("status")).toContainText("You're booked in!");

    // Home shows it. (Not the calendar: it shows the next seven days, and on
    // a Saturday after 9am the soonest Saturday make-up is a week away.)
    await page.goto("/family");
    await expect(page.getByText("Ava's make-up is booked")).toBeVisible();

    // The Saturday class shows Ava coming as a make-up. (The instructor's
    // roster shows her once that lesson opens; tests/rls/m4.test.ts checks
    // the instructor can see her booking.)
    await switchTo(page, USERS.aquaOwner.email);
    await page.goto("/business/classes");
    await page.getByRole("link", { name: /Saturday 9:00am/ }).click();
    await expect(
      page.getByRole("region", { name: "Coming as a make-up" }).getByText("Ava Burrows"),
    ).toBeVisible();

    // 2. The parent cancels the make-up (credit back), then takes back the absence.
    await switchTo(page, USERS.burrowsParent.email);
    await page.goto("/family/kids/ava");
    await page.getByRole("button", { name: "Cancel Ava's make-up" }).click();
    await expect(page.getByRole("button", { name: "Cancel Ava's make-up" })).toHaveCount(0);
    // The credit is back; taking back the absence cancels it.
    await expect(page.getByRole("link", { name: "Find a make-up" })).toBeVisible();
    const comingAfterAll = page.getByRole("button", { name: /Ava can make it on .* after all/ });
    await comingAfterAll.click();
    await expect(comingAfterAll).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Find a make-up" })).toHaveCount(0);
    await page.goto("/family");
    await expect(page.getByText("Ava's make-up is booked")).toHaveCount(0);
    await expect(page.getByText("Ava has a make-up credit")).toHaveCount(0);
  });

  test("an owner changes the rules and families see them", async ({ page }) => {
    await signIn(page, USERS.peakOwner.email);
    await page.goto("/business/settings");
    await page.getByRole("link", { name: /Make-up rules/ }).click();
    const notice = page.getByLabel("Notice needed (hours)");
    await expect(notice).toHaveValue("4");
    await notice.fill("0");
    await page.getByRole("button", { name: "Save rules" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    // A nonsense value is refused in plain words.
    await page.getByLabel("A credit lasts (days)").fill("0");
    await page.getByRole("button", { name: "Save rules" }).click();
    await expect(page.getByText("How long a credit lasts must be at least 1.")).toBeVisible();

    await switchTo(page, USERS.chenParent.email);
    await page.goto("/family/absence");
    await expect(page.getByText("Tell us any time before class")).toBeVisible();

    // Put Peak's four hours back.
    await switchTo(page, USERS.peakOwner.email);
    await page.goto("/business/settings/makeups");
    await page.getByLabel("Notice needed (hours)").fill("4");
    await page.getByRole("button", { name: "Save rules" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
  });

  test("an owner cancels a day and the family holds a credit", async ({ page }) => {
    // Three Saturdays out, so Mei's next lessons are left as they are.
    const sydney = (d: Date, o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", ...o }).format(d);
    let day = new Date(Date.now() + 15 * 86_400_000);
    while (sydney(day, { weekday: "short" }) !== "Sat") day = new Date(day.getTime() + 86_400_000);
    const date = sydney(day, {});

    await signIn(page, USERS.peakOwner.email);
    await page.goto("/business/settings/cancel");
    await page.getByLabel("Location").selectOption({ label: "Narrabeen" });
    await page.getByLabel("Date").fill(date);
    // Since M5 the owner sees what it affects before confirming.
    await page.getByRole("button", { name: "Check what this affects" }).click();
    await page.getByRole("button", { name: "Cancel 1 lesson" }).click();
    await expect(page.getByRole("status")).toContainText("Cancelled 1 lesson");

    await switchTo(page, USERS.chenParent.email);
    await expect(page.getByText("Mei has a make-up credit")).toBeVisible();
    await page
      .getByRole("link", { name: /Messages/ })
      .first()
      .click();
    await expect(page.getByText(/Mei's Saturday .* lesson is cancelled/)).toBeVisible();
  });
});
