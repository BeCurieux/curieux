import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleStripeEvent, TryAgainLater, type StripeLookups } from "@/lib/payments/webhook";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M7b acceptance (security and rules): docs/M7_PAYMENTS.md. People act
// through their own sessions. Stripe's messages go through the same
// handler the webhook route uses, with the secret key, as the server does
// once a message's signature has been checked.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `payments-${run}-password`;
const createdAuthIds: string[] = [];
const acct = `acct_test${run}`;

async function newAccount(email: string, name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  createdAuthIds.push(data.user.id);
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  return profile!.id;
}

async function signIn(email: string): Promise<Client> {
  const c = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

const emails = {
  owner: `payments.owner.${run}@example.test`,
  teacher: `payments.teacher.${run}@example.test`,
  lee: `payments.lee.${run}@example.test`,
  ruiz: `payments.ruiz.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let teacher: Client;
let lee: Client;
let ruiz: Client;
let leeId: string;
let leeFamily: string;
let ruizFamily: string;

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Payments Test Swim",
      slug: `payments-test-${run}`,
      activity_type: "swimming",
      owner_two_step_required: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;
  const ownerId = await newAccount(emails.owner, "Olive Owner");
  const teacherId = await newAccount(emails.teacher, "Tia Teacher");
  leeId = await newAccount(emails.lee, "Lena Lee");
  const ruizId = await newAccount(emails.ruiz, "Rafa Ruiz");
  await admin.from("staff_memberships").insert([
    { user_id: ownerId, organisation_id: orgId, role: "owner" },
    { user_id: teacherId, organisation_id: orgId, role: "instructor" },
  ]);
  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Payments Lee ${run}` },
      { organisation_id: orgId, display_name: `Payments Ruiz ${run}` },
    ])
    .select("id, display_name");
  leeFamily = fams!.find((f) => f.display_name.includes("Lee"))!.id;
  ruizFamily = fams!.find((f) => f.display_name.includes("Ruiz"))!.id;
  await admin.from("family_members").insert([
    { family_id: leeFamily, user_id: leeId, relationship: "parent", is_primary_guardian: true },
    { family_id: ruizFamily, user_id: ruizId, relationship: "parent", is_primary_guardian: true },
  ]);
  owner = await signIn(emails.owner);
  teacher = await signIn(emails.teacher);
  lee = await signIn(emails.lee);
  ruiz = await signIn(emails.ruiz);
  for (const [family, cents] of [
    [leeFamily, 10000],
    [ruizFamily, 4000],
  ] as const) {
    const { error: e } = await owner.rpc("add_account_line", {
      p_family: family,
      p_kind: "charge",
      p_amount_cents: cents,
      p_reason: "Term 4 fees",
    });
    if (e) throw e;
  }
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", `payments-test-${run}`);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const balance = async (family: string) => {
  const { data } = await admin
    .from("ledger_entries")
    .select("amount_cents")
    .eq("family_id", family);
  return data!.reduce((sum, l) => sum + l.amount_cents, 0);
};

// A Stripe message as the handler sees it once its signature is checked.
const event = (type: string, object: object, account: string | null = acct) =>
  ({ id: `evt_${Math.random()}`, type, account, data: { object } }) as unknown as Stripe.Event;

// What Stripe itself says when asked (stood in for): accounts' flags, and
// the Ovyko payment on each payment intent.
const stripeSide = {
  accounts: new Map<string, { charges: boolean; payouts: boolean; details: boolean }>(),
  intents: new Map<string, string>(),
};
const lookups: StripeLookups = {
  paymentIdForIntent: async (_account, intent) => stripeSide.intents.get(intent) ?? null,
  accountFlags: async (account) =>
    stripeSide.accounts.get(account) ?? { charges: false, payouts: false, details: false },
};
const handle = (e: Stripe.Event) => handleStripeEvent(admin, e, lookups);

const session = (
  paymentId: string,
  id: string,
  amount: number,
  paymentStatus: "paid" | "unpaid",
  intent: string,
) => ({
  id,
  object: "checkout.session",
  amount_total: amount,
  payment_status: paymentStatus,
  payment_intent: intent,
  metadata: { ovyko_payment_id: paymentId },
});

