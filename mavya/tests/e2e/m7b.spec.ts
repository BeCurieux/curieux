import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { signIn } from "./helpers";

// M7b acceptance path: docs/M7_PAYMENTS.md. The app talks to Stripe's test
// double (STRIPE_API_URL); Stripe's own pages are stood in for, and Stripe's
// messages are sent to the webhook signed with the local secret, exactly as
// Stripe signs them. Its school, owner and family are removed at the end.

const run = Date.now();
const password = `e2e-payments-${run}`;
const ownerEmail = `e2e.payments.owner.${run}@example.test`;
const parentEmail = `e2e.payments.parent.${run}@example.test`;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function account(email: string, name: string) {
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  const { data: profile } = await db
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  return profile!.id as string;
}

// Sends a message to the webhook the way Stripe does.
async function fromStripe(request: APIRequestContext, event: object) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: "event", ...event });
  const signature = new Stripe("sk_test_x").webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
}

test.describe("card payments", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", `e2e-payments-${run}`);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === parentEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("only messages signed by Stripe are read", async ({ request }) => {
    const unsigned = await request.post("/api/stripe/webhook", {
      data: JSON.stringify({ type: "account.updated" }),
      headers: { "stripe-signature": "t=1,v1=not-a-signature" },
    });
    expect(unsigned.status()).toBe(400);
  });

  test("an owner sets up payments; a parent pays and gets a receipt", async ({ page, request }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Pay Swim",
        slug: `e2e-payments-${run}`,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Paz Owner");
    const parentId = await account(parentEmail, "Pip Parent");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    const { data: fam } = await db
      .from("families")
      .insert({ organisation_id: orgId, display_name: "Pip Family" })
      .select("id")
      .single();
    await db.from("family_members").insert({
      family_id: fam!.id,
      user_id: parentId,
      relationship: "parent",
      is_primary_guardian: true,
    });
    await db.from("ledger_entries").insert({
      organisation_id: orgId,
      family_id: fam!.id,
      kind: "charge",
      amount_cents: 23000,
      description: "Term 4 fees",
    });

    // Stripe's own pages, stood in for.
    await page.route(
      (url) => url.hostname !== "localhost",
      (route) => route.fulfill({ contentType: "text/html", body: "<h1>Stripe (test)</h1>" }),
    );

    // The owner sets up payments.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings/payments");
    await expect(page.getByText("0.5% of each payment")).toBeVisible();
    await page.getByRole("button", { name: "Set up with Stripe" }).click();
    await expect(page.getByRole("heading", { name: "Stripe (test)" })).toBeVisible();
    const { data: pa } = await db
      .from("payment_accounts")
      .select("stripe_account_id")
      .eq("organisation_id", orgId)
      .single();
    const acct = pa!.stripe_account_id as string;

    // Stripe approves the school.
    const approved = await fromStripe(request, {
      type: "account.updated",
      account: acct,
      data: {
        object: {
          id: acct,
          object: "account",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        },
      },
    });
    expect(approved.status()).toBe(200);
    await page.goto("/business/settings/payments");
    await expect(page.getByRole("heading", { name: "You're taking payments" })).toBeVisible();

    // The parent pays.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/fees");
    await page.getByRole("button", { name: "Pay $230" }).click();
    await expect(page.getByRole("heading", { name: "Stripe (test)" })).toBeVisible();
    const { data: payment } = await db
      .from("online_payments")
      .select("id, checkout_session_id, platform_fee_cents")
      .eq("family_id", fam!.id)
      .single();
    expect(payment!.platform_fee_cents).toBe(115);

    // Stripe confirms it.
    const confirmed = await fromStripe(request, {
      type: "checkout.session.completed",
      account: acct,
      data: {
        object: {
          id: payment!.checkout_session_id,
          object: "checkout.session",
          amount_total: 23000,
          payment_status: "paid",
          payment_intent: `pi_${run}`,
          metadata: { ovyko_payment_id: payment!.id },
        },
      },
    });
    expect(await confirmed.json()).toEqual({ outcome: "paid" });

    // Back from Stripe.
    await page.goto(`/family/fees?paid=${payment!.id}`);
    await expect(page.getByText("Your payment of $230 is in")).toBeVisible();
    const statement = page.getByRole("region", { name: "Pip Family" });
    await expect(statement.getByText("Paid up")).toBeVisible();
    await expect(statement.getByText("Paid online by card")).toBeVisible();
    await expect(statement.getByRole("button", { name: /^Pay/ })).toHaveCount(0);

    // The receipt.
    await request.post("/api/email/deliver", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const search = await request.get(`${MAILPIT}/api/v1/search`, {
      params: { query: `to:"${parentEmail}" subject:"Receipt from Pay Swim"` },
    });
    expect(((await search.json()) as { messages: unknown[] }).messages).toHaveLength(1);
  });
});
