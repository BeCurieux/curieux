import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The first deployable slice, end to end, on the local backend with the
// offline generator: create account → brand details → Sidekick prompt pack
// → edit → copy → save. Plus the paid path, customer isolation and
// accessibility. Every test signs up a fresh email, so tests don't share data.

const unique = (name: string) =>
  `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;

async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page
    .getByRole("link", { name: /Start free/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/studio/);
}

async function onboard(page: Page, brand = "Juniper & Thread") {
  await expect(page).toHaveURL(/\/studio\/new/);
  await page.getByLabel("Brand name").fill(brand);
  await page.getByLabel("What kind of business is it?").selectOption("Home and living");
  await page.getByLabel("What do you sell?").fill("Linen aprons and kitchen textiles");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Who is your customer?").fill("New mums who want a calm, practical home.");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Brand personality").fill("warm, witty, calm");
  await page.getByLabel("Colours you love").fill("sage, cream, #632B39");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Country you sell in").fill("Australia");
  await page.getByLabel("Currency").fill("AUD");
  await page.getByLabel("Facts you can stand behind").fill("100% European flax linen");
  await page.getByRole("button", { name: "Save and build my blueprint" }).click();
  await expect(page).toHaveURL(/\/studio\/[^/]+\/brand\?welcome=1/);
}

test("create account → brand details → Sidekick prompts → edit → copy → save", async ({ page }) => {
  await signUp(page, unique("ava"));
  await onboard(page);

  // Brand Blueprint (free preview).
  await page.getByRole("button", { name: "Generate brand blueprint" }).click();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Positioning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Typography" })).toBeVisible();
  await expect(page.getByText("Part of the Launch Pack").first()).toBeVisible();

  // Shopify Theme Studio → Sidekick prompt pack.
  await page.getByRole("link", { name: "Store design" }).click();
  await page.getByRole("link", { name: /Sidekick prompt pack/ }).click();
  await expect(page.getByText("Instructions for a tool")).toBeVisible();
  await page.getByRole("button", { name: "Generate sidekick prompt pack" }).click();
  await expect(page.getByRole("heading", { name: "Global design settings" })).toBeVisible();

  const prompt = page.getByLabel("Prompt", { exact: true }).first();
  await expect(prompt).toContainText("Juniper & Thread");
  await expect(prompt).toContainText("#632B39");
  await expect(page.getByText(/Duplicate your live theme first/)).toBeVisible();

  // Edit.
  await prompt.fill(`${await prompt.inputValue()} Keep the header logo centred.`);
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  // Copy.
  await page.getByRole("button", { name: "Copy prompt" }).first().click();
  await expect(page.getByRole("button", { name: "Copied ✓" }).first()).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("Keep the header logo centred.");

  // Save.
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved as version 2.")).toBeVisible();

  // It persists, with history, and an old version can be restored.
  await page.reload();
  await expect(page.getByLabel("Prompt", { exact: true }).first()).toContainText(
    "Keep the header logo centred.",
  );
  await page.getByText(/Version history \(2\)/).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored version 1 as version 3.")).toBeVisible();
  await expect(page.getByLabel("Prompt", { exact: true }).first()).not.toContainText(
    "Keep the header logo centred.",
  );
});

test("the Launch Pack: product writer flags gaps, marketing generates, the pack exports", async ({
  page,
}) => {
  await signUp(page, unique("bea"));
  await onboard(page, "Bea Prints");

  await page.goto("/account");
  await page.getByRole("button", { name: "Local only: give me a Launch Pack" }).click();
  await expect(page.getByRole("heading", { name: "Shopify Launch Pack" })).toBeVisible();

  await page.getByRole("link", { name: "Empire Studio" }).first().click();
  await page.getByRole("link", { name: "Products" }).click();
  await page.getByLabel("Product name").fill("The Everyday Apron");
  await page
    .getByLabel("Materials, ingredients or what's included")
    .fill("100% European flax linen");
  await page.getByLabel("Price").fill("89");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Product saved.")).toBeVisible();

  await page.getByRole("link", { name: /Product listing/ }).click();
  await page.getByRole("button", { name: "Generate product listing" }).click();
  await expect(page.getByRole("heading", { name: "Missing information" })).toBeVisible();
  await expect(page.getByText(/Size or dimensions/).first()).toBeVisible();

  await page.getByRole("link", { name: "Marketing" }).click();
  await page.getByRole("link", { name: /Launch emails/ }).click();
  await page.getByRole("button", { name: "Generate launch emails" }).click();
  await expect(page.getByRole("heading", { name: "Launch emails" })).toBeVisible();

  await page.getByRole("link", { name: "Saved assets" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download ZIP" }).click();
  expect((await download).suggestedFilename()).toBe("bea-prints-launch-pack.zip");
});

test("one customer can't open another's studio", async ({ browser }) => {
  const ava = await browser.newPage();
  await signUp(ava, unique("owner"));
  await onboard(ava, "Private Shop");
  const url = new URL(ava.url());
  const profilePath = url.pathname.replace(/\/brand$/, "");

  const bea = await browser.newPage();
  await signUp(bea, unique("other"));
  // Next streams the page, so a not-found inside a layout can arrive with
  // status 200; what matters is that she sees the 404 page and none of the data.
  await bea.goto(profilePath);
  await expect(bea.getByRole("heading", { name: "That page isn't here." })).toBeVisible();
  await expect(bea.getByText("Private Shop")).toHaveCount(0);
  await bea.goto(`${profilePath}/m/theme_prompts`);
  await expect(bea.getByRole("heading", { name: "That page isn't here." })).toBeVisible();
  await expect(bea.getByText("Private Shop")).toHaveCount(0);
  const zip = await bea.request.get(`/api/export/${profilePath.split("/").pop()}`);
  expect(zip.status()).toBe(404);
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/sign-in/);
});

for (const path of ["/", "/pricing", "/sign-in"]) {
  test(`no serious accessibility issues on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

test("no serious accessibility issues in the studio", async ({ page }) => {
  await signUp(page, unique("axe"));
  await onboard(page, "Axe Studio");
  await page.getByRole("button", { name: "Generate brand blueprint" }).click();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  for (const results of [await new AxeBuilder({ page }).analyze()]) {
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 3)
            .join(", ")}`,
      ),
    ).toEqual([]);
  }
});
