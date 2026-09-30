import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { signIn } from "./helpers";

// M2 acceptance (business path): docs/M2_CLASSES.md. Uses fresh names each
// run so it passes on a database earlier runs have written to.

test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });

async function noSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) => v.nodes.map((n) => `${page.url()}: ${v.id} ${n.target.join(" ")}`));
  expect(serious).toEqual([]);
}

test("set up a class, add a family, enrol, fill, un-enrol, and see it all in Activity", async ({
  page,
}, testInfo) => {
  const tag = randomUUID().slice(0, 6);
  // Each project teaches at its own time: Mia can't be in two classes at
  // once (M5's clash check).
  const [time, shown] =
    testInfo.project.name === "phone" ? ["07:30", "7:30am"] : ["15:30", "3:30pm"];
  await signIn(page, USERS.aquaOwner.email);

  // 1. Location, program and level.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: /Locations/ }).click();
  await page.getByRole("link", { name: "Add location" }).click();
  await page.getByLabel("Name").fill(`Pool ${tag}`);
  await page.getByLabel(/Suburb/).fill("Newport");
  await noSeriousViolations(page);
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`Pool ${tag}`) })).toBeVisible();

  await page.goto("/business/settings/programs");
  await page.getByLabel("New program").fill(`Squad ${tag}`);
  await page.getByRole("button", { name: "Add program" }).click();
  await expect(page.getByRole("heading", { name: `Squad ${tag}` })).toBeVisible();
  const squad = page.locator("section", {
    has: page.getByRole("heading", { name: `Squad ${tag}` }),
  });
  await squad.getByLabel("New level").fill("Bronze");
  await squad.getByRole("button", { name: /Add level/ }).click();
  await expect(squad.getByRole("listitem").filter({ hasText: "Bronze" })).toBeVisible();
  await noSeriousViolations(page);

  // 2. A class with capacity 1, which schedules 12 lessons.
  await page.goto("/business/classes/new");
  await page.getByLabel("Class name").fill(`Bronze ${tag}`);
  await page.getByLabel("Level").selectOption({ label: "Bronze" });
  await page.getByLabel("Location").selectOption({ label: `Pool ${tag}` });
  await page.getByLabel(/Instructor/).selectOption({ label: "Mia Chen" });
  await page.getByLabel("Day").selectOption({ label: "Friday" });
  await page.getByLabel("Start time").fill(time);
  await page.getByLabel("Places").fill("1");
  await noSeriousViolations(page);
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByRole("heading", { name: `Bronze ${tag}`, level: 1 })).toBeVisible();
  await expect(page.getByText(`Friday ${shown}`, { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upcoming lessons" }).locator("..").getByRole("listitem"),
  ).toHaveCount(12);
  const classUrl = page.url();

  // 3. A family and a child.
  await page.goto("/business/families/new");
  await page.getByLabel("Family name").fill(`Tester ${tag} Family`);
  await page.getByLabel(/^Name/).fill("Alex Tester");
  await page.getByLabel(/Email/).fill(`alex.${tag}@family.test`);
  await page.getByRole("button", { name: "Add family" }).click();
  await expect(page.getByRole("heading", { name: `Tester ${tag} Family` })).toBeVisible();
  await expect(page.getByText("Alex Tester")).toBeVisible();
  await page.getByRole("link", { name: "Add child" }).click();
  await page.getByLabel("First name").fill(`Robin${tag}`);
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Date of birth").fill("2019-02-03");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(page.getByText(`Robin${tag} Tester`)).toBeVisible();
  await expect(page.getByText("Not enrolled")).toBeVisible();
  await noSeriousViolations(page);

  // 4. Enrol; the roster and count update.
  await page.goto(classUrl);
  await page
    .getByRole("combobox", { name: "Enrol a child" })
    .selectOption({ label: `Robin${tag} Tester · Tester ${tag} Family` });
  await page.getByRole("button", { name: "Enrol" }).click();
  await expect(page.getByRole("heading", { name: "Roster" }).locator("..")).toContainText(
    `Robin${tag} Tester`,
  );
  await expect(page.getByText("Enrolled").locator("..")).toContainText("1 / 1");
  await noSeriousViolations(page);

  // 5. The class is now full.
  await expect(page.getByText("This class is full.")).toBeVisible();

  // 6. Un-enrol; the roster empties and places reopen.
  await page.getByRole("button", { name: `Remove Robin${tag} Tester from Bronze ${tag}` }).click();
  await expect(page.getByText("No one enrolled yet.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Enrol a child" })).toBeVisible();

  // 7. Activity lists each change and who made it.
  await page.goto("/business/settings/activity");
  const log = page.getByRole("list").filter({ hasText: "Sarah Morgan" }).first();
  for (const line of [
    `Added location “Pool ${tag}”`,
    `Added program “Squad ${tag}”`,
    "Added level “Bronze”",
    `Added class “Bronze ${tag}”`,
    `Added family “Tester ${tag} Family”`,
    `Added child “Robin${tag} Tester”`,
    "Enrolled a child",
    "Ended an enrolment",
  ]) {
    await expect(log.getByText(line).first()).toBeVisible();
  }
  await noSeriousViolations(page);
});

