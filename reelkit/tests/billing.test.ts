import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { memoryCredits } from "../src/billing/credits.js";
import { PACKS } from "../src/billing/packs.js";
import { stripeVerifier } from "../src/billing/stripe.js";
import { applyStripeEvent } from "../src/billing/webhook.js";
import { handleCheckout, handleMe, handleWebhook, handleWrite, type Deps } from "../src/server/handlers.js";

const ALICE = { id: "u-alice", email: "alice@example.com" };
const product = { source: "shopify", title: "Ceramic Bud Vase", description: "• Wheel-thrown stoneware\n• Speckled oatmeal glaze", imageCount: 2 };
const goodDraft = [
  { angle: "gift", hook: "A gift for one stem", hookImage: 0, scenes: [{ caption: "Wheel-thrown stoneware", image: 1 }, { caption: "Speckled oatmeal glaze", image: 0 }], cta: "Get yours" },
];

function deps(over: Partial<Deps> = {}): Deps {
  return {
    production: true,
    transport: async () => new Response("", { status: 404 }),
    lookup: async () => ["93.184.216.34"],
    imageSecret: "s",
    viewer: async () => ALICE,
    importLimit: () => true,
    writeLimit: () => true,
    ...over,
  };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://reelkit.test${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

describe("writing ads with credits", () => {
  it("asks a signed-out seller to sign in, and spends nothing", async () => {
    const credits = memoryCredits({ [ALICE.id]: 3 });
    let calls = 0;
    const res = await handleWrite(post("/api/scripts", product), deps({ credits, viewer: async () => null, drafter: async () => (calls++, goodDraft) }));
    expect(res.status).toBe(401);
    expect((await res.json()).signIn).toBe(true);
    expect(calls).toBe(0);
  });

  it("spends one credit for an AI-written set", async () => {
    const credits = memoryCredits({ [ALICE.id]: 3 });
    const res = await handleWrite(post("/api/scripts", product), deps({ credits, drafter: async () => goodDraft }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.credits).toBe(2);
    expect(data.ads.some((a: { by: string }) => a.by === "claude")).toBe(true);
  });

  it("refuses with 402 at zero, without calling the model", async () => {
    const credits = memoryCredits({ [ALICE.id]: 0 });
    let calls = 0;
    const res = await handleWrite(post("/api/scripts", product), deps({ credits, drafter: async () => (calls++, goodDraft), checkout: async () => "" }));
    expect(res.status).toBe(402);
    expect((await res.json()).buy).toBe(true);
    expect(calls).toBe(0);
  });

  it("gives the credit back when the model produced nothing usable", async () => {
    const credits = memoryCredits({ [ALICE.id]: 1 });
    const res = await handleWrite(
      post("/api/scripts", product),
      deps({
        credits,
        drafter: async () => {
          throw new Error("overloaded");
        },
      }),
    );
    const data = await res.json();
    expect(data).toMatchObject({ refunded: true, credits: 1 });
    expect(data.ads).toHaveLength(3);
  });

  it("only lets one of two racing requests spend the last credit", async () => {
    const credits = memoryCredits({ [ALICE.id]: 1 });
    const d = deps({ credits, drafter: async () => goodDraft });
    const statuses = (await Promise.all([handleWrite(post("/api/scripts", product), d), handleWrite(post("/api/scripts", product), d)])).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 402]);
  });

  it("never calls the model in production without accounts in front of it", async () => {
    let calls = 0;
    const res = await handleWrite(post("/api/scripts", product), deps({ drafter: async () => (calls++, goodDraft) }));
    expect(res.status).toBe(200);
    expect((await res.json()).ai).toBe(false);
    expect(calls).toBe(0);
  });

  it("charges nothing when there is no model to pay for", async () => {
    const credits = memoryCredits({ [ALICE.id]: 3 });
    const res = await handleWrite(post("/api/scripts", product), deps({ credits, viewer: async () => null }));
    expect(res.status).toBe(200);
    expect(await credits.balance(ALICE.id)).toBe(3);
  });
});

describe("me", () => {
  it("reports the balance and the packs", async () => {
    const res = await handleMe(new Request("https://reelkit.test/api/me"), deps({ credits: memoryCredits({ [ALICE.id]: 7 }), drafter: async () => [] }));
    const data = await res.json();
    expect(data).toMatchObject({ accounts: true, ai: true, credits: 7, viewer: { email: ALICE.email } });
    expect(data.packs).toHaveLength(PACKS.length);
  });
});

