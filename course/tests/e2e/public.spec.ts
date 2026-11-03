import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { magicLinkFor, service, uniqueEmail } from "./helpers";

// The public pages (build step 6): no sign-in to view, mobile-first, prices
// from the database in the visitor's currency, lead capture that records
// leads.source, and the Hype Check.

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}

async function leadOf(email: string) {
  const { data } = await service
    .from("leads")
    .select("source, interests, converted_user_id")
    .eq("email", email)
    .maybeSingle();
  return data;
}

test("home: the sales page with both calls to action, prices from the database", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const body = page.getByTestId("page-body");
  await expect(body).toContainText("Module 0 (A$49)");
  await expect(body).toContainText("A$250, or A$201 if you already have Module 0");
  await expect(body).toContainText("A$349, 30 places left");
  await expect(body).toContainText("within 14 days");
  await expect(body).not.toContainText("{{");
  await expect(
    page.getByRole("link", { name: "Start the free Product Check" }).first(),
  ).toHaveAttribute("href", "/check");
  await expect(page.getByRole("link", { name: "See the prices" }).first()).toHaveAttribute(
    "href",
    "/pricing",
  );
  await expect(page.getByTestId("draft-notice")).toBeVisible();
  await noSideScroll(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("outside Australia the prices are in US dollars", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-vercel-ip-country": "US" });
  await page.goto("/");
  await expect(page.getByTestId("page-body")).toContainText("Module 0 (US$34)");
  await page.goto("/pricing");
  await expect(page.getByTestId("tier-course")).toContainText("US$175");
  await expect(page.getByTestId("tier-course")).toContainText(
    "US$141 if you already have Module 0",
  );
  await expect(page.getByText("Prices in US dollars.")).toBeVisible();
});

test("pricing: three tiers side by side, buy buttons through sign-in to checkout, waitlist when founding is full", async ({
  page,
}) => {
  await page.goto("/pricing");
  for (const [slug, price] of [
    ["module-0", "A$49"],
    ["course", "A$250"],
    ["founding", "A$349"],
  ] as const)
    await expect(page.getByTestId(`tier-${slug}`)).toContainText(price);
  await expect(page.getByTestId("tier-founding")).toContainText("30 of 30 places left");
  await expect(page.getByText(/benchmark pack is A\$29 on its own/)).toBeVisible();
  await noSideScroll(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByTestId("tier-module-0").getByRole("link", { name: "Buy Module 0" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout%2Fmodule-0$/);

  await service.from("products").update({ places_sold: 30 }).eq("tier", "founding");
  try {
    await page.goto("/pricing");
    const founding = page.getByTestId("tier-founding");
    await expect(founding).toContainText("All places taken");
    await expect(founding.getByRole("link", { name: "Join the waitlist" })).toHaveAttribute(
      "href",
      "/waitlist",
    );
  } finally {
    await service.from("products").update({ places_sold: 0 }).eq("tier", "founding");
  }
});

test("/check: email first, then the magic link opens the free lessons", async ({ page }) => {
  const email = uniqueEmail("check");
  await page.goto("/check");
  await noSideScroll(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me the free check" }).click();
  await expect(page.getByTestId("lead-done")).toContainText("Check your email");
  // Supabase creates the account when it sends the link, so the lead is linked at once.
  expect(await leadOf(email)).toMatchObject({ source: "product_check" });

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByTestId("module-module-0")).toContainText("0 of 2 done");
  expect((await leadOf(email))?.converted_user_id).not.toBeNull();
});

test("a ManyChat link records the lead as a keyword lead", async ({ page }) => {
  const email = uniqueEmail("keyword");
  await page.goto("/check?utm_source=manychat&utm_campaign=CHECK");
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me the free check" }).click();
  await expect(page.getByTestId("lead-done")).toBeVisible();
  expect((await leadOf(email))?.source).toBe("keyword");
});

test("a bad email is explained, and a bot filling the hidden field records nothing", async ({
  page,
}) => {
  await page.goto("/check");
  await page.getByLabel("Your email").fill("nope");
  await page.getByRole("button", { name: "Send me the free check" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That doesn't look like an email address.",
  );

  const email = uniqueEmail("bot");
  await page
    .locator('input[name="website"]')
    .evaluate((el: HTMLInputElement) => (el.value = "spam.example"));
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me the free check" }).click();
  await expect(page.getByTestId("lead-done")).toBeVisible();
  expect(await leadOf(email)).toBeNull();
});

test("/hype: a score, what it leans on, what it leaves out, copy to share, an anonymised log", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/hype");
  await noSideScroll(page);
  const marker = `marker${Date.now()}`;
  await page
    .getByLabel("The post")
    .fill(
      `I made $10k a month in 90 days, totally passive! Anyone can. DM @${marker} or email ${marker}@example.com. Only 3 spots left.`,
    );
  await page.getByRole("button", { name: "Check it" }).click();
  const result = page.getByTestId("hype-result");
  // money with a timeframe 25 + passive 15 + anyone can 15 + urgency 10 + no costs 10 + no hours 10
  await expect(page.getByTestId("hype-score")).toHaveText("85");
  await expect(result).toContainText("Heavy hype");
  await expect(result).toContainText("A dollar amount with a timeframe");
  await expect(page.getByTestId("leaves-out").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("leaves-out")).toContainText("What it cost");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await result.getByRole("button", { name: "Copy to share" }).click();
  await expect(result.getByRole("button", { name: "Copied" })).toBeVisible();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toMatch(
    /^My post scored 85\/100 on the Hype Check \(heavy hype\)\. It leaves out: what it cost/,
  );
  expect(shared).toContain("/hype");

  // Logged for tuning, with the handle and email stripped.
  const { data: logged } = await service
    .from("hype_checks")
    .select("text_redacted, score, rubric_version")
    .ilike("text_redacted", "%I made $10k a month in 90 days%")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  expect(logged!.score).toBe(85);
  expect(logged!.text_redacted).not.toContain(marker);
  expect(logged!.text_redacted).toContain("DM [handle] or email [email]");

  // Optional email: a hype_check lead.
  const email = uniqueEmail("hype");
  await result.getByLabel("Your email").fill(email);
  await result.getByRole("button", { name: "Send me the free check" }).click();
  await expect(result.getByTestId("lead-done")).toContainText("Check your email");
  expect((await leadOf(email))?.source).toBe("hype_check");
});

test("/hype: a grounded post scores low; too short is explained", async ({ page }) => {
  await page.goto("/hype");
  await page.getByLabel("The post").fill("Too short");
  await page.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Paste a little more");
  await page
    .getByLabel("The post")
    .fill(
      "Our candles cost $6 each in stock and fees. It took 2 years of weekends to get to 40 orders a month, and most people take longer.",
    );
  await page.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByTestId("hype-score")).toHaveText("0");
  await expect(page.getByTestId("hype-result")).toContainText("Mostly grounded");
});

test("/waitlist: choose founding or new modules; joining twice merges", async ({ page }) => {
  const email = uniqueEmail("waitlist");
  await page.goto("/waitlist?utm_source=newsletter");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Choose what you'd like to hear about.",
  );
  // The error didn't clear what she typed.
  await expect(page.getByLabel("Your email")).toHaveValue(email);
  await page.getByLabel("Founding cohort places").check();
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByTestId("lead-done")).toContainText("You're on the list");
  await page.goto("/waitlist");
  await page.getByLabel("New modules").check();
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByTestId("lead-done")).toBeVisible();
  expect(await leadOf(email)).toMatchObject({
    source: "waitlist",
    interests: ["founding", "future_modules"],
  });
});

test("legal pages, from the footer; the refunds page is one paragraph", async ({ page }) => {
  await page.goto("/");
  for (const [name, heading] of [
    ["Terms", "Terms"],
    ["Privacy", "Privacy"],
    ["Refunds", "Refunds"],
  ] as const) {
    await page.getByRole("contentinfo").getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await noSideScroll(page);
  }
  await expect(page.locator("main p")).toHaveCount(1);
  await expect(page.locator("main")).toContainText("within 14 days of buying it, no reason needed");
  expect((await page.request.get("/legal/nope")).status()).toBe(404);
});
