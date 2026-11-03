import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { grant } from "./course-fixtures";
import { service, signIn, uniqueEmail } from "./helpers";

// The worked example from the unit tests, typed in by hand: a A$40 product,
// A$8 from the supplier, 500 to an order → true cost A$14.96; with A$9
// shipping and A$300 fixed a month → A$16.04 a sale, 19 sales to break even.

async function fill(page: Page, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values))
    await page.getByLabel(label, { exact: true }).fill(value);
}

const output = (page: Page, key: string) =>
  page.getByTestId("result").locator(`[data-output="${key}"]`);

async function runLandedCost(page: Page) {
  await page.goto("/tools/landed-cost");
  await fill(page, {
    "Intended sale price": "40",
    "Unit cost": "8",
    "Units per order": "500",
    "Freight for the order": "1000",
    "Duty rate": "5",
    "Packaging per unit": "1.50",
    "Inbound misc for the order": "250",
  });
  await expect(output(page, "true_cost")).toHaveText("A$14.96");
  await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 10_000 });
}

async function runUnitEconomics(page: Page) {
  await page.goto("/tools/unit-economics");
  // Prefilled from Landed Cost.
  await expect(page.getByLabel("True cost per unit", { exact: true })).toHaveValue("14.96");
  await fill(page, {
    "Sale price": "40",
    "Shipping cost to you": "9",
    "Fixed monthly costs": "300",
    "Target monthly take-home": "1000",
  });
  await expect(page.getByTestId("result")).toContainText(
    "At this price you keep A$16.04 per sale. You need 19 sales a month before you earn anything.",
  );
  await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 10_000 });
}

test("free: Landed Cost and Unit Economics work, save, and come back; the rest are locked", async ({
  page,
}) => {
  await signIn(page, uniqueEmail("tools-free"));
  await page.goto("/tools");
  await expect(page.getByRole("link", { name: /Landed Cost/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Price Ladder.*Opens with Module 0/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /CAC Ceiling.*Opens with the full course/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await runLandedCost(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Back later: her last run is there, with its result.
  await page.reload();
  await expect(page.getByLabel("Unit cost", { exact: true })).toHaveValue("8");
  await expect(output(page, "true_cost")).toHaveText("A$14.96");
  await expect(page.getByTestId("save-status")).toContainText("Saved");

  await runUnitEconomics(page);

  // Bad input: says what's wrong and shows no result.
  await page.getByLabel("Sale price", { exact: true }).fill("forty");
  await expect(page.getByTestId("needs")).toContainText("Sale price needs a number");

  // Locked tools are locked on the server, not just in the list.
  await page.goto("/tools/price-ladder");
  await expect(page.getByTestId("tool-locked")).toContainText("It opens with Module 0.");
  await expect(page.getByLabel("Your true cost per unit")).toHaveCount(0);
  await page.goto("/verdict");
  await expect(page.getByTestId("verdict-locked")).toBeVisible();
});

test("module0: Price Ladder and Cash Cycle, then a saved Product Verdict", async ({ page }) => {
  const email = uniqueEmail("verdict");
  await signIn(page, email);
  await grant(email, ["module0"]);

  // No runs yet: the verdict asks for them first.
  await page.goto("/verdict");
  await expect(page.getByTestId("verdict-needs-runs")).toBeVisible();

  await runLandedCost(page);
  await runUnitEconomics(page);

  await page.goto("/tools/price-ladder");
  await expect(page.getByLabel("Your true cost per unit", { exact: true })).toHaveValue("14.96");
  await page.getByLabel("Price, comparable 1", { exact: true }).fill("30");
  for (const [n, price] of [
    [2, "45"],
    [3, "50"],
  ] as const) {
    await page.getByRole("button", { name: "Add a comparable" }).click();
    await page.getByLabel(`Price, comparable ${n}`, { exact: true }).fill(price);
  }
  await expect(page.getByTestId("result")).toContainText(
    "Price at the median, A$45.00: your margin is over 55% there.",
  );
  await expect(output(page, "verdict")).toHaveText("Green");
  await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 10_000 });

  await page.goto("/tools/cash-cycle");
  await fill(page, { "First order cost": "5000", "Lead time": "45", "Sell-through": "60" });
  await expect(output(page, "cash_tied_up")).toHaveText("A$5,000.00");
  await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 10_000 });

  await page.goto("/verdict");
  const pulled = page.getByTestId("verdict-inputs");
  await expect(pulled).toContainText("40.1%");
  await expect(pulled).toContainText("19");
  await expect(pulled).toContainText("A$45.00");
  await expect(pulled).toContainText("A$5,000.00");

  await page.getByLabel("Product").fill("Linen aprons");
  const answer = (question: string, option: "Yes" | "No") =>
    page.getByRole("group", { name: question }).getByLabel(option).check();
  await answer("Have you found a demand signal?", "Yes");
  await answer("Is the compliance check done?", "Yes");
  await answer("Does the cash you have cover the first order's cash need?", "Yes");
  // Margin 40.1% is amber; everything else passes.
  const live = page.getByTestId("live-verdict");
  await expect(live).toContainText("Amber");
  await expect(live).toContainText("Your margin is 40.1%: workable, but not over 55%.");
  await expect(live).toContainText("Get the margin over 55%");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Save this verdict" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Verdict saved. It's at the top of your verdicts below.",
  );
  const saved = page.getByTestId("saved-verdict").first();
  await expect(saved).toContainText("Linen aprons");
  await expect(saved).toContainText("Amber");
  // Module 0 can't send for review; that's the founding cohort's.
  await expect(saved.getByRole("button", { name: "Send for review" })).toHaveCount(0);

  // The CAC Ceiling is course-only.
  await page.goto("/tools/cac-ceiling");
  await expect(page.getByTestId("tool-locked")).toContainText("the full course");
});

