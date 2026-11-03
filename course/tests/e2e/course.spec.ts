import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  createCourseFixtures,
  FIXTURE,
  grant,
  removeCourseFixtures,
  type Fixture,
} from "./course-fixtures";
import { signIn, uniqueEmail } from "./helpers";

let fixture: Fixture;
test.beforeAll(async () => {
  fixture = await createCourseFixtures();
});
test.afterAll(removeCourseFixtures);

test("free: the two free lessons open, the rest say what unlocks them", async ({ page }) => {
  await signIn(page, uniqueEmail("free"));
  await expect(page).toHaveURL(/\/learn$/);

  const zero = page.getByTestId("module-module-0");
  await expect(zero.getByRole("link", { name: /0\.1 Lesson 0\.1/ })).toBeVisible();
  await expect(zero.getByRole("link", { name: /0\.2 Lesson 0\.2/ })).toBeVisible();
  await expect(zero).toContainText("0 of 2 done");

  const locked = page.getByTestId("module-e2e-module");
  await expect(locked).toContainText("Opens with Module 0.");
  await expect(locked.getByRole("link", { name: /90\.1.*Opens with Module 0/ })).toBeVisible();
  await expect(
    locked.getByRole("link", { name: /90\.2.*Opens with the full course/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);

  // Start here → lesson 0.1, which has no video, so the script shows as is.
  await page.getByRole("link", { name: /Start here/ }).click();
  await expect(page).toHaveURL(/\/learn\/module-0\/lesson-0-1$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lesson 0.1 (placeholder)");
  await expect(page.getByTestId("script")).toContainText("This is a placeholder for lesson 0.1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Mark done → the next-lesson prompt; /learn counts it and moves Continue on.
  await page.getByRole("button", { name: "Mark lesson done" }).click();
  await expect(page.getByRole("status")).toHaveText("✓ Lesson done");
  await expect(page.getByTestId("next-prompt")).toContainText("0.2 Lesson 0.2 (placeholder)");
  await page.goto("/learn");
  await expect(page.getByTestId("module-module-0")).toContainText("1 of 2 done");
  await expect(page.getByRole("link", { name: /Continue/ })).toContainText("0.2");

  // Undo.
  await page.goto("/learn/module-0/lesson-0-1");
  await page.getByRole("button", { name: "Mark as not done" }).click();
  await expect(page.getByRole("button", { name: "Mark lesson done" })).toBeVisible();

  // 0.2 → next is the first lesson of the next module, even though it's locked.
  await page.goto("/learn/module-0/lesson-0-2");
  await expect(page.getByRole("navigation", { name: "Lessons" })).toContainText(
    "90.1 A Module 0 lesson",
  );
});

test("free: a locked lesson shows neither its video nor its script, and its files stay shut", async ({
  page,
}) => {
  await signIn(page, uniqueEmail("locked"));
  await page.goto("/learn/e2e-module/m0-lesson");
  await expect(page.getByTestId("lesson-locked")).toContainText("It opens with Module 0.");
  const html = await page.content();
  expect(html).not.toContain(FIXTURE.videoId);
  expect(html).not.toContain(FIXTURE.lockedScript);
  await expect(page.getByRole("button", { name: "Mark lesson done" })).toHaveCount(0);

  const download = await page.request.get(`/api/assets/${fixture.courseAsset}`, {
    maxRedirects: 0,
  });
  expect(download.status()).toBe(403);
  const library = await page.request.get(`/api/assets/${fixture.libraryAsset}`, {
    maxRedirects: 0,
  });
  expect(library.status()).toBe(403);
});

test("module0 with the benchmark pack: video, read-instead script, library download", async ({
  page,
}) => {
  const email = uniqueEmail("buyer");
  await signIn(page, email);
  await grant(email, ["module0", "benchmark_pack"]);

  await page.goto("/learn/e2e-module/m0-lesson");
  await expect(page.getByText("Worked example · 5 min")).toBeVisible();
  const video = page.locator(
    `iframe[src="https://www.youtube-nocookie.com/embed/${FIXTURE.videoId}?rel=0"]`,
  );
  await expect(video).toHaveAttribute("title", "Video: A Module 0 lesson");

  // With a video, the script sits behind "Read instead".
  await expect(page.getByText(FIXTURE.lockedScript)).toBeHidden();
  await page.getByText("Read instead").click();
  await expect(page.getByText(FIXTURE.lockedScript)).toBeVisible();

  // The course lesson is still locked, and so is its download.
  await page.goto("/learn/e2e-module/course-lesson");
  await expect(page.getByTestId("lesson-locked")).toContainText("the full course");
  expect(await page.content()).not.toContain(FIXTURE.courseScript);
  expect(
    (await page.request.get(`/api/assets/${fixture.courseAsset}`, { maxRedirects: 0 })).status(),
  ).toBe(403);

  // The library's benchmark lesson opens with the pack, and so does its file.
  await page.goto("/learn/e2e-library/benchmarks");
  await expect(page.getByRole("link", { name: "Benchmark sheet" })).toBeVisible();
  const redirect = await page.request.get(`/api/assets/${fixture.libraryAsset}`, {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers()["cache-control"]).toContain("no-store");
  const signed = redirect.headers()["location"]!;
  expect(signed).toContain("/storage/v1/object/sign/lesson-assets/");
  const file = await page.request.get(signed);
  expect(await file.text()).toBe(FIXTURE.file.body);

  // Mark-complete on a lesson she can open; the database refuses the rest.
  await page.goto("/learn/e2e-module/m0-lesson");
  await page.getByRole("button", { name: "Mark lesson done" }).click();
  await expect(page.getByTestId("next-prompt")).toContainText("90.2 A course lesson");
});

test("signed out: lessons and downloads send her to sign in", async ({ request }) => {
  const lesson = await request.get("/learn/module-0/lesson-0-1", { maxRedirects: 0 });
  expect(lesson.status()).toBe(307);
  expect(lesson.headers()["location"]).toContain("/login?next=%2Flearn%2Fmodule-0%2Flesson-0-1");
  const download = await request.get(`/api/assets/${fixture.libraryAsset}`, { maxRedirects: 0 });
  expect(download.status()).toBe(307);
  expect(download.headers()["location"]).toContain("/login");
});

test("an unknown lesson is a 404", async ({ page }) => {
  await signIn(page, uniqueEmail("missing"));
  const response = await page.goto("/learn/module-0/no-such-lesson");
  expect(response?.status()).toBe(404);
});