test("the database refuses a second child in a full class", async ({ page }) => {
  // Two browser tabs race for the last place; the loser sees a clear message.
  const tag = randomUUID().slice(0, 6);
  await signIn(page, USERS.aquaOwner.email);
  await page.goto("/business/classes/new");
  await page.getByLabel("Class name").fill(`Tiny ${tag}`);
  await page.getByLabel("Level").selectOption({ label: "Dolphin 2" });
  await page.getByLabel("Location").selectOption({ label: "Mona Vale" });
  await page.getByLabel("Day").selectOption({ label: "Sunday" });
  await page.getByLabel("Start time").fill("08:00");
  await page.getByLabel("Places").fill("1");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByRole("heading", { name: `Tiny ${tag}`, level: 1 })).toBeVisible();

  const other = await page.context().newPage();
  await other.goto(page.url());
  await page.getByRole("combobox", { name: "Enrol a child" }).selectOption({ index: 1 });
  await other.getByRole("combobox", { name: "Enrol a child" }).selectOption({ index: 2 });
  await page.getByRole("button", { name: "Enrol" }).click();
  await expect(page.getByText("This class is full.")).toBeVisible();
  // The second tab still shows its form from before the class filled.
  await other.getByRole("button", { name: "Enrol" }).click();
  await expect(other.getByRole("alert").filter({ hasText: "This class is full." })).toBeVisible();
});

test("instructors see their classes and real rosters, and can't reach business pages", async ({
  page,
}) => {
  await signIn(page, USERS.aquaInstructor.email);
  await expect(page.getByRole("link", { name: "Dolphin 1, Tuesday 5:30pm" })).toBeVisible();
  await page.getByRole("link", { name: "Dolphin 3, Thursday 4:30pm" }).click();
  // Since M3 the roster sits under the current lesson's attendance count.
  await expect(page.getByText(/of 12 marked/)).toBeVisible();
  await page.goto("/business/families");
  await expect(page).toHaveURL(/\/instructor$/);
});

test("parents see their children's real classes on Home, Calendar and Kids", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, USERS.burrowsParent.email);
  // The first link to Leo is his class pass; his progress card follows.
  await expect(page.locator('a[href="/family/kids/leo"]').first()).toContainText(
    "Tuesday · 5:30pm",
  );
  await page.goto("/family/calendar");
  // The calendar is the next seven days, so a weekly lesson that finished
  // earlier today isn't on it until next week.
  const leo = page.getByRole("link", { name: /Leo · Swimming · Dolphin 1/ });
  const ava = page.getByRole("link", { name: /Ava · Swimming · Dolphin 3/ });
  await expect(leo.or(ava).first()).toBeVisible();
  await expect(leo).toHaveCount(finishedToday("Tue", "18:00") ? 0 : 1);
  await expect(ava).toHaveCount(finishedToday("Wed", "17:00") ? 0 : 1);
  await page.goto("/family/kids");
  await expect(page.getByText("Dolphin 1 · Tuesdays 5:30pm")).toBeVisible();
});

// Whether it's that weekday in Sydney and the lesson ending at `end` is over.
function finishedToday(weekday: string, end: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return get("weekday") === weekday && `${get("hour")}:${get("minute")}` >= end;
}