test("founding: sends a verdict for review and sees its status, then the review", async ({
  page,
}) => {
  const email = uniqueEmail("founding");
  await signIn(page, email);
  await grant(email, ["founding"]);
  await runLandedCost(page);
  await runUnitEconomics(page);

  await page.goto("/verdict");
  await page.getByLabel("Product").fill("Soy candles");
  for (const q of [
    "Have you found a demand signal?",
    "Is the compliance check done?",
    "Does the cash you have cover the first order's cash need?",
  ])
    await page.getByRole("group", { name: q }).getByLabel("No").check();
  await expect(page.getByTestId("live-verdict")).toContainText("Red");
  await page.getByRole("button", { name: "Save this verdict" }).click();
  const saved = page.getByTestId("saved-verdict").first();
  await saved.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByTestId("review-status")).toContainText("Sent for review on");

  // The founder writes the review (the admin page arrives in step 8).
  const { error } = await service
    .from("verdicts")
    .update({ review_md: "Fix the compliance check first.", reviewed_at: new Date().toISOString() })
    .eq("product_name", "Soy candles")
    .not("submitted_at", "is", null);
  expect(error).toBeNull();
  await page.reload();
  await expect(page.getByTestId("saved-verdict").first()).toContainText(
    "Fix the compliance check first.",
  );
});

test("outside Australia, money is in US dollars", async ({ page }) => {
  const email = uniqueEmail("usd");
  await signIn(page, email);
  await service.from("profiles").update({ country: "US" }).eq("email", email);
  await page.goto("/tools/landed-cost");
  await fill(page, {
    "Intended sale price": "40",
    "Unit cost": "8",
    "Units per order": "500",
    "Freight for the order": "1000",
  });
  // landed 8 + 2 + 0 duty; fees 1.46; returns 1.00 → 12.46
  await expect(output(page, "true_cost")).toHaveText("US$12.46");
  await expect(page.getByText("US$", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 10_000 });
  const { data: profile } = await service
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .single();
  const { data: runs } = await service
    .from("calc_runs")
    .select("currency")
    .eq("user_id", profile!.user_id);
  expect(runs?.map((r) => r.currency)).toEqual(["USD"]);
});

test("signed out, tools and the verdict send her to sign in", async ({ request }) => {
  for (const path of ["/tools", "/tools/landed-cost", "/verdict"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers()["location"]).toContain("/login");
  }
});

test("course: the other eight open, and compute in the same pattern", async ({ page }) => {
  const email = uniqueEmail("course-tools");
  await signIn(page, email);
  await grant(email, ["course"]);
  for (const slug of [
    "cash-cycle",
    "cac-ceiling",
    "offer-margin",
    "aov-lever",
    "shipping-rate",
    "reorder-point",
    "ninety-day-cash",
    "scorecard",
  ]) {
    await page.goto(`/tools/${slug}`);
    await expect(page.getByTestId("tool-locked"), slug).toHaveCount(0);
    await expect(page.getByRole("form"), slug).toBeVisible();
  }

  await page.goto("/tools/reorder-point");
  await fill(page, { "Units sold per day": "3.5", "Lead time": "30" });
  await expect(page.getByTestId("result")).toContainText(
    "Reorder when you're down to 154 units, and order 210.",
  );

  await page.goto("/tools/shipping-rate");
  await fill(page, {
    "Packaging per parcel": "1",
    "Zone, zone 1": "Metro",
    "Weight (kg), zone 1": "0.5",
    "Carrier rate, zone 1": "9",
  });
  await expect(page.getByRole("table")).toContainText("A$10.30");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
