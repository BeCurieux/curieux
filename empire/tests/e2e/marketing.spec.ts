import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The Fit Check page's permission-based opt-in (switched on for e2e with
// EMPIRE_EMAIL_OPTIN=on), one-click unsubscribe, and the offer page.

const unique = (name: string) =>
  `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;

test("the opt-in needs the box ticked, then records consent", async ({ page }) => {
  await page.goto("/fit-check?utm_source=instagram&utm_medium=social&utm_campaign=oct-test");
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(page.getByRole("link", { name: /Get the free Fit Check/ })).toHaveAttribute(
    "href",
    "https://herlittleempireco.gumroad.com/l/fit-check",
  );
  const box = page.getByRole("checkbox", { name: /five welcome emails/ });
  await expect(box).not.toBeChecked();
  await page.getByLabel("Your email").fill(unique("optin"));
  await page.getByRole("button", { name: "Send me the emails" }).click();
  await expect(page.getByText("Tick the box if you'd like the emails.")).toBeVisible();
  await box.check();
  await page.getByRole("button", { name: "Send me the emails" }).click();
  await expect(page.getByText("You're on the list")).toBeVisible();
});

test("unsubscribing takes one click from the emailed link", async ({ page }) => {
  const email = unique("unsub");
  await page.goto("/fit-check");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("checkbox", { name: /five welcome emails/ }).check();
  await page.getByRole("button", { name: "Send me the emails" }).click();
  await expect(page.getByText("You're on the list")).toBeVisible();

  const data = JSON.parse(readFileSync(".data/e2e/empire.json", "utf8")) as {
    emailSignups: { email: string; unsubscribeToken: string; source: string | null }[];
  };
  const row = data.emailSignups.find((s) => s.email === email)!;
  await page.goto(`/unsubscribe?token=${row.unsubscribeToken}`);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByText("You're unsubscribed.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByText("Already off the list")).toBeVisible();
});

test("the offer page shows real screens, the limits and the exact refund sentence", async ({
  page,
}) => {
  await page.goto("/income-fit-test");
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(
    page.getByRole("heading", { name: "Which side income fits your real week?" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /Where do you live/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What it won't do" })).toBeVisible();
  await expect(
    page.getByText("Full refund within 14 days of purchase, no questions asked.").first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Get it on Gumroad, US\$19/ })).toHaveAttribute(
    "href",
    "https://herlittleempireco.gumroad.com/l/income-fit-test",
  );
});

for (const path of ["/fit-check", "/income-fit-test", "/unsubscribe?token=x"]) {
  test(`no serious accessibility issues on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}

test("the founder's seven-day view says what isn't tracked instead of showing zero sales", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.getByLabel("Your email").fill("founder@example.test");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/studio/);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Last seven days: Income Fit Test and Fit Check" }),
  ).toBeVisible();
  const purchases = page.getByRole("row", { name: /Verified purchases/ }).first();
  await expect(purchases).toContainText("Not tracked");
  await expect(purchases).toContainText("not the same as zero sales");
});

test("the Fit Check promises no sign-up, and the offer page links a whole sample report", async ({
  page,
}) => {
  await page.goto("/fit-check");
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(page.getByText(/No sign-up: no account and no password/)).toBeVisible();
  await expect(page.getByText(/not needed for the Fit Check/)).toBeVisible();
  await page.goto("/income-fit-test");
  const sample = page.getByRole("link", { name: "See a whole sample report" });
  await expect(sample).toHaveAttribute("href", "/images/income-fit-test/sample-report.jpg");
  const res = await page.request.get("/images/income-fit-test/sample-report.jpg");
  expect(res.status()).toBe(200);
});
