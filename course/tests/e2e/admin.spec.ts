import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { emailsTo } from "./fake-resend";
import { FAKE_STRIPE_BASE } from "./fake-stripe";
import { service, signIn, uniqueEmail } from "./helpers";

// /admin (build step 8): gated by the admins table on the server; five tabs;
// the refund button and the review textarea do real work.

async function asAdmin(page: Page) {
  const email = uniqueEmail("admin-user");
  await signIn(page, email);
  const { data } = await service.from("profiles").select("user_id").eq("email", email).single();
  await service.from("admins").insert({ user_id: data!.user_id });
  return email;
}

async function customer(browser: Browser, label: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const email = uniqueEmail(label);
  await signIn(page, email);
  return { page, email, close: () => context.close() };
}

async function buy(page: Page, slug: string) {
  await page.goto(`/checkout/${slug}`);
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await expect(page).toHaveURL(new RegExp(`^${FAKE_STRIPE_BASE}/pay/`));
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page.getByTestId("purchase-confirmed")).toBeVisible();
}

test.afterEach(async () => {
  await service.from("products").update({ places_sold: 0 }).eq("tier", "founding");
});

test("only admins: everyone else gets a 404, signed-out visitors sign in", async ({
  page,
  request,
}) => {
  const signedOut = await request.get("/admin", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect(signedOut.headers()["location"]).toContain("/login?next=%2Fadmin");
  const csvSignedOut = await request.get("/admin/leads.csv", { maxRedirects: 0 });
  expect(csvSignedOut.status()).toBe(307);
  expect(csvSignedOut.headers()["location"]).toContain("/login");

  await signIn(page, uniqueEmail("not-admin"));
  expect((await page.goto("/admin"))?.status()).toBe(404);
  expect((await page.request.get("/admin/leads.csv")).status()).toBe(404);
  await page.goto("/learn");
  await expect(
    page.getByRole("navigation", { name: "Course" }).getByRole("link", { name: "Admin" }),
  ).toHaveCount(0);
});

test("every tab loads and is accessible", async ({ page }) => {
  await asAdmin(page);
  await page.goto("/learn");
  await page
    .getByRole("navigation", { name: "Course" })
    .getByRole("link", { name: "Admin" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
  for (const [tab, heading] of [
    ["Buyers", "Buyers"],
    ["Leads", "Leads"],
    ["Cohort", "Founding cohort"],
    ["Verdicts", "Verdicts"],
    ["Numbers", "Numbers"],
  ] as const) {
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(heading);
    await expect(page.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations, tab).toEqual([]);
  }
});

test("buyers: search finds her, the refund button refunds and revokes at once", async ({
  page,
  browser,
}) => {
  await asAdmin(page);
  const buyer = await customer(browser, "admin-buyer");
  try {
    await buy(buyer.page, "module-0");

    await page.goto("/admin?tab=buyers");
    await page.getByLabel("Search buyers by email").fill(buyer.email);
    await page.getByRole("button", { name: "Search" }).click();
    const card = page.getByTestId("buyer");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(buyer.email);
    await expect(card).toContainText("Module 0");
    await expect(card).toContainText("A$49.00");

    await card.locator("summary", { hasText: "Refund" }).click();
    await card.getByRole("button", { name: `Refund A$49.00 to ${buyer.email}` }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("Refunded.");
    await expect(page.getByTestId("buyer")).toContainText("Refunded");
    await expect(page.getByTestId("buyer")).toContainText("Free");

    const { data: profile } = await service
      .from("profiles")
      .select("user_id")
      .eq("email", buyer.email)
      .single();
    const { data: tier } = await service.rpc("tier_of", { p_user: profile!.user_id });
    expect(tier).toBe("free");
    await expect
      .poll(async () => (await emailsTo(buyer.email)).map((e) => e.subject))
      .toContain("Refunded: Module 0");
  } finally {
    await buyer.close();
  }
});

test("leads: the list and the CSV export", async ({ page }) => {
  await asAdmin(page);
  const lead = uniqueEmail("admin-lead");
  await service.rpc("capture_lead", {
    p_email: lead,
    p_source: "waitlist",
    p_interests: ["founding"],
  });

  await page.goto("/admin?tab=leads");
  await expect(page.getByTestId("lead-row").filter({ hasText: lead })).toContainText(
    "waitlist (founding)",
  );
  const csv = await page.request.get("/admin/leads.csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toMatch(
    /attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"/,
  );
  const text = await csv.text();
  expect(text.split("\r\n")[0]).toBe(
    '"email","source","first_seen","interests","has_account","bought"',
  );
  expect(text).toContain(`"${lead}","waitlist"`);
});

test("cohort: places sold, the member's verdict, and a review she sees and is emailed about", async ({
  page,
  browser,
}) => {
  await asAdmin(page);
  const member = await customer(browser, "admin-founder");
  try {
    await buy(member.page, "founding");
    const { data: profile } = await service
      .from("profiles")
      .select("user_id")
      .eq("email", member.email)
      .single();
    const product = `Linen aprons ${Date.now()}`;
    await service.from("verdicts").insert({
      user_id: profile!.user_id,
      product_name: product,
      verdict: "amber",
      reasons_json: { reasons: ["Your margin is 48%: workable, but not over 55%."] },
      submitted_at: new Date().toISOString(),
    });

    await page.goto("/admin?tab=cohort");
    await expect(page.getByTestId("places")).toHaveText(/^\d+ of 30 places sold$/);
    const entry = page.getByTestId("cohort-verdict").filter({ hasText: product });
    await expect(entry).toContainText("Amber");
    await expect(entry).toContainText("Your margin is 48%");

    // Empty review: refused.
    await entry.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Write the review before sending it.",
    );

    await page
      .getByTestId("cohort-verdict")
      .filter({ hasText: product })
      .getByLabel(`Your review of ${product}`)
      .fill("Strong idea. **Fix the margin** before ordering stock.");
    await page
      .getByTestId("cohort-verdict")
      .filter({ hasText: product })
      .getByRole("button", { name: "Send review" })
      .click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      "Review saved and emailed.",
    );
    await expect(page.getByTestId("cohort-verdict").filter({ hasText: product })).toContainText(
      "Reviewed",
    );

    await member.page.goto("/verdict");
    await expect(
      member.page.getByTestId("saved-verdict").filter({ hasText: product }),
    ).toContainText("Fix the margin");
    await expect
      .poll(async () => (await emailsTo(member.email)).map((e) => e.subject))
      .toContain("Your Product Verdict review is ready");

    // The Verdicts tab lists it, reviewed.
    await page.goto("/admin?tab=verdicts");
    await expect(page.getByTestId("verdict-row").filter({ hasText: product })).toContainText(
      "Reviewed",
    );
  } finally {
    await member.close();
  }
});

test("numbers: today and 7 days", async ({ page }) => {
  await asAdmin(page);
  await service.rpc("capture_lead", {
    p_email: uniqueEmail("numbers-lead"),
    p_source: "product_check",
    p_interests: [],
  });
  await page.goto("/admin?tab=numbers");
  const table = page.getByTestId("numbers");
  for (const label of [
    "Leads",
    "Module 0 sales",
    "Course sales",
    "Founding sales",
    "Refunds",
    "Lead → buyer",
  ])
    await expect(table.getByRole("rowheader", { name: label })).toBeVisible();
  const leadsToday = Number(
    await table
      .getByRole("row", { name: /^Leads/ })
      .getByRole("cell")
      .first()
      .textContent(),
  );
  expect(leadsToday).toBeGreaterThanOrEqual(1);
});
