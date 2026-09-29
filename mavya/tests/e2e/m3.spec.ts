import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { CHILDREN, CLASSES, USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M3 acceptance: docs/M3_ATTENDANCE_PROGRESS.md. The instructor path's
// progress half, and the parent seeing it, are in m1-demo.spec.ts.
//
// These use Dolphin 1 (Leo's class), so they don't touch the rows the M1
// demo path checks, and fresh names so they pass on a database earlier runs
// have written to.

test("an owner adds a skill, the instructor assesses it, the owner removes it", async ({
  browser,
}) => {
  const name = `Glide ${randomUUID().slice(0, 6)}`;
  const owner = await browser.newPage();
  await signIn(owner, USERS.aquaOwner.email);
  await owner.goto("/business/settings/programs");
  await owner.getByRole("link", { name: /Dolphin 1/ }).click();
  await expect(owner.getByRole("heading", { name: "Dolphin 1 skills" })).toBeVisible();
  await owner.getByLabel("New skill").fill(name);
  await owner.getByLabel(/What it looks like/).fill("Glides 3 metres");
  await owner.getByRole("button", { name: "Add skill to Dolphin 1" }).click();
  await expect(owner.getByRole("status")).toContainText(`Added ${name}.`);
  await expect(owner.getByText(name, { exact: true })).toBeVisible();

  const instructor = await browser.newPage();
  await signIn(instructor, USERS.aquaInstructor.email);
  await instructor.goto(`/instructor/child/${CHILDREN.leo.id}`);
  await expect(instructor.getByRole("heading", { name: "Leo Burrows" })).toBeVisible();
  // Tap the visible option, as a person would. (A forced click on the hidden
  // radio can land on the sticky Save button on a phone.)
  await instructor.getByRole("group", { name }).getByText("Developing").click();
  await instructor.getByRole("button", { name: "Save progress" }).click();
  await expect(instructor.getByRole("status")).toContainText("Saved");
  await expect(instructor.getByLabel(`${name}: Developing`)).toBeChecked();

  await owner.getByRole("button", { name: `Remove ${name}` }).click();
  await expect(owner.getByText(name, { exact: true })).toHaveCount(0);
  await instructor.reload();
  await expect(instructor.getByText(name, { exact: true })).toHaveCount(0);
});

test("the instructor's attendance shows on the owner's class page", async ({ browser }) => {
  const instructor = await browser.newPage();
  await signIn(instructor, USERS.aquaInstructor.email);
  await instructor.getByRole("link", { name: "Dolphin 1, Tuesday 5:00pm" }).click();
  await expect(instructor.getByText(/^Lesson /)).toBeVisible();
  await instructor.getByRole("button", { name: "Mark Arjun Patel here" }).click();
  await expect(instructor.getByRole("button", { name: "Mark Arjun Patel here" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Saved, not just shown: still marked after a reload.
  await instructor.reload();
  await expect(instructor.getByRole("button", { name: "Mark Arjun Patel here" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const owner = await browser.newPage();
  await signIn(owner, USERS.aquaOwner.email);
  await owner.goto(`/business/classes/${CLASSES.dolphin1Tue.id}`);
  await expect(owner.getByText("Arjun Patel").locator("..").locator("..")).toContainText("Here");
  await expect(owner.getByText(/\d+ here · \d+ away · \d+ not marked/)).toBeVisible();
});

test("the owner's progress page lists levels and children to assess", async ({ page }) => {
  await signIn(page, USERS.aquaOwner.email);
  await page.goto("/business/progress");
  await expect(page.getByRole("heading", { name: "Levels" })).toBeVisible();
  await expect(page.getByText("Dolphin 3", { exact: true }).first()).toBeVisible();
  // The seed last assessed Ava two weeks before now at most; everyone else
  // in Dolphin 3 has never been assessed.
  await expect(page.getByRole("heading", { name: "Children needing assessment" })).toBeVisible();
  await expect(page.getByText("Not assessed yet").first()).toBeVisible();
});

test.describe("shared devices", () => {
  test("the server signs out an instructor who has been idle 30 minutes", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(page, USERS.aquaInstructor.email);
    await expect(page).toHaveURL(/\/instructor$/);
    await context.addCookies([
      {
        name: "ovyko_seen",
        value: String(Date.now() - 31 * 60 * 1000),
        url: baseURL!,
      },
    ]);
    await page.goto("/instructor");
    await expect(page).toHaveURL(/\/sign-in\?idle=1$/);
    await expect(page.getByRole("status")).toContainText("signed out after 30 minutes");
    // Really signed out, not just sent away.
    await page.goto("/instructor");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("the instructor app goes back to sign-in by itself", async ({ page }) => {
    await page.clock.install();
    await signIn(page, USERS.aquaInstructor.email);
    await expect(page).toHaveURL(/\/instructor$/);
    await page.clock.fastForward("31:00");
    await expect(page).toHaveURL(/\/sign-in\?idle=1$/);
    await page.goto("/instructor");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a parent isn't signed out for being idle", async ({ page, context, baseURL }) => {
    await signIn(page, USERS.chenParent.email);
    await context.addCookies([
      { name: "ovyko_seen", value: String(Date.now() - 31 * 60 * 1000), url: baseURL! },
    ]);
    await page.goto("/family");
    await expect(page).toHaveURL(/\/family$/);
  });
});
