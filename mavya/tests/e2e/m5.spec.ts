import { expect, test } from "@playwright/test";
import { CLASSES, USERS } from "../../scripts/fixtures";
import { resetDemo, signIn, switchTo } from "./helpers";

// M5 acceptance paths: docs/M5_FILL_SPOTS.md. These write real offers,
// bookings and cancellations, so each runs once, on the phone project.

test.describe("fill empty spots", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test("an owner offers a spot and the family claims it in one tap", async ({ page }) => {
    // Ava needs a make-up credit: she's away in two weeks.
    await signIn(page, USERS.burrowsParent.email);
    await resetDemo(page);
    await page.goto("/family/absence?child=ava");
    await page.getByRole("group", { name: "Which lesson?" }).locator("label").nth(1).click();
    await page.getByRole("button", { name: "Confirm absence" }).click();
    await expect(page).toHaveURL(/\/family\/makeups$/);

    // The owner offers her Thursday's open spot.
    await switchTo(page, USERS.aquaOwner.email);
    await page.goto("/business/fill");
    const thursday = page.getByRole("region", { name: /Thursday 4:30pm/ });
    await thursday.getByRole("button", { name: "Offer spot to Ava Burrows" }).click();
    await expect(thursday.getByText("Offered").first()).toBeVisible();

    // The family sees it on Home and claims it.
    await switchTo(page, USERS.burrowsParent.email);
    await expect(page.getByText("A spot opened for Ava").first()).toBeVisible();
    await page.getByRole("link", { name: "See the spot" }).click();
    await expect(
      page.getByRole("heading", { name: /Ava can come Thursday at 4:30pm/ }),
    ).toBeVisible();
    // Never who is away.
    await expect(page.getByText(/Martin|Bell|Lane/)).toHaveCount(0);
    const claimUrl = page.url();
    await page.getByRole("button", { name: "Claim this spot for Ava" }).click();
    await expect(page.getByRole("status")).toContainText("You're booked in!");

    // The link works once.
    await page.goto(claimUrl);
    await expect(page.getByText("You've already claimed this spot.")).toBeVisible();

    // The spot is filled: Thursday no longer needs filling.
    await switchTo(page, USERS.aquaOwner.email);
    await page.goto("/business/fill");
    await expect(page.getByRole("region", { name: /Thursday 4:30pm/ })).toHaveCount(0);

    await switchTo(page, USERS.burrowsParent.email);
    await resetDemo(page);
  });

  test("a link that isn't yours shows nothing", async ({ page }) => {
    await signIn(page, USERS.chenParent.email);
    await page.goto(`/family/claim/${"a".repeat(64)}`);
    await expect(page.getByText("This link isn't available")).toBeVisible();
  });

  test("an owner sees what cancelling a day affects before confirming", async ({ page }) => {
    // Five Saturdays out at Narrabeen, clear of the other tests' days.
    const sydney = (d: Date, o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", ...o }).format(d);
    let day = new Date(Date.now() + 29 * 86_400_000);
    while (sydney(day, { weekday: "short" }) !== "Sat") day = new Date(day.getTime() + 86_400_000);

    await signIn(page, USERS.peakOwner.email);
    await page.goto("/business/settings/cancel");
    await page.getByLabel("Location").selectOption({ label: "Narrabeen" });
    await page.getByLabel("Date").fill(sydney(day, {}));
    await page.getByRole("button", { name: "Check what this affects" }).click();
    const preview = page.getByRole("region", { name: /Cancelling Narrabeen/ });
    await expect(preview).toContainText("cancel 1 lesson");
    await expect(preview).toContainText("1 family");
    await expect(preview).toContainText("1 make-up credit");
    await preview.getByRole("button", { name: "Cancel 1 lesson" }).click();
    await expect(page.getByRole("status")).toContainText("Cancelled 1 lesson");
  });

  test("every number on Today opens to what it counts", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email);
    await page.getByRole("link", { name: "Reported absences" }).click();
    await expect(page.getByRole("heading", { name: "Reported absences" })).toBeVisible();
    await expect(page.getByText("Zoe Martin")).toBeVisible();

    await page.goto("/business");
    await expect(page.getByRole("region", { name: "Last 12 weeks" })).toContainText(
      "3 make-ups in spots that would have sat empty",
    );
    await page.getByRole("link", { name: "See them" }).click();
    await expect(page.getByText("3 records")).toBeVisible();
  });

  test("a class that double-books its instructor is refused", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email);
    await page.goto(`/business/classes/${CLASSES.dolphin1Tue.id}/edit`);
    await page.getByLabel("Start time").fill("17:00");
    await page.getByRole("button", { name: /Save/ }).click();
    await expect(
      page.getByText("Mia already teaches Dolphin 3 at 5:00pm on Tuesdays at Mona Vale."),
    ).toBeVisible();
  });
});
