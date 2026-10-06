import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { signIn } from "./helpers";

// M7c part 2 acceptance path (instalments): docs/M7_PAYMENTS.md. As in
// m7b.spec.ts, the app talks to Stripe's test double, Stripe's pages are
// stood in for, and Stripe's messages are signed with the local secret.
// Stripe's test double never approves a payment the server takes, so the
// instalment taken on its date here doesn't go through.

const run = Date.now();
const password = `e2e-instalments-${run}`;
const ownerEmail = `e2e.instalments.owner.${run}@example.test`;
const parentEmail = `e2e.instalments.parent.${run}@example.test`;
const slug = `e2e-instalments-${run}`;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const acct = `acct_e2einst${run}`;

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

test.describe("instalments", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("organisations").delete().eq("slug", slug);
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? [])
      if (u.email === ownerEmail || u.email === parentEmail) await db.auth.admin.deleteUser(u.id);
  });

  test("only the database's schedule can ask for instalments to be taken", async ({ request }) => {
    const res = await request.post("/api/payments/instalments", {
      headers: { Authorization: "Bearer not-the-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("an owner offers instalments; a parent pays in 4", async ({ page, request }) => {
    test.setTimeout(90_000);
    const db = admin();
    const { data: org } = await db
      .from("organisations")
      .insert({
        name: "Split Swim",
        slug,
        activity_type: "swimming",
        owner_two_step_required: false,
      })
      .select("id")
      .single();
    const orgId = org!.id as string;
    const ownerId = await account(ownerEmail, "Sol Owner");
    const parentId = await account(parentEmail, "Sam Parent");
    await db
      .from("staff_memberships")
      .insert({ user_id: ownerId, organisation_id: orgId, role: "owner" });
    const { data: fam } = await db
      .from("families")
      .insert({ organisation_id: orgId, display_name: "Sam Family" })
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
      amount_cents: 46000,
      description: "Term 4 fees",
    });
    await db.rpc("save_payment_account", {
      p_org: orgId,
      p_account: acct,
      p_charges: true,
      p_payouts: true,
      p_details: true,
    });

    await page.route(
      (url) => url.hostname !== "localhost",
      (route) => route.fulfill({ contentType: "text/html", body: "<h1>Stripe (test)</h1>" }),
    );

    // The owner switches instalments on.
    await signIn(page, ownerEmail, password);
    await expect(page).toHaveURL(/\/business$/);
    await page.goto("/business/settings/payments");
    await page.getByRole("switch", { name: /Instalments/ }).check();
    await expect(page.getByText("Families can pay $100 or more in 2 or 4 payments.")).toBeVisible();

    // The parent chooses 4 payments.
    await page.context().clearCookies();
    await signIn(page, parentEmail, password);
    await expect(page).toHaveURL(/\/family$/);
    await page.goto("/family/fees");
    const statement = page.getByRole("region", { name: "Sam Family" });
    await expect(statement.getByRole("button", { name: "Pay $460" })).toBeVisible();
    await expect(statement.getByRole("button", { name: "2 payments of $230" })).toBeVisible();
    await statement.getByRole("button", { name: "4 payments of $115" }).click();
    await expect(page.getByRole("heading", { name: "Stripe (test)" })).toBeVisible();
    const { data: first } = await db
      .from("online_payments")
      .select("id, checkout_session_id, amount_cents")
      .eq("family_id", fam!.id)
      .single();
    expect(first!.amount_cents).toBe(11500);

    // Stripe confirms the first payment and saves the card.
    const confirmed = await fromStripe(request, {
      type: "checkout.session.completed",
      account: acct,
      data: {
        object: {
          id: first!.checkout_session_id,
          object: "checkout.session",
          amount_total: 11500,
          payment_status: "paid",
          payment_intent: `pi_e2e${run}`,
          customer: `cus_e2e${run}`,
          metadata: { ovyko_payment_id: first!.id },
        },
      },
    });
    expect(await confirmed.json()).toEqual({ outcome: "paid" });

    await page.goto("/family/fees");
    await expect(statement.getByText("Paying $460 in 4 payments.")).toBeVisible();
    const schedule = statement.getByRole("list", { name: "Instalments" });
    await expect(schedule.getByRole("listitem")).toHaveCount(4);
    await expect(schedule.getByRole("listitem").first()).toContainText("Paid");
    await expect(schedule.getByRole("listitem").nth(1)).toContainText("To come");
    await expect(statement.getByRole("button", { name: "Pay the rest now: $345" })).toBeVisible();
    await expect(statement.getByRole("button", { name: /^Pay \$/ })).toHaveCount(0);

    // The second one's date comes; the bank says no.
    const { data: plan } = await db
      .from("instalment_plans")
      .select("id")
      .eq("family_id", fam!.id)
      .single();
    await db
      .from("instalments")
      .update({ due_on: "2026-01-01" })
      .eq("plan_id", plan!.id)
      .eq("seq", 2);
    const taken = await request.post("/api/payments/instalments", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(taken.status()).toBe(200);
    expect((await taken.json()) as { failed: number }).toMatchObject({ failed: 1 });

    // The plan ends; everything left is owed, and the parent is told.
    await page.goto("/family/fees");
    await expect(statement.getByText("A payment of $115 didn't go through.")).toBeVisible();
    await expect(statement.getByRole("button", { name: "Pay $345" })).toBeVisible();
    await expect(statement.getByRole("list", { name: "Instalments" })).toHaveCount(0);
    await request.post("/api/email/deliver", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const search = await request.get(`${MAILPIT}/api/v1/search`, {
      params: { query: `to:"${parentEmail}" subject:"A payment didn't go through"` },
    });
    expect(((await search.json()) as { messages: unknown[] }).messages).toHaveLength(1);
  });
});
