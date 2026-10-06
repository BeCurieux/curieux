import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleStripeEvent, type StripeLookups } from "@/lib/payments/webhook";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M7c part 2 acceptance (instalments): docs/M7_PAYMENTS.md. People act
// through their own sessions; Stripe's messages go through the webhook's
// own handler; the server's steps use the secret key, as the server does.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `instalments-${run}-password`;
const createdAuthIds: string[] = [];
const acct = `acct_inst${run}`;
const slug = `instalments-test-${run}`;

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
  owner: `instalments.owner.${run}@example.test`,
  teacher: `instalments.teacher.${run}@example.test`,
  lee: `instalments.lee.${run}@example.test`,
  ruiz: `instalments.ruiz.${run}@example.test`,
};

let orgId: string;
let owner: Client;
let teacher: Client;
let lee: Client;
let ruiz: Client;
let leeFamily: string;
let ruizFamily: string;

async function charge(family: string, cents: number) {
  const { error } = await owner.rpc("add_account_line", {
    p_family: family,
    p_kind: "charge",
    p_amount_cents: cents,
    p_reason: "Term 4 fees",
  });
  if (error) throw error;
}

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Instalments Test Swim",
      slug,
      activity_type: "swimming",
      owner_two_step_required: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;
  const ownerId = await newAccount(emails.owner, "Olive Owner");
  const teacherId = await newAccount(emails.teacher, "Tia Teacher");
  const leeId = await newAccount(emails.lee, "Lena Lee");
  const ruizId = await newAccount(emails.ruiz, "Rafa Ruiz");
  await admin.from("staff_memberships").insert([
    { user_id: ownerId, organisation_id: orgId, role: "owner" },
    { user_id: teacherId, organisation_id: orgId, role: "instructor" },
  ]);
  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Instalments Lee ${run}` },
      { organisation_id: orgId, display_name: `Instalments Ruiz ${run}` },
    ])
    .select("id, display_name");
  leeFamily = fams!.find((f) => f.display_name.includes("Lee"))!.id;
  ruizFamily = fams!.find((f) => f.display_name.includes("Ruiz"))!.id;
  await admin.from("family_members").insert([
    { family_id: leeFamily, user_id: leeId, relationship: "parent", is_primary_guardian: true },
    { family_id: ruizFamily, user_id: ruizId, relationship: "parent", is_primary_guardian: true },
  ]);
  const saved = await admin.rpc("save_payment_account", {
    p_org: orgId,
    p_account: acct,
    p_charges: true,
    p_payouts: true,
    p_details: true,
  });
  if (saved.error) throw saved.error;
  owner = await signIn(emails.owner);
  teacher = await signIn(emails.teacher);
  lee = await signIn(emails.lee);
  ruiz = await signIn(emails.ruiz);
  await charge(leeFamily, 23001);
  await charge(ruizFamily, 4000);
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", slug);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const balance = async (family: string) => {
  const { data } = await admin
    .from("ledger_entries")
    .select("amount_cents")
    .eq("family_id", family);
  return data!.reduce((sum, l) => sum + l.amount_cents, 0);
};

const event = (type: string, object: object, account: string | null = acct) =>
  ({ id: `evt_${Math.random()}`, type, account, data: { object } }) as unknown as Stripe.Event;

const lookups: StripeLookups = {
  paymentIdForIntent: async () => null,
  accountFlags: async () => ({ charges: true, payouts: true, details: true }),
  subscription: async () => {
    throw new Error("not used here");
  },
  savedPaymentMethod: async () => ({ id: `pm_saved${run}`, type: "card" }),
};
const handle = (e: Stripe.Event) => handleStripeEvent(admin, e, lookups);

// Pays a plan's first instalment on Stripe's page: the page is opened,
// then Stripe says it's paid, with the customer it saved the card to.
async function payFirst(paymentId: string, amount: number) {
  const sessionId = `cs_inst_${paymentId.slice(0, 8)}`;
  const { error } = await admin.rpc("attach_checkout_session", {
    p_payment: paymentId,
    p_session: sessionId,
  });
  if (error) throw error;
  return handle(
    event("checkout.session.completed", {
      id: sessionId,
      object: "checkout.session",
      amount_total: amount,
      payment_status: "paid",
      payment_intent: `pi_first_${paymentId.slice(0, 8)}`,
      customer: `cus_lee${run}`,
      metadata: { ovyko_payment_id: paymentId },
    }),
  );
}

// Makes a plan's next instalment due now, as if its date had come.
async function makeDue(planId: string, seq: number) {
  const { error } = await admin
    .from("instalments")
    .update({ due_on: "2026-01-01" })
    .eq("plan_id", planId)
    .eq("seq", seq);
  if (error) throw error;
}

async function claimOurs() {
  const { data, error } = await admin.rpc("claim_due_instalments", { p_limit: 50 });
  if (error) throw error;
  return (data ?? []).filter((r) => r.stripe_account_id === acct);
}

const intentEvent = (type: string, paymentId: string, amount: number, account = acct) =>
  event(
    type,
    {
      id: `pi_${paymentId.slice(0, 8)}`,
      object: "payment_intent",
      amount,
      metadata: { ovyko_payment_id: paymentId },
    },
    account,
  );

async function planOf(family: string) {
  const { data } = await admin
    .from("instalment_plans")
    .select("id, status, payments, total_cents, payment_method_id, payment_method_type")
    .eq("family_id", family)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data!;
}

async function instalmentsOf(planId: string) {
  const { data } = await admin
    .from("instalments")
    .select("seq, amount_cents, due_on, status, online_payment_id")
    .eq("plan_id", planId)
    .order("seq");
  return data!;
}

describe("a school offering instalments", () => {
  it("is off until an owner switches it on", async () => {
    expect((await lee.rpc("instalments_offered", { p_org: orgId })).data).toBe(false);
    const { error } = await lee.rpc("start_instalment_plan", {
      p_family: leeFamily,
      p_payments: 2,
    });
    expect(error?.hint).toBe("plan_invalid");
  });

  it("only an owner can switch it, and the choice is audited", async () => {
    for (const c of [teacher, lee]) {
      const { error } = await c.rpc("set_instalments_on", { p_org: orgId, p_on: true });
      expect(error?.code).toBe("42501");
    }
    const { error } = await owner.rpc("set_instalments_on", { p_org: orgId, p_on: true });
    expect(error).toBeNull();
    expect((await lee.rpc("instalments_offered", { p_org: orgId })).data).toBe(true);
    const { data: audit } = await admin
      .from("audit_events")
      .select("after_json")
      .eq("organisation_id", orgId)
      .eq("entity_type", "organisations");
    expect(audit).toContainEqual({ after_json: { instalments_on: true } });
  });

  it("no one outside the school learns whether it does", async () => {
    const outsider = await signInAs("burrowsParent");
    const { data } = await outsider.client.rpc("instalments_offered", { p_org: orgId });
    expect(data).toBeNull();
  });
});

describe("starting a plan", () => {
  it("is for $100 or more, in 2 or 4 payments, for your own family", async () => {
    const small = await ruiz.rpc("start_instalment_plan", { p_family: ruizFamily, p_payments: 2 });
    expect(small.error?.message).toBe("Instalments are for $100 or more.");
    const three = await lee.rpc("start_instalment_plan", { p_family: leeFamily, p_payments: 3 });
    expect(three.error?.hint).toBe("plan_invalid");
    const other = await ruiz.rpc("start_instalment_plan", { p_family: leeFamily, p_payments: 2 });
    expect(other.error?.code).toBe("42501");
    const owners = await owner.rpc("start_instalment_plan", { p_family: leeFamily, p_payments: 2 });
    expect(owners.error?.code).toBe("42501");
  });

  it("splits what's owed evenly, the first taking the odd cents, a fortnight apart", async () => {
    const { data, error } = await lee.rpc("start_instalment_plan", {
      p_family: leeFamily,
      p_payments: 4,
    });
    expect(error).toBeNull();
    expect(data![0]!.amount_cents).toBe(5751);
    expect(data![0]!.platform_fee_cents).toBe(29);
    const plan = await planOf(leeFamily);
    expect(plan).toMatchObject({ status: "pending", payments: 4, total_cents: 23001 });
    const rows = await instalmentsOf(plan.id);
    expect(rows.map((r) => r.amount_cents)).toEqual([5751, 5750, 5750, 5750]);
    expect(rows.map((r) => r.status)).toEqual(["started", "scheduled", "scheduled", "scheduled"]);
    expect(rows[0]!.online_payment_id).toBe(data![0]!.payment_id);
    const days = rows.map((r) => Date.parse(`${r.due_on}T00:00:00Z`) / 86400000);
    expect(days.slice(1).map((d, k) => d - days[k]!)).toEqual([14, 14, 14]);
  });

  it("can't be started twice", async () => {
    const { error } = await lee.rpc("start_instalment_plan", {
      p_family: leeFamily,
      p_payments: 2,
    });
    expect(error?.message).toBe("You're already paying in instalments.");
  });

  it("the family and the owner see it; other families and instructors don't", async () => {
    const plan = await planOf(leeFamily);
    for (const c of [lee, owner]) {
      const { data } = await c.from("instalments").select("seq").eq("plan_id", plan.id);
      expect(data).toHaveLength(4);
    }
    for (const c of [ruiz, teacher]) {
      const plans = await c.from("instalment_plans").select("id").eq("family_id", leeFamily);
      expect(plans.data ?? []).toEqual([]);
      const rows = await c.from("instalments").select("id").eq("plan_id", plan.id);
      expect(rows.data ?? []).toEqual([]);
    }
  });

  it("no one changes a plan directly, or does the server's part", async () => {
    const plan = await planOf(leeFamily);
    for (const c of [lee, owner]) {
      const upd = await c
        .from("instalments")
        .update({ amount_cents: 1 })
        .eq("plan_id", plan.id)
        .select("id");
      expect(upd.data ?? []).toEqual([]);
      const ins = await c.from("instalment_plans").insert({
        organisation_id: orgId,
        family_id: leeFamily,
        payments: 2,
        total_cents: 100,
      });
      expect(ins.error?.code).toBe("42501");
      const claim = await c.rpc("claim_due_instalments", { p_limit: 50 });
      expect(claim.error?.code).toBe("42501");
      const settle = await c.rpc("settle_instalment_payment", {
        p_payment: plan.id,
        p_account: acct,
        p_payment_intent: "pi_x",
        p_amount_cents: 1,
        p_status: "paid",
      });
      expect(settle.error?.code).toBe("42501");
      const attach = await c.rpc("attach_plan_payment_method", {
        p_payment: plan.id,
        p_account: acct,
        p_customer: "cus_x",
        p_payment_method: "pm_x",
        p_type: "card",
      });
      expect(attach.error?.code).toBe("42501");
    }
  });
});

describe("paying by instalments", () => {
  it("the first payment saves the card and starts the plan", async () => {
    const plan = await planOf(leeFamily);
    const [first] = await instalmentsOf(plan.id);
    expect(await payFirst(first!.online_payment_id!, 5751)).toBe("paid");
    expect(await planOf(leeFamily)).toMatchObject({
      status: "active",
      payment_method_id: `pm_saved${run}`,
      payment_method_type: "card",
    });
    expect(await balance(leeFamily)).toBe(23001 - 5751);
    // The rest is in the plan, so there's nothing else to pay now.
    const { error } = await lee.rpc("start_online_payment", { p_family: leeFamily });
    expect(error?.hint).toBe("nothing_owing");
    // Reminders and "overdue" skip what the plan will take.
    const { data: dues } = await admin.rpc("family_dues", { p_family: leeFamily });
    expect(dues![0]).toMatchObject({ owing_cents: 0, overdue_cents: 0 });
  });

  it("nothing is taken before its date", async () => {
    expect(await claimOurs()).toEqual([]);
  });

  it("on its date the server takes it from the saved card, once", async () => {
    const plan = await planOf(leeFamily);
    await makeDue(plan.id, 2);
    const claimed = await claimOurs();
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      amount_cents: 5750,
      platform_fee_cents: 29,
      stripe_customer_id: `cus_lee${run}`,
      payment_method_id: `pm_saved${run}`,
      school_name: "Instalments Test Swim",
    });
    expect(await claimOurs()).toEqual([]);

    const paymentId = claimed[0]!.payment_id!;
    // Messages for another account, or another amount, change nothing.
    expect(
      await handle(intentEvent("payment_intent.succeeded", paymentId, 5750, "acct_someone")),
    ).toBe("ignored");
    expect(await handle(intentEvent("payment_intent.succeeded", paymentId, 1, acct))).toBe(
      "ignored",
    );
    expect(await handle(intentEvent("payment_intent.succeeded", paymentId, 5750))).toBe("paid");
    expect(await handle(intentEvent("payment_intent.succeeded", paymentId, 5750))).toBe("paid");
    expect(await balance(leeFamily)).toBe(23001 - 5751 - 5750);
    const rows = await instalmentsOf(plan.id);
    expect(rows.map((r) => r.status)).toEqual(["paid", "paid", "scheduled", "scheduled"]);
    const { data: receipt } = await admin
      .from("email_deliveries")
      .select("kind")
      .eq("dedupe_key", `receipt:${paymentId}`);
    expect(receipt).toEqual([{ kind: "payment_receipt" }]);
  });

  it("a page payment's own messages aren't taken for an instalment", async () => {
    const plan = await planOf(leeFamily);
    const [first] = await instalmentsOf(plan.id);
    expect(
      await handle(intentEvent("payment_intent.payment_failed", first!.online_payment_id!, 5751)),
    ).toBe("ignored");
    expect((await planOf(leeFamily)).status).toBe("active");
  });

  it("a failed instalment ends the plan: the rest is simply owed, and the parent is told", async () => {
    const plan = await planOf(leeFamily);
    await makeDue(plan.id, 3);
    const [claimed] = await claimOurs();
    expect(
      await handle(intentEvent("payment_intent.payment_failed", claimed!.payment_id!, 5750)),
    ).toBe("failed");
    expect((await planOf(leeFamily)).status).toBe("stopped");
    const rows = await instalmentsOf(plan.id);
    expect(rows.map((r) => r.status)).toEqual(["paid", "paid", "failed", "cancelled"]);
    const { data: told } = await admin
      .from("email_deliveries")
      .select("kind")
      .eq("dedupe_key", `failed:${claimed!.payment_id}`);
    expect(told).toEqual([{ kind: "payment_failed" }]);
    // All of what's left can now be paid in one go.
    const { data } = await lee.rpc("start_online_payment", { p_family: leeFamily });
    expect(data![0]!.amount_cents).toBe(23001 - 5751 - 5750);
    await admin
      .from("online_payments")
      .update({ status: "expired" })
      .eq("id", data![0]!.payment_id);
  });
});

describe("finishing a plan", () => {
  it("a plan whose instalments are all paid is completed", async () => {
    const { data } = await lee.rpc("start_instalment_plan", {
      p_family: leeFamily,
      p_payments: 2,
    });
    expect(data![0]!.amount_cents).toBe(5750);
    await payFirst(data![0]!.payment_id, 5750);
    const plan = await planOf(leeFamily);
    expect(plan.status).toBe("active");
    await makeDue(plan.id, 2);
    const [claimed] = await claimOurs();
    expect(await handle(intentEvent("payment_intent.processing", claimed!.payment_id!, 5750))).toBe(
      "processing",
    );
    expect(await handle(intentEvent("payment_intent.succeeded", claimed!.payment_id!, 5750))).toBe(
      "paid",
    );
    expect((await planOf(leeFamily)).status).toBe("completed");
    expect(await balance(leeFamily)).toBe(0);
  });

  it("paying the rest ends the plan only once it's paid", async () => {
    await charge(leeFamily, 20000);
    const { data } = await lee.rpc("start_instalment_plan", {
      p_family: leeFamily,
      p_payments: 2,
    });
    await payFirst(data![0]!.payment_id, 10000);
    const plan = await planOf(leeFamily);
    expect(plan.status).toBe("active");
    const { data: dues } = await lee.rpc("family_owing", { p_family: leeFamily });
    expect(dues![0]).toEqual({ owing_now: 0, owing_with_plan: 10000 });
    const other = await ruiz.rpc("pay_rest_of_plan", { p_family: leeFamily });
    expect(other.error?.code).toBe("42501");

    // The page opens, and is left: the plan carries on.
    const rest = await lee.rpc("pay_rest_of_plan", { p_family: leeFamily });
    expect(rest.error).toBeNull();
    const restId = rest.data![0]!.payment_id;
    expect(rest.data![0]!.amount_cents).toBe(10000);
    const sessionId = `cs_rest_${restId.slice(0, 8)}`;
    await admin.rpc("attach_checkout_session", { p_payment: restId, p_session: sessionId });
    expect((await planOf(leeFamily)).status).toBe("active");
    // While the page is open, the server doesn't take an instalment too.
    await makeDue(plan.id, 2);
    expect(await claimOurs()).toEqual([]);
    expect(
      await handle(
        event("checkout.session.expired", {
          id: sessionId,
          object: "checkout.session",
          amount_total: 10000,
          payment_status: "unpaid",
          metadata: { ovyko_payment_id: restId },
        }),
      ),
    ).toBe("expired");
    expect((await planOf(leeFamily)).status).toBe("active");

    // Again, and paid this time: the plan ends, with nothing more taken.
    const again = await lee.rpc("pay_rest_of_plan", { p_family: leeFamily });
    const againId = again.data![0]!.payment_id;
    expect(await payFirst(againId, 10000)).toBe("paid");
    expect((await planOf(leeFamily)).status).toBe("stopped");
    expect((await instalmentsOf(plan.id)).map((r) => r.status)).toEqual(["paid", "cancelled"]);
    expect(await claimOurs()).toEqual([]);
    expect(await balance(leeFamily)).toBe(0);
  });
});

// A second family of Lee's for each case below, owing what it's given.
async function freshFamily(cents: number) {
  const { data: fam, error } = await admin
    .from("families")
    .insert({ organisation_id: orgId, display_name: `Instalments extra ${Math.random()}` })
    .select("id")
    .single();
  if (error) throw error;
  const { data: me } = await admin.from("users").select("id").eq("email", emails.lee).single();
  await admin.from("family_members").insert({
    family_id: fam!.id,
    user_id: me!.id,
    relationship: "parent",
    is_primary_guardian: true,
  });
  await charge(fam!.id, cents);
  return fam!.id as string;
}

async function startPlan(family: string, payments: number) {
  const { data, error } = await lee.rpc("start_instalment_plan", {
    p_family: family,
    p_payments: payments,
  });
  if (error) throw error;
  return data![0]!;
}

describe("when things change or go wrong", () => {
  it("never takes more than the family still owes", async () => {
    const family = await freshFamily(40000);
    const first = await startPlan(family, 4);
    await payFirst(first.payment_id, 10000);
    const plan = await planOf(family);
    // The school takes $250 off (a voucher, say): $50 is left.
    const { error } = await owner.rpc("add_account_line", {
      p_family: family,
      p_kind: "credit",
      p_amount_cents: 25000,
      p_reason: "Voucher",
    });
    expect(error).toBeNull();
    const { data: dues } = await lee.rpc("family_owing", { p_family: family });
    expect(dues![0]).toEqual({ owing_now: 0, owing_with_plan: 5000 });
    await makeDue(plan.id, 2);
    const [claimed] = await claimOurs();
    expect(claimed!.amount_cents).toBe(5000);
    expect(await handle(intentEvent("payment_intent.succeeded", claimed!.payment_id!, 5000))).toBe(
      "paid",
    );
    // Nothing left: the next date ends the plan instead of charging.
    await makeDue(plan.id, 3);
    expect(await claimOurs()).toEqual([]);
    expect((await planOf(family)).status).toBe("stopped");
    expect((await instalmentsOf(plan.id)).map((r) => [r.amount_cents, r.status])).toEqual([
      [10000, "paid"],
      [5000, "paid"],
      [10000, "cancelled"],
      [10000, "cancelled"],
    ]);
    expect(await balance(family)).toBe(0);
  });

  it("a first payment that saved nothing Ovyko can use ends the plan", async () => {
    const family = await freshFamily(20000);
    const first = await startPlan(family, 2);
    const sessionId = `cs_nosave_${first.payment_id.slice(0, 8)}`;
    await admin.rpc("attach_checkout_session", {
      p_payment: first.payment_id,
      p_session: sessionId,
    });
    const nothingSaved = { ...lookups, savedPaymentMethod: async () => null };
    const outcome = await handleStripeEvent(
      admin,
      event("checkout.session.completed", {
        id: sessionId,
        object: "checkout.session",
        amount_total: 10000,
        payment_status: "paid",
        payment_intent: `pi_nosave_${first.payment_id.slice(0, 8)}`,
        customer: `cus_nosave${run}`,
        metadata: { ovyko_payment_id: first.payment_id },
      }),
      nothingSaved,
    );
    expect(outcome).toBe("paid");
    expect((await planOf(family)).status).toBe("stopped");
    // What's left is owed now, not hidden behind the plan.
    const { data: dues } = await lee.rpc("family_owing", { p_family: family });
    expect(dues![0]!.owing_now).toBe(10000);
  });

  it("a payment whose outcome never came back is tried again, never charged twice", async () => {
    const family = await freshFamily(20000);
    const first = await startPlan(family, 2);
    await payFirst(first.payment_id, 10000);
    const plan = await planOf(family);
    await makeDue(plan.id, 2);
    const [claimed] = await claimOurs();
    // No answer from Stripe: it isn't tried again straight away...
    expect(await claimOurs()).toEqual([]);
    // ...but after 15 minutes, with the same payment (and so the same
    // idempotency key for Stripe).
    await admin
      .from("online_payments")
      .update({ updated_at: new Date(Date.now() - 20 * 60_000).toISOString() })
      .eq("id", claimed!.payment_id!);
    const [retried] = await claimOurs();
    expect(retried!.payment_id).toBe(claimed!.payment_id);
    // Meanwhile it doesn't count as owing.
    const { data: dues } = await lee.rpc("family_owing", { p_family: family });
    expect(dues![0]!.owing_with_plan).toBe(0);
  });

  it("a failure recorded without Stripe's reference gives way to Stripe's word that it was paid", async () => {
    const family = await freshFamily(20000);
    const first = await startPlan(family, 2);
    await payFirst(first.payment_id, 10000);
    const plan = await planOf(family);
    await makeDue(plan.id, 2);
    const [claimed] = await claimOurs();
    const failed = await admin.rpc("settle_instalment_payment", {
      p_payment: claimed!.payment_id!,
      p_account: acct,
      p_payment_intent: `failed:${claimed!.payment_id}`,
      p_amount_cents: 10000,
      p_status: "failed",
    });
    expect(failed.data).toBe("failed");
    expect(await handle(intentEvent("payment_intent.succeeded", claimed!.payment_id!, 10000))).toBe(
      "paid",
    );
    expect(await balance(family)).toBe(0);
  });

  it("a late 'on its way' message doesn't bring back a failed payment", async () => {
    const family = await freshFamily(20000);
    const first = await startPlan(family, 2);
    await payFirst(first.payment_id, 10000);
    const plan = await planOf(family);
    await makeDue(plan.id, 2);
    const [claimed] = await claimOurs();
    const id = claimed!.payment_id!;
    expect(await handle(intentEvent("payment_intent.payment_failed", id, 10000))).toBe("failed");
    expect(await handle(intentEvent("payment_intent.processing", id, 10000))).toBe("failed");
    const { data: dues } = await lee.rpc("family_owing", { p_family: family });
    expect(dues![0]!.owing_now).toBe(10000);
  });
});
