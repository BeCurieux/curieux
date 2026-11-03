import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { grant } from "./course-fixtures";
import { fakeStripeState, FAKE_STRIPE_BASE } from "./fake-stripe";
import { service, signIn, uniqueEmail } from "./helpers";

// Buying and refunding, end to end, against the stand-in Stripe server
// (tests/e2e/fake-stripe.ts) through the real Stripe SDK: checkout page →
// Checkout Session → "Pay" → signed webhook + success page → entitlement →
// self-serve refund → access revoked.

async function profileOf(email: string) {
  const { data } = await service.from("profiles").select("user_id").eq("email", email).single();
  return data!.user_id as string;
}

async function payOnStripe(page: Page, { bump = false } = {}) {
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await expect(page).toHaveURL(new RegExp(`^${FAKE_STRIPE_BASE}/pay/`));
  if (bump) await page.getByLabel(/Add the benchmark pack/).check();
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page).toHaveURL(/\/checkout\/success\?session_id=cs_test_/);
}

const setFoundingSold = (sold: number) =>
  service.from("products").update({ places_sold: sold }).eq("tier", "founding");
test.afterEach(async () => {
  await setFoundingSold(0);
});

test("buys Module 0 with the benchmark pack, gets access, and refunds it within 14 days", async ({
  page,
}) => {
  const email = uniqueEmail("buyer");
  await signIn(page, email);
  const userId = await profileOf(email);

  await page.goto("/checkout/module-0");
  const summary = page.getByTestId("checkout-summary");
  await expect(summary).toContainText("Module 0");
  await expect(summary).toContainText("You payA$49.00");
  await expect(
    page.getByText("You can add the benchmark pack for A$29.00 on the next page."),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/GST|tax/i);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await payOnStripe(page, { bump: true });
  await expect(page.getByTestId("purchase-confirmed")).toBeVisible();

  // What the app asked Stripe for.
  const sent = (await fakeStripeState()).sessions.find(
    (s) => (s.metadata as { user_id?: string }).user_id === userId,
  )!;
  const prices = (await fakeStripeState()).prices;
  const lookupOf = (id: string) => prices.find((p) => p.id === id)?.lookup_key;
  const params = sent.params as {
    line_items: { price: string }[];
    optional_items: { price: string }[];
    customer_email: string;
    discounts?: unknown;
  };
  expect(lookupOf(params.line_items[0]!.price)).toBe("hle_module0_aud");
  expect(lookupOf(params.optional_items[0]!.price)).toBe("hle_benchmark_pack_aud");
  expect(params.customer_email).toBe(email);
  expect(params.discounts).toBeUndefined();

  // The webhook and the success page both recorded it: one order, two entitlements.
  const { data: orders } = await service
    .from("orders")
    .select("id, amount_cents, currency, status, bump_product_id")
    .eq("user_id", userId);
  expect(orders).toHaveLength(1);
  expect(orders![0]).toMatchObject({ amount_cents: 7800, currency: "aud", status: "paid" });
  expect(orders![0]!.bump_product_id).not.toBeNull();
  const { data: tier } = await service.rpc("tier_of", { p_user: userId });
  expect(tier).toBe("module0");
  const { data: pack } = await service.rpc("has_benchmark_pack_of", { p_user: userId });
  expect(pack).toBe(true);

  // The Price Ladder (Module 0) is open now.
  await page.goto("/tools/price-ladder");
  await expect(page.getByTestId("tool-locked")).toHaveCount(0);

  // Refund, one click (behind "Refund this purchase").
  await page.goto("/account");
  await expect(page.getByTestId("access")).toHaveText("Module 0, plus the benchmark pack");
  const order = page.getByTestId("order").first();
  await expect(order).toContainText("Module 0 + benchmark pack");
  await expect(order).toContainText("A$78.00");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await order.getByText("Refund this purchase").click();
  await order.getByRole("button", { name: "Refund A$78.00" }).click();
  await expect(page.getByRole("status")).toContainText("Refunded.");
  await expect(page.getByTestId("access")).toHaveText("The free Product Check");
  await expect(page.getByTestId("order").first()).toContainText("Refunded");

  // Stripe was asked, access ended at once, and the refund webhook that
  // follows changes nothing.
  expect((await fakeStripeState()).refunds.map((r) => r.payment_intent)).toContain(
    sent.payment_intent,
  );
  const { data: after } = await service.rpc("tier_of", { p_user: userId });
  expect(after).toBe("free");
  await page.goto("/tools/price-ladder");
  await expect(page.getByTestId("tool-locked")).toBeVisible();
  const { data: refunded } = await service
    .from("orders")
    .select("status")
    .eq("user_id", userId)
    .single();
  expect(refunded!.status).toBe("refunded");
});