async function start(c: Client, family: string) {
  const { data, error } = await c.rpc("start_online_payment", { p_family: family });
  return { row: data?.[0], error };
}

async function attach(paymentId: string, sessionId: string) {
  const { error } = await admin.rpc("attach_checkout_session", {
    p_payment: paymentId,
    p_session: sessionId,
  });
  if (error) throw error;
}

describe("setting up a school's Stripe account", () => {
  it("before it's set up, parents can't pay online", async () => {
    expect((await lee.rpc("can_pay_online", { p_org: orgId })).data).toBe(false);
    const { error } = await start(lee, leeFamily);
    expect(error?.hint).toBe("payments_off");
  });

  it("only the server records a Stripe account; owners and parents can't", async () => {
    for (const c of [owner, lee]) {
      const { error } = await c.rpc("save_payment_account", {
        p_org: orgId,
        p_account: "acct_mine",
        p_charges: true,
        p_payouts: true,
        p_details: true,
      });
      expect(error?.code).toBe("42501");
      const insert = await c
        .from("payment_accounts")
        .insert({ organisation_id: orgId, stripe_account_id: "acct_mine" });
      expect(insert.error?.code).toBe("42501");
    }
  });

  it("the first account is kept, and owners see it", async () => {
    const first = await admin.rpc("save_payment_account", {
      p_org: orgId,
      p_account: acct,
      p_charges: false,
      p_payouts: false,
      p_details: false,
    });
    expect(first.data).toBe(acct);
    const second = await admin.rpc("save_payment_account", {
      p_org: orgId,
      p_account: `acct_other${run}`,
      p_charges: true,
      p_payouts: true,
      p_details: true,
    });
    expect(second.data).toBe(acct);
    const { data } = await owner
      .from("payment_accounts")
      .select("stripe_account_id, charges_enabled");
    expect(data).toEqual([{ stripe_account_id: acct, charges_enabled: false }]);
  });

  it("Stripe's say switches payments on; other accounts change nothing", async () => {
    stripeSide.accounts.set("acct_nobody", { charges: true, payouts: true, details: true });
    const stray = await handle(
      event("account.updated", { id: "acct_nobody", charges_enabled: true }, "acct_nobody"),
    );
    expect(stray).toBe("ignored");
    expect((await lee.rpc("can_pay_online", { p_org: orgId })).data).toBe(false);
    // The handler asks Stripe how the account stands, not the message.
    stripeSide.accounts.set(acct, { charges: true, payouts: true, details: true });
    const ours = await handle(
      event("account.updated", {
        id: acct,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    );
    expect(ours).toBe("account updated");
    expect((await lee.rpc("can_pay_online", { p_org: orgId })).data).toBe(true);
    expect((await owner.rpc("can_pay_online", { p_org: orgId })).data).toBe(true);
  });

  it("no one outside the school learns about it", async () => {
    const outsider = await signInAs("burrowsParent");
    expect((await outsider.client.rpc("can_pay_online", { p_org: orgId })).data).toBe(false);
    for (const c of [teacher, lee, outsider.client]) {
      const { data } = await c.from("payment_accounts").select("*").eq("organisation_id", orgId);
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("a card payment", () => {
  let paymentId: string;
  const sessionId = `cs_test_lee${run}`;
  const intent = `pi_lee${run}`;

  it("a parent can't start paying another family's account", async () => {
    const { error } = await start(lee, ruizFamily);
    expect(error?.code).toBe("42501");
    const outsider = await signInAs("burrowsParent");
    expect((await start(outsider.client, leeFamily)).error?.code).toBe("42501");
  });

  it("pays what's owing, with Ovyko's 0.5%", async () => {
    const { row, error } = await start(lee, leeFamily);
    expect(error).toBeNull();
    expect(row).toMatchObject({
      amount_cents: 10000,
      platform_fee_cents: 50,
      stripe_account_id: acct,
      school_name: "Payments Test Swim",
    });
    paymentId = row!.payment_id;
    await attach(paymentId, sessionId);
    stripeSide.intents.set(intent, paymentId);
  });

  it("tapping Pay again reopens the same page, never a second one", async () => {
    const { row } = await start(lee, leeFamily);
    expect(row).toMatchObject({ payment_id: paymentId, checkout_session_id: sessionId });
    const { count } = await admin
      .from("online_payments")
      .select("id", { count: "exact", head: true })
      .eq("family_id", leeFamily);
    expect(count).toBe(1);
  });

  it("a refund that arrives before the payment is confirmed is sent again later", async () => {
    const early = event("charge.refunded", {
      id: "ch_1",
      payment_intent: intent,
      amount_refunded: 1000,
    });
    await expect(handle(early)).rejects.toBeInstanceOf(TryAgainLater);
    // Not one of Ovyko's payments: ignored.
    expect(
      await handle(
        event("charge.refunded", { id: "ch_x", payment_intent: "pi_other", amount_refunded: 1 }),
      ),
    ).toBe("ignored");
  });

  it("parents can't settle a payment themselves", async () => {
    const { error } = await lee.rpc("settle_online_payment", {
      p_payment: paymentId,
      p_account: acct,
      p_session: sessionId,
      p_amount_cents: 10000,
      p_status: "paid",
      p_method: "card",
    });
    expect(error?.code).toBe("42501");
    const { error: e2 } = await lee
      .from("online_payments")
      .update({ status: "paid" })
      .eq("id", paymentId);
    expect(e2?.code).toBe("42501");
  });

  it("a message from another account, page or amount changes nothing", async () => {
    const tries = [
      event(
        "checkout.session.completed",
        session(paymentId, sessionId, 10000, "paid", intent),
        "acct_evil",
      ),
      event(
        "checkout.session.completed",
        session(paymentId, "cs_test_other", 10000, "paid", intent),
      ),
      event("checkout.session.completed", session(paymentId, sessionId, 100, "paid", intent)),
      event("checkout.session.completed", session("not-a-uuid", sessionId, 10000, "paid", intent)),
      event(
        "checkout.session.completed",
        session(paymentId, sessionId, 10000, "paid", intent),
        null,
      ),
    ];
    for (const t of tries) expect(await handle(t)).toBe("ignored");
    expect(await balance(leeFamily)).toBe(10000);
  });

  it("Stripe's confirmation adds the payment, once, and queues one receipt", async () => {
    const done = event(
      "checkout.session.completed",
      session(paymentId, sessionId, 10000, "paid", intent),
    );
    expect(await handle(done)).toBe("paid");
    expect(await handle(done)).toBe("paid");
    expect(
      await handle(
        event("checkout.session.expired", session(paymentId, sessionId, 10000, "unpaid", intent)),
      ),
    ).toBe("paid");
    expect(await balance(leeFamily)).toBe(0);
    const { data: lines } = await lee
      .from("ledger_entries")
      .select("kind, amount_cents, method, description, online_payment_id")
      .eq("family_id", leeFamily)
      .eq("kind", "payment");
    expect(lines).toEqual([
      {
        kind: "payment",
        amount_cents: -10000,
        method: "card",
        description: "Paid online by card",
        online_payment_id: paymentId,
      },
    ]);
    const { data: receipts } = await admin
      .from("email_deliveries")
      .select("kind, recipient_user_id")
      .eq("dedupe_key", `receipt:${paymentId}`);
    expect(receipts).toEqual([{ kind: "payment_receipt", recipient_user_id: leeId }]);
  });

  it("the family and owner see it; other families and instructors don't", async () => {
    expect((await lee.from("online_payments").select("id")).data).toEqual([{ id: paymentId }]);
    expect((await owner.from("online_payments").select("id")).data).toEqual([{ id: paymentId }]);
    expect((await ruiz.from("online_payments").select("id")).data).toEqual([]);
    expect((await teacher.from("online_payments").select("id")).data).toEqual([]);
  });

  it("there's nothing left to pay", async () => {
    expect((await start(lee, leeFamily)).error?.hint).toBe("nothing_owing");
  });

  it("an owner can't cancel an online payment; it's refunded in Stripe", async () => {
    const { data: line } = await owner
      .from("ledger_entries")
      .select("id")
      .eq("online_payment_id", paymentId)
      .single();
    const { error } = await owner.rpc("cancel_ledger_entry", {
      p_entry: line!.id,
      p_reason: "Oops",
    });
    expect(error?.hint).toBe("online_line");
  });

  it("refunds in Stripe add refund lines, once each", async () => {
    const refunded = (total: number, account = acct) =>
      handle(
        event(
          "charge.refunded",
          { id: "ch_1", payment_intent: intent, amount_refunded: total },
          account,
        ),
      );
    expect(await refunded(3000, "acct_evil")).toBe("ignored");
    expect(await refunded(3000)).toBe("refunded 3000");
    expect(await refunded(3000)).toBe("refunded 0");
    expect(await balance(leeFamily)).toBe(3000);
    expect(await refunded(20000)).toBe("ignored");
    expect(await refunded(10000)).toBe("refunded 7000");
    expect(await balance(leeFamily)).toBe(10000);
  });

  it("a refund that fails puts the money back, once", async () => {
    const failed = event("refund.failed", {
      id: "re_1",
      status: "failed",
      payment_intent: intent,
      amount: 3000,
    });
    expect(await handle(failed)).toBe("refund failed 3000");
    expect(await handle(failed)).toBe("refund failed 0");
    expect(await balance(leeFamily)).toBe(7000);
    const ok = event("charge.refund.updated", {
      id: "re_2",
      status: "succeeded",
      payment_intent: intent,
      amount: 7000,
    });
    expect(await handle(ok)).toBe("ignored");
  });
});

describe("a direct debit", () => {
  const intent = `pi_ruiz${run}`;

  it("is on its way until it clears, and isn't asked for twice", async () => {
    const { row } = await start(ruiz, ruizFamily);
    expect(row!.amount_cents).toBe(4000);
    expect(row!.platform_fee_cents).toBe(20);
    await attach(row!.payment_id, `cs_test_ruiz1${run}`);
    const s = session(row!.payment_id, `cs_test_ruiz1${run}`, 4000, "unpaid", intent);
    expect(await handle(event("checkout.session.completed", s))).toBe("processing");
    expect(await balance(ruizFamily)).toBe(4000);
    expect((await start(ruiz, ruizFamily)).error?.hint).toBe("nothing_owing");

    // It fails: still owing, and can be paid again.
    expect(await handle(event("checkout.session.async_payment_failed", s))).toBe("failed");
    expect(await balance(ruizFamily)).toBe(4000);
    // The parent is told at once (M7c).
    const { data: told } = await admin
      .from("email_deliveries")
      .select("kind")
      .eq("dedupe_key", `failed:${row!.payment_id}`);
    expect(told).toEqual([{ kind: "payment_failed" }]);
    const again = await start(ruiz, ruizFamily);
    expect(again.row!.amount_cents).toBe(4000);

    // The second one clears.
    await attach(again.row!.payment_id, `cs_test_ruiz2${run}`);
    const s2 = session(again.row!.payment_id, `cs_test_ruiz2${run}`, 4000, "unpaid", `${intent}b`);
    await handle(event("checkout.session.completed", s2));
    expect(await handle(event("checkout.session.async_payment_succeeded", s2))).toBe("paid");
    expect(await balance(ruizFamily)).toBe(0);
    const { data } = await ruiz
      .from("ledger_entries")
      .select("method, description")
      .eq("kind", "payment");
    expect(data).toEqual([{ method: "direct_debit", description: "Paid by direct debit" }]);
  });

  it("a chargeback the school loses means the family owes it again, once", async () => {
    const dispute = (status: string) =>
      event("charge.dispute.closed", {
        id: "dp_1",
        status,
        payment_intent: `${intent}b`,
        amount: 4000,
      });
    expect(await handle(dispute("won"))).toBe("ignored");
    expect(await handle(dispute("lost"))).toBe("dispute lost 4000");
    expect(await handle(dispute("lost"))).toBe("dispute lost 0");
    expect(await balance(ruizFamily)).toBe(4000);
  });
});

describe("a school disconnecting Stripe", () => {
  it("stops payments in Ovyko", async () => {
    const gone = event("account.application.deauthorized", { id: "ca_1" });
    expect(await handle(gone)).toBe("account disconnected");
    expect((await lee.rpc("can_pay_online", { p_org: orgId })).data).toBe(false);
    expect((await start(lee, leeFamily)).error?.hint).toBe("payments_off");
  });
});
