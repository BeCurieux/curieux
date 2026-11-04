import { expect, test, type Page } from "@playwright/test";
import { grant } from "./course-fixtures";
import { emailsTo } from "./fake-resend";
import { FAKE_STRIPE_BASE, fakeStripeState } from "./fake-stripe";
import { signIn, uniqueEmail } from "./helpers";

// The launch check (build step 9, SPEC.md → Build order): every gated route
// refuses a signed-out request on the server, and GST appears nowhere a
// customer looks, in Australia or outside it.

// Every gated page and route, by its real URL.
const PAGES = [
  "/learn",
  "/learn/module-0/lesson-0-1",
  "/learn/module-0/lesson-0-2",
  "/tools",
  "/tools/cash-cycle",
  "/tools/aov-lever",
  "/verdict",
  "/account",
  "/account?refund=done",
  "/checkout/module-0",
  "/checkout/course",
  "/checkout/founding",
  "/checkout/benchmark-pack",
  "/checkout/success?session_id=cs_test_x",
  "/admin",
  "/admin?tab=leads",
  "/admin?tab=numbers",
  "/admin/leads.csv",
];

// What a signed-in page would show; none of it may reach a signed-out request.
const LEAKS = [/Signed in as/i, /Mark lesson done/, /Your account/, /Export CSV/, /email,source/];

test("signed out, every gated page and route refuses on the server", async ({ request }) => {
  for (const path of PAGES) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    const location = new URL(response.headers()["location"]!, "http://x");
    expect(location.pathname, path).toBe("/login");
    expect(location.searchParams.get("next"), path).toBe(path);
    const body = await response.text();
    for (const leak of LEAKS) expect(body, `${path} leaks ${leak}`).not.toMatch(leak);
  }
});

test("signed out, a request that tries to skip the proxy is still sent to sign in", async ({
  request,
}) => {
  // The header behind CVE-2025-29927, which once let a request skip
  // middleware. Each page also makes its own check (tests/unit/launch.test.ts
  // proves every gated file does), so this holds even if the proxy is skipped.
  for (const path of PAGES) {
    const response = await request.get(path, {
      maxRedirects: 0,
      headers: { "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" },
    });
    expect(response.status(), path).toBe(307);
    expect(response.headers()["location"], path).toContain("/login");
  }
});

test("signed out, the API routes refuse without a session, signature or secret", async ({
  request,
}) => {
  const asset = await request.get("/api/assets/00000000-0000-4000-8000-000000000000", {
    maxRedirects: 0,
  });
  expect(asset.status()).toBe(307);
  expect(asset.headers()["location"]).toContain("/login");
  expect(asset.headers()["cache-control"]).toContain("no-store");

  expect((await request.get("/api/cron/email")).status()).toBe(401);
  expect((await request.post("/api/webhooks/stripe", { data: "{}" })).status()).toBe(400);
  expect((await request.post("/api/unsubscribe?e=x&t=y")).status()).toBe(400);
});

async function noGst(page: Page, path: string) {
  await page.goto(path);
  const html = await page.content();
  expect(html, `${path} mentions GST`).not.toMatch(/\bGST\b/);
  expect(html, `${path} adds tax`).not.toMatch(/\b(?:incl|excl|plus|\+)\.?\s*(?:tax|VAT)\b/i);
}

const PUBLIC_PAGES = [
  "/",
  "/pricing",
  "/check",
  "/hype",
  "/waitlist",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refunds",
  "/login",
];

test("no GST on any public page, in Australian or US dollars", async ({ page }) => {
  for (const path of PUBLIC_PAGES) await noGst(page, path);
  await page.setExtraHTTPHeaders({ "x-vercel-ip-country": "US" });
  for (const path of PUBLIC_PAGES) await noGst(page, path);
});

test("no GST when she buys: checkout, Stripe, receipt, account, course", async ({ page }) => {
  const email = uniqueEmail("launch-gst");
  await signIn(page, email);
  for (const path of ["/checkout/module-0", "/checkout/course", "/checkout/founding"])
    await noGst(page, path);

  await page.goto("/checkout/module-0");
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await expect(page).toHaveURL(new RegExp(`^${FAKE_STRIPE_BASE}/pay/`));
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page.getByTestId("purchase-confirmed")).toBeVisible();
  expect(await page.content()).not.toMatch(/\bGST\b/);

  // Stripe was asked for no tax of any kind.
  const { sessions } = await fakeStripeState();
  const mine = sessions.filter(
    (s) => (s.params as { customer_email?: string }).customer_email === email,
  );
  expect(mine).toHaveLength(1);
  expect(JSON.stringify(mine[0]!.params)).not.toMatch(/tax/i);

  await expect.poll(async () => (await emailsTo(email)).length).toBeGreaterThan(0);
  for (const mail of await emailsTo(email)) {
    expect(mail.text, mail.subject).not.toMatch(/\bGST\b/);
    expect(mail.html ?? "", mail.subject).not.toMatch(/\bGST\b/);
  }

  await grant(email, ["course"]);
  for (const path of [
    "/account",
    "/learn",
    "/learn/module-0/lesson-0-1",
    "/tools",
    "/tools/cash-cycle",
    "/tools/aov-lever",
    "/verdict",
  ])
    await noGst(page, path);
});
