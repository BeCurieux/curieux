import { expect, test } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M6a acceptance path: docs/M6_MIGRATION_PILOT.md. It imports and then undoes
// real rows, so it runs once, on the phone project.

const CLASSES_CSV =
  "Class Name,Level,Venue,Day,Start,End,Places,Teacher Email\n" +
  "E2E Seals,Dolphin 1,Mona Vale,Sunday,7:00am,7:30am,4,\n" +
  "E2E Ghost,Dolphin 9,Mona Vale,Sunday,7:30am,8:00am,4,\n";

const STUDENTS_CSV =
  "First name,Surname,DOB,Parent,Email,Mobile,Class\n" +
  "Nell,Seagrave,02/06/2019,Rob Seagrave,rob.seagrave@example.test,,E2E Seals\n" +
  "Otto,Seagrave,11/11/2020,Rob Seagrave,rob.seagrave@example.test,,E2E Seals\n" +
  "Pia,Seagrave,31/02/2020,Rob Seagrave,rob.seagrave@example.test,,E2E Seals\n";

const file = (name: string, text: string) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(text),
});

test.describe("moving a school in", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test("check the files, import them, see they match, and undo", async ({ page }) => {
    await signIn(page, USERS.aquaOwner.email);
    await page.goto("/business/settings");
    await page.getByRole("link", { name: /Move your school in/ }).click();
    await expect(page.getByRole("heading", { name: "Move your school in" })).toBeVisible();

    await page.getByLabel(/^Classes/).setInputFiles(file("classes.csv", CLASSES_CSV));
    await page.getByLabel(/^Students/).setInputFiles(file("students.csv", STUDENTS_CSV));
    await page.getByRole("button", { name: "Check the files" }).click();

    // Nothing is saved yet: this is what would happen.
    const check = page.getByRole("region", { name: "Importing these files will add:" });
    await expect(check).toContainText("1 class");
    await expect(check).toContainText("1 family");
    await expect(check).toContainText("2 children");
    await expect(check).toContainText("2 places in classes");
    const problems = check.getByRole("region", { name: "Rows that won't come across" });
    await expect(problems).toContainText(
      'Classes file, row 3: The level "Dolphin 9" isn\'t set up yet.',
    );
    await expect(problems).toContainText(
      'Students file, row 4: "31/02/2020" isn\'t a date of birth',
    );

    await page.getByRole("button", { name: "Import now" }).click();
    await expect(page.getByRole("heading", { name: "Import saved" })).toBeVisible();
    const children = page.getByRole("listitem").filter({ hasText: /^Children/ });
    await expect(children).toContainText("Added2");
    await expect(children).toContainText("In Ovyko now2");
    await expect(page.getByRole("region", { name: "Rows that didn't come across" })).toContainText(
      "Dolphin 9",
    );

    // The new class is on the timetable, with its two children in it.
    await page.goto("/business/classes");
    await expect(
      page.getByRole("link", { name: /^Sunday 7:00am Mona Vale 2 of 4 places filled/ }),
    ).toBeVisible();

    // Undo takes it all back.
    await page.goto("/business/settings/import");
    await page
      .getByRole("link", { name: /2 children and 1 class added/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Undo this import" }).click();
    await page.getByRole("button", { name: "Yes, remove everything it added" }).click();
    await expect(page.getByRole("heading", { name: "Import undone" })).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText("Undone");
    await page.goto("/business/classes");
    await expect(
      page.getByRole("link", { name: /^Sunday 7:00am Mona Vale 2 of 4 places filled/ }),
    ).toHaveCount(0);
  });
});
