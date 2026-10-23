import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The free Ads Profitability Calculator: open to signed-out visitors, works
// in the browser, explains its limits and leads to the next step.

test.beforeEach(async ({ page }) => {
  await page.goto("/ads/tools/calculator");
  await page.getByRole("button", { name: "No thanks" }).click();
});

test("works signed out, starting from Module 1's example", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Ads Profitability Calculator" })).toBeVisible();
  const results = page.getByRole("region", { name: "Results" });
  await expect(results.getByText("A$41.83").first()).toBeVisible();
  await expect(results.getByText("−A$36.34", { exact: true })).toBeVisible();
  await expect(results.getByText("Not enough evidence yet, either way")).toBeVisible();
});

test("recalculates as you type and names a bad field", async ({ page }) => {
  await page.getByLabel(/^Price/).fill("99");
  // 99 × 0.97 − (9.90 + 0.80) = 85.33
  await expect(
    page.getByRole("region", { name: "Results" }).getByText("A$85.33").first(),
  ).toBeVisible();
  await page.getByLabel(/^Orders refunded/).fill("150");
  await expect(page.getByText("Enter a percentage from 0 to 100.")).toBeVisible();
  await expect(page.getByText("Check the highlighted fields")).toBeVisible();
  await page.getByLabel(/^Orders refunded/).fill("3");
  await expect(page.getByText("Check the highlighted fields")).toBeHidden();
});

test("downloads a CSV of the scenario", async ({ page }) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download as CSV" }).click();
  expect((await download).suggestedFilename()).toBe("ads-profitability.csv");
});

test("leads to the free Fit Check, the FIT Finder and the Income Fit Test", async ({ page }) => {
  await expect(page.getByRole("link", { name: /Get the Fit Check/ })).toHaveAttribute(
    "href",
    "https://herlittleempireco.gumroad.com/l/fit-check",
  );
  await expect(page.getByRole("link", { name: "Take the FIT Finder" })).toHaveAttribute(
    "href",
    "/studio/fit",
  );
  await expect(page.getByRole("link", { name: /See the Income Fit Test/ })).toHaveAttribute(
    "href",
    "https://herlittleempireco.gumroad.com/l/income-fit-test",
  );
});

test("sends nothing typed into the calculator", async ({ page }) => {
  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") bodies.push(r.postData() ?? "");
  });
  await page.getByLabel(/^Price/).fill("123.45");
  await page.getByLabel(/^Ad spend/).fill("678.9");
  await page.waitForTimeout(300);
  expect(bodies.join("\n")).not.toMatch(/123\.45|678\.9/);
});

test("no serious accessibility issues on the calculator", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
});

test("the privacy notice names who handles data and where", async ({ page }) => {
  await page.goto("/privacy");
  for (const name of ["Supabase", "Vercel", "Anthropic", "Gumroad"])
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/outside Australia, mainly in the United States/)).toBeVisible();
  await expect(page.getByText(/aren.t sent to us or saved/)).toBeVisible();
});
