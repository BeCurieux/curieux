import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  handleStripeEvent,
  type PlanSubscription,
  type StripeLookups,
} from "@/lib/payments/webhook";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// Ovyko's plan (docs/SUBSCRIPTIONS.md): what schools pay Ovyko. Owners read
// their own school's plan; only the server records it, from Stripe's word.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `plan-${run}-password`;
const createdAuthIds: string[] = [];
const customer = `cus_plan${run}`;
let newOrg: string;
let oldOrg: string;
let owner: Client;

async function newOwner(email: string, org: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Pam Owner" },
  });
  if (error) throw error;
  createdAuthIds.push(data.user.id);
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  await admin
    .from("staff_memberships")
    .insert({ user_id: profile!.id, organisation_id: org, role: "owner" });
  const c = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await c.auth.signInWithPassword({ email, password });
  return c;
}

beforeAll(async () => {
  const insert = async (name: string, slug: string, createdAt: Date) => {
    const { data, error } = await admin
      .from("organisations")
      .insert({
        name,
        slug,
        activity_type: "swimming",
        owner_two_step_required: false,
        created_at: createdAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  newOrg = await insert("New Swim", `plan-new-${run}`, new Date());
  oldOrg = await insert("Old Swim", `plan-old-${run}`, new Date(Date.now() - 40 * 86_400_000));
  owner = await newOwner(`plan.owner.${run}@example.test`, oldOrg);
  await newOwner(`plan.new.${run}@example.test`, newOrg);
});

afterAll(async () => {
  await admin.from("organisations").delete().like("slug", `plan-%-${run}`);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const state = async (c: Client, org: string) =>
  (await c.rpc("school_plan_state", { p_org: org })).data?.[0]?.state;

// Stripe's answer when asked about a subscription (stood in for).
const stripeSubs = new Map<string, PlanSubscription>();
const lookups: StripeLookups = {
  paymentIdForIntent: async () => null,
  accountFlags: async () => ({ charges: false, payouts: false, details: false }),
  subscription: async (id) => stripeSubs.get(id)!,
};
const subEvent = (id: string, account?: string) =>
  ({
    id: `evt_${Math.random()}`,
    type: "customer.subscription.updated",
    account,
    data: { object: { id } },
  }) as unknown as Stripe.Event;
const sub = (id: string, status: string): PlanSubscription => ({
  id,
  customer,
  status,
  locations: 2,
  priceCents: 39900,
  trialEnd: null,
  periodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  cancelAtPeriodEnd: false,
});

describe("the free trial", () => {
  it("a new school is in its 30-day trial; one older without a plan isn't", async () => {
    const s = await signInAs("aquaOwner");
    expect(await state(s.client, "0a000000-0000-4000-8000-000000000001")).toBe("demo");
    expect(await state(owner, oldOrg)).toBe("none");
    const newOwnerClient = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await newOwnerClient.auth.signInWithPassword({
      email: `plan.new.${run}@example.test`,
      password,
    });
    expect(await state(newOwnerClient, newOrg)).toBe("trial");
  });

  it("only the school's owners can see where its plan stands", async () => {
    for (const who of ["aquaOwner", "burrowsParent", "aquaInstructor"] as const) {
      const s = await signInAs(who);
      expect((await s.client.rpc("school_plan_state", { p_org: oldOrg })).error?.code).toBe(
        "42501",
      );
    }
  });
});

describe("recording a school's plan", () => {
  it("only the server records it", async () => {
    expect(
      (await owner.rpc("save_school_customer", { p_org: oldOrg, p_customer: customer })).error
        ?.code,
    ).toBe("42501");
    const { error } = await owner
      .from("school_subscriptions")
      .insert({ organisation_id: oldOrg, stripe_customer_id: customer });
    expect(error?.code).toBe("42501");
    const saved = await admin.rpc("save_school_customer", { p_org: oldOrg, p_customer: customer });
    expect(saved.data).toBe(customer);
  });

  it("Stripe's word on Ovyko's own account sets it; a school's own subscriptions don't", async () => {
    stripeSubs.set("sub_a", sub("sub_a", "active"));
    expect(await handleStripeEvent(admin, subEvent("sub_a", "acct_school"), lookups)).toBe(
      "ignored",
    );
    expect(await state(owner, oldOrg)).toBe("none");
    expect(await handleStripeEvent(admin, subEvent("sub_a"), lookups)).toBe("plan active");
    expect(await state(owner, oldOrg)).toBe("ok");
    const { data } = await owner.from("school_subscriptions").select("status, locations").single();
    expect(data).toEqual({ status: "active", locations: 2 });
  });

  it("a failed payment asks for attention; an old cancelled plan doesn't undo a new one", async () => {
    stripeSubs.set("sub_a", sub("sub_a", "past_due"));
    await handleStripeEvent(admin, subEvent("sub_a"), lookups);
    expect(await state(owner, oldOrg)).toBe("attention");
    stripeSubs.set("sub_b", sub("sub_b", "active"));
    await handleStripeEvent(admin, subEvent("sub_b"), lookups);
    stripeSubs.set("sub_a", sub("sub_a", "canceled"));
    await handleStripeEvent(admin, subEvent("sub_a"), lookups);
    expect(await state(owner, oldOrg)).toBe("ok");
  });

  it("other schools' owners see none of it", async () => {
    const s = await signInAs("aquaOwner");
    expect(
      (await s.client.from("school_subscriptions").select("*").eq("organisation_id", oldOrg)).data,
    ).toEqual([]);
  });
});