describe("checkout", () => {
  it("starts a session for a real pack, for the signed-in seller", async () => {
    let seen: unknown;
    const d = deps({
      credits: memoryCredits(),
      checkout: async (a) => ((seen = a), "https://checkout.stripe.com/c/pay/cs_test_1"),
      appUrl: "https://reelkit.app",
    });
    const res = await handleCheckout(post("/api/billing/checkout", { pack: "shop" }), d);
    expect((await res.json()).url).toMatch(/checkout\.stripe\.com/);
    expect(seen).toMatchObject({ pack: { id: "shop" }, user: ALICE, origin: "https://reelkit.app" });
  });

  it("refuses a made-up pack and a signed-out buyer", async () => {
    const d = deps({ credits: memoryCredits(), checkout: async () => "x" });
    expect((await handleCheckout(post("/x", { pack: "free-forever" }), d)).status).toBe(400);
    expect((await handleCheckout(post("/x", { pack: "shop" }), { ...d, viewer: async () => null })).status).toBe(401);
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_test_reelkit";
  const stripe = new Stripe("sk_test_unused");
  const verifyWebhook = stripeVerifier(stripe, secret);
  const pack = PACKS[0]!;

  const session = (over: Record<string, unknown> = {}) => ({
    id: "cs_test_abc",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: pack.cents,
    currency: pack.currency,
    client_reference_id: ALICE.id,
    metadata: { user_id: ALICE.id, pack: pack.id },
    ...over,
  });
  const event = (type: string, object: unknown) => JSON.stringify({ id: `evt_${type}`, object: "event", type, data: { object } });
  const signed = (payload: string) => ({ "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret }) });

  it("adds a pack's credits once, however often Stripe delivers it", async () => {
    const credits = memoryCredits({ [ALICE.id]: 3 });
    const d = deps({ credits, verifyWebhook });
    const payload = event("checkout.session.completed", session());
    for (let i = 0; i < 3; i++) {
      const res = await handleWebhook(post("/api/billing/webhook", payload, signed(payload)), d);
      expect(res.status).toBe(200);
    }
    expect(await credits.balance(ALICE.id)).toBe(3 + pack.credits);
  });

  it("rejects a forged or missing signature", async () => {
    const credits = memoryCredits({ [ALICE.id]: 0 });
    const d = deps({ credits, verifyWebhook });
    const payload = event("checkout.session.completed", session());
    const forged = { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" }) };
    expect((await handleWebhook(post("/w", payload, forged), d)).status).toBe(400);
    expect((await handleWebhook(post("/w", payload), d)).status).toBe(400);
    // A body changed after signing.
    const tampered = payload.replace(`"amount_total":${pack.cents}`, `"amount_total":1`);
    expect((await handleWebhook(post("/w", tampered, signed(payload)), d)).status).toBe(400);
    expect(await credits.balance(ALICE.id)).toBe(0);
  });

  it("waits for bank debits to clear before adding credits", async () => {
    const credits = memoryCredits({ [ALICE.id]: 0 });
    const pending = { type: "checkout.session.completed", data: { object: session({ payment_status: "unpaid" }) } } as unknown as Stripe.Event;
    expect(await applyStripeEvent(pending, credits)).toBe("unpaid");
    const cleared = { type: "checkout.session.async_payment_succeeded", data: { object: session() } } as unknown as Stripe.Event;
    expect(await applyStripeEvent(cleared, credits)).toBe("granted");
  });

  it("adds nothing when what was paid isn't what the pack costs", async () => {
    const credits = memoryCredits({ [ALICE.id]: 0 });
    const cheap = { type: "checkout.session.completed", data: { object: session({ amount_total: 1 }) } } as unknown as Stripe.Event;
    expect(await applyStripeEvent(cheap, credits)).toBe("mismatch");
    const unknownPack = { type: "checkout.session.completed", data: { object: session({ metadata: { user_id: ALICE.id, pack: "nope" } }) } } as unknown as Stripe.Event;
    expect(await applyStripeEvent(unknownPack, credits)).toBe("ignored");
    expect(await credits.balance(ALICE.id)).toBe(0);
  });

  it("answers 500 when the database fails, so Stripe tries again", async () => {
    const broken = { ...memoryCredits(), grantPurchase: async () => { throw new Error("db down"); } };
    const payload = event("checkout.session.completed", session());
    const res = await handleWebhook(post("/w", payload, signed(payload)), deps({ credits: broken, verifyWebhook }));
    expect(res.status).toBe(500);
  });
});