test("a Module 0 owner pays A$201 for the course: the credit is applied automatically", async ({
  page,
}) => {
  const email = uniqueEmail("upgrade");
  await signIn(page, email);
  await grant(email, ["module0"]);
  await page.goto("/checkout/course");
  const summary = page.getByTestId("checkout-summary");
  await expect(summary).toContainText("Module 0, credited in full−A$49.00");
  await expect(summary).toContainText("You payA$201.00");

  await payOnStripe(page);
  const state = await fakeStripeState();
  const coupon = state.coupons.at(-1)!;
  expect([coupon.amount_off, coupon.currency, coupon.max_redemptions, coupon.duration]).toEqual([
    4900,
    "aud",
    "1",
    "once",
  ]);
  const userId = await profileOf(email);
  const { data: order } = await service
    .from("orders")
    .select("amount_cents")
    .eq("user_id", userId)
    .single();
  expect(order!.amount_cents).toBe(20100);
  const { data: tier } = await service.rpc("tier_of", { p_user: userId });
  expect(tier).toBe("course");
});

test("outside Australia, checkout is in US dollars", async ({ page }) => {
  const email = uniqueEmail("usd-buyer");
  await signIn(page, email);
  await service.from("profiles").update({ country: "US" }).eq("email", email);
  await page.goto("/checkout/module-0");
  await expect(page.getByTestId("checkout-summary")).toContainText("You payUS$34.00");
  await expect(
    page.getByText("You can add the benchmark pack for US$20.00 on the next page."),
  ).toBeVisible();
  await payOnStripe(page);
  const { data: order } = await service
    .from("orders")
    .select("amount_cents, currency")
    .eq("user_id", await profileOf(email))
    .single();
  expect(order).toEqual({ amount_cents: 3400, currency: "usd" });
});

test("founding: places left shown, refused at 30, and a payment that loses the race is refunded", async ({
  page,
}) => {
  const email = uniqueEmail("founder");
  await signIn(page, email);

  await setFoundingSold(30);
  await page.goto("/checkout/founding");
  await expect(page.getByTestId("checkout-refused")).toHaveText(
    /All 30 founding places are taken\./,
  );

  await setFoundingSold(29);
  await page.goto("/checkout/founding");
  await expect(page.getByText("1 of 30 founding places left.")).toBeVisible();
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await expect(page).toHaveURL(new RegExp(`^${FAKE_STRIPE_BASE}/pay/`));
  // Someone else takes the last place while she's on the payment page.
  await setFoundingSold(30);
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(
    page.getByRole("heading", { name: "Sorry, the last place just went" }),
  ).toBeVisible();

  const userId = await profileOf(email);
  const { data: orders } = await service.from("orders").select("id").eq("user_id", userId);
  expect(orders).toEqual([]);
  const sent = (await fakeStripeState()).sessions.find(
    (s) => (s.metadata as { user_id?: string }).user_id === userId,
  )!;
  expect((await fakeStripeState()).refunds.map((r) => r.payment_intent)).toContain(
    sent.payment_intent,
  );
  const { data: product } = await service
    .from("products")
    .select("places_sold")
    .eq("tier", "founding")
    .single();
  expect(product!.places_sold).toBe(30);
});

test("won't sell what she already has", async ({ page }) => {
  const email = uniqueEmail("owner");
  await signIn(page, email);
  await grant(email, ["course"]);
  await page.goto("/checkout/module-0");
  await expect(page.getByTestId("checkout-refused")).toContainText(
    "You already have the full course, which includes this.",
  );
  await page.goto("/checkout/benchmark-pack");
  await expect(page.getByTestId("checkout-refused")).toContainText(
    "You already have the benchmark pack.",
  );
});

test("after 14 days the refund button becomes an email", async ({ page }) => {
  const email = uniqueEmail("late");
  await signIn(page, email);
  const userId = await profileOf(email);
  const { data: product } = await service
    .from("products")
    .select("id")
    .eq("tier", "module0")
    .single();
  await service.from("orders").insert({
    user_id: userId,
    product_id: product!.id,
    stripe_session_id: `cs_old_${Date.now()}`,
    stripe_payment_intent: `pi_old_${Date.now()}`,
    amount_cents: 4900,
    currency: "aud",
    created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  });
  await page.goto("/account");
  const order = page.getByTestId("order").first();
  await expect(order).toContainText("The 14-day self-serve refund has passed.");
  await expect(order.getByRole("link", { name: "Email us about a refund" })).toHaveAttribute(
    "href",
    /^mailto:help@example\.test\?subject=/,
  );
  await expect(order.getByText("Refund this purchase")).toHaveCount(0);
});

test("the webhook refuses an unsigned or wrongly signed event", async ({ request }) => {
  const forged = JSON.stringify({
    id: "evt_x",
    type: "checkout.session.completed",
    data: { object: { id: "cs_x" } },
  });
  expect((await request.post("/api/webhooks/stripe", { data: forged })).status()).toBe(400);
  expect(
    (
      await request.post("/api/webhooks/stripe", {
        data: forged,
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
      })
    ).status(),
  ).toBe(400);
});

test("signed out, checkout and the account page send her to sign in", async ({ request }) => {
  for (const path of ["/checkout/module-0", "/account", "/checkout/success"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers()["location"]).toContain("/login");
  }
});
