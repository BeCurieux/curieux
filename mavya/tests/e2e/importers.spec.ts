import { expect, test } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M6h acceptance path: docs/M6_MIGRATION_PILOT.md. Another system's export,
// with a column matched by hand, balances and make-up credits. It imports
// and then undoes real rows, so it runs once, on the phone project.

const STUDENTS_CSV =
  "Student Name,Born,Primary Guardian Name,Primary Email,Primary Phone Number\n" +
  "Kit Harbour,03/04/2019,Lee Harbour,lee.harbour@example.test,\n" +
  "Ren Harbour,05/06/2020,Lee Harbour,lee.harbour@example.test,\n";

// This system writes money owed as a negative number.
const BALANCES_CSV = "Primary Email,Account Balance\nlee.harbour@example.test,-85.50\n";

const CREDITS_CSV =
  "Student Name,Makeups Available,Expiry Date\nKit Harbour,2,31/12/2099\nRen Harbour,1,01/01/2020\n";

const file = (name: string, text: string) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(text),
});

test.describe("moving in from another system", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test("match a column, bring balances and credits across, check the totals, undo", async ({
    page,
  }) => {
    await signIn(page, USERS.aquaOwner.email);
    await page.goto("/business/settings/import");

    async function chooseFiles() {
      await page.getByLabel("Students (CSV)").setInputFiles(file("students.csv", STUDENTS_CSV));
      const columns = page.getByRole("group", { name: "Columns read from the students file" });
      await expect(columns).toContainText("Full name ← “Student Name”");
      await expect(columns).toContainText("Parent email ← “Primary Email”");
      // "Born" isn't a name Ovyko knows: the owner says which column it is.
      await columns.getByLabel("Which column has the date of birth?").selectOption("Born");
      await page.getByLabel("Balances (CSV)").setInputFiles(file("balances.csv", BALANCES_CSV));
      await page
        .getByLabel("Make-up credits (CSV)")
        .setInputFiles(file("credits.csv", CREDITS_CSV));
    }

    await chooseFiles();
    await page.getByRole("button", { name: "Check the files" }).click();
    const check = page.getByRole("region", { name: "Importing these files will add:" });
    await expect(check).toContainText("2 children");
    // Read as written, the family looks in credit: the owner spots it.
    await expect(check.getByRole("region", { name: "Balances to check" })).toContainText(
      "1 family is in credit by $85.50 in all",
    );

    await chooseFiles();
    await page.getByLabel("My system shows money owed as a negative number").check();
    await page.getByRole("button", { name: "Check the files" }).click();
    await expect(check.getByRole("region", { name: "Balances to check" })).toContainText(
      "1 family owes $85.50 in all",
    );
    await expect(check).toContainText("1 family balance");
    await expect(check).toContainText("2 make-up credits");
    await expect(check.getByRole("region", { name: "Rows that won't come across" })).toContainText(
      "Make-up credits file, row 3: These credits expired on 1/1/2020",
    );

    await page.getByRole("button", { name: "Import now" }).click();
    await expect(page.getByRole("heading", { name: "Import saved" })).toBeVisible();
    const balances = page.getByRole("listitem").filter({ hasText: /^Family balancesAdded/ });
    await expect(balances).toContainText("Added1");
    const credits = page.getByRole("listitem").filter({ hasText: /^Make-up creditsAdded/ });
    await expect(credits).toContainText("In Ovyko now2");

    // Undo takes it all back.
    await page.getByRole("button", { name: "Undo this import" }).click();
    await page.getByRole("button", { name: "Yes, remove everything it added" }).click();
    await expect(page.getByRole("heading", { name: "Import undone" })).toBeVisible();
  });
});
