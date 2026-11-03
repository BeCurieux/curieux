import { describe, expect, it } from "vitest";
import {
  planEmails,
  type PlanCustomer,
  type PlanInput,
  type PlanLead,
  type PlanOrder,
} from "@/lib/email/plan";
import { loadTemplate, renderEmail, TEMPLATES } from "@/lib/email/templates";
import {
  decodeEmail,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribe,
} from "@/lib/email/unsubscribe";

const NOW = new Date("2026-11-20T09:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const order = (o: Partial<PlanOrder> & Pick<PlanOrder, "id">): PlanOrder => ({
  userId: "u1",
  tier: "module0",
  status: "paid",
  createdAt: daysAgo(0),
  refundedAt: null,
  ...o,
});
const buyer = (c: Partial<PlanCustomer> = {}): PlanCustomer => ({
  userId: "u1",
  email: "ava@example.test",
  tier: "module0",
  suppressed: false,
  ...c,
});
const lead = (l: Partial<PlanLead> = {}): PlanLead => ({
  email: "lee@example.test",
  firstSeen: daysAgo(0),
  bought: false,
  suppressed: false,
  ...l,
});
const plan = (input: Partial<PlanInput>) =>
  planEmails({ now: NOW, orders: [], customers: [], leads: [], sent: new Set(), ...input }).map(
    (e) => e.key,
  );

describe("planEmails", () => {
  it("a Module 0 purchase today: receipt and onboarding email 1", () => {
    expect(plan({ orders: [order({ id: "o1" })], customers: [buyer()] })).toEqual([
      "receipt:o1",
      "onboarding_1",
    ]);
  });

  it("founding also gets how to send the verdict for review", () => {
    expect(
      plan({
        orders: [order({ id: "o1", tier: "founding" })],
        customers: [buyer({ tier: "founding" })],
      }),
    ).toEqual(["receipt:o1", "founding_welcome:o1", "onboarding_1"]);
  });

  it("the benchmark pack alone gets a receipt but no onboarding", () => {
    expect(
      plan({
        orders: [order({ id: "o1", tier: "benchmark_pack" })],
        customers: [buyer({ tier: "free" })],
      }),
    ).toEqual(["receipt:o1"]);
  });

  it("never sends what's already been claimed", () => {
    const sent = new Set(["u1|receipt:o1", "u1|onboarding_1"]);
    expect(plan({ orders: [order({ id: "o1" })], customers: [buyer()], sent })).toEqual([]);
  });

  it("onboarding on days 0, 2, 5, 10 and 14, one per run", () => {
    const at = (age: number, done: number) =>
      plan({
        orders: [order({ id: "o1", createdAt: daysAgo(age) })],
        customers: [buyer()],
        sent: new Set([
          "u1|receipt:o1",
          ...Array.from({ length: done }, (_, i) => `u1|onboarding_${i + 1}`),
        ]),
      });
    expect(at(1, 1)).toEqual([]);
    expect(at(2, 1)).toEqual(["onboarding_2"]);
    expect(at(5, 2)).toEqual(["onboarding_3"]);
    expect(at(10, 3)).toEqual(["onboarding_4"]);
    expect(at(14, 4)).toEqual(["onboarding_5"]);
    expect(at(20, 5)).toEqual([]);
    // Missed runs catch up one a day, not all at once.
    expect(at(14, 1)).toEqual(["onboarding_2"]);
  });

  it("a refund sends a confirmation and stops onboarding", () => {
    const refunded = order({
      id: "o1",
      status: "refunded",
      createdAt: daysAgo(3),
      refundedAt: daysAgo(0),
    });
    expect(
      plan({
        orders: [refunded],
        customers: [buyer({ tier: "free" })],
        sent: new Set(["u1|receipt:o1", "u1|onboarding_1"]),
      }),
    ).toEqual(["refund:o1"]);
    // Refunded before the receipt went: no receipt.
    expect(
      plan({
        orders: [{ ...refunded, createdAt: daysAgo(0) }],
        customers: [buyer({ tier: "free" })],
      }),
    ).toEqual(["refund:o1"]);
  });

  it("unsubscribing stops onboarding, not receipts", () => {
    expect(
      plan({ orders: [order({ id: "o1" })], customers: [buyer({ suppressed: true })] }),
    ).toEqual(["receipt:o1"]);
  });

  it("doesn't chase receipts older than a week", () => {
    expect(
      plan({
        orders: [order({ id: "o1", createdAt: daysAgo(8) })],
        customers: [buyer()],
        sent: new Set(["u1|onboarding_1", "u1|onboarding_2", "u1|onboarding_3"]),
      }),
    ).toEqual([]);
  });

  it("nudges a lead on days 2, 5 and 9, until she buys or unsubscribes", () => {
    const at = (age: number, done: number, extra: Partial<PlanLead> = {}) =>
      plan({
        leads: [lead({ firstSeen: daysAgo(age), ...extra })],
        sent: new Set(Array.from({ length: done }, (_, i) => `lee@example.test|nudge_${i + 1}`)),
      });
    expect(at(1, 0)).toEqual([]);
    expect(at(2, 0)).toEqual(["nudge_1"]);
    expect(at(5, 1)).toEqual(["nudge_2"]);
    expect(at(9, 2)).toEqual(["nudge_3"]);
    expect(at(12, 3)).toEqual([]);
    expect(at(5, 1, { bought: true })).toEqual([]);
    expect(at(5, 1, { suppressed: true })).toEqual([]);
  });
});

describe("unsubscribe links", () => {
  const secret = "test-secret";
  it("are signed per address and survive the round trip", () => {
    const url = new URL(unsubscribeUrl("https://course.example", "Ava@Example.test", secret));
    const email = decodeEmail(url.searchParams.get("e")!);
    expect(email).toBe("ava@example.test");
    expect(verifyUnsubscribe(email!, url.searchParams.get("t")!, secret)).toBe(true);
  });
  it("can't be reused for another address or forged", () => {
    const token = unsubscribeToken("ava@example.test", secret);
    expect(verifyUnsubscribe("bea@example.test", token, secret)).toBe(false);
    expect(verifyUnsubscribe("ava@example.test", token, "other-secret")).toBe(false);
    expect(verifyUnsubscribe("ava@example.test", "short", secret)).toBe(false);
    expect(decodeEmail("not-base64-email")).toBeNull();
  });
});

describe("email templates", () => {
  const vars: Record<string, string> = {
    first_name: "Ava",
    learn_url: "https://c.example/learn",
    lesson_0_2_url: "https://c.example/learn/module-0/lesson-0-2",
    account_url: "https://c.example/account",
    verdict_url: "https://c.example/verdict",
    pricing_url: "https://c.example/pricing",
    check_url: "https://c.example/check",
    support_email: "help@example.test",
    magic_link: "https://c.example/auth/confirm?token_hash=abc&type=magiclink",
    product: "Module 0",
    amount: "A$49.00",
    date: "20 November 2026",
    verdict: "Amber",
    next_step: "Raise the margin.",
    refund_days: "14",
    "price:module-0": "A$49",
    "price:course": "A$250",
    "price:course-with-credit": "A$201",
    "price:founding": "A$349",
    "price:benchmark-pack": "A$29",
    founding_places: "30",
  };

  it.each(TEMPLATES)(
    "%s renders, fills every token, and unsubscribes only if it's marketing",
    async (id) => {
      const template = await loadTemplate(id);
      const email = await renderEmail(template, vars, {
        appUrl: "https://c.example",
        unsubscribeUrl: "https://c.example/unsubscribe?e=x&t=y",
      });
      expect(email.subject).not.toMatch(/\{\{/);
      expect(email.html).not.toMatch(/\{\{/);
      expect(email.text).toContain("Ava");
      expect(email.html.includes("https://c.example/unsubscribe?e=x&amp;t=y")).toBe(
        template.kind === "marketing",
      );
    },
  );

  it("the sequences the spec lists are marketing; receipts, refunds and sign-in links aren't", async () => {
    const kinds = Object.fromEntries(
      await Promise.all(TEMPLATES.map(async (id) => [id, (await loadTemplate(id)).kind])),
    );
    for (const id of ["nudge_1", "nudge_2", "nudge_3", "onboarding_1", "onboarding_5"])
      expect(kinds[id], id).toBe("marketing");
    for (const id of ["lead_welcome", "receipt", "refund", "founding_welcome", "verdict_meaning"])
      expect(kinds[id], id).toBe("transactional");
  });

  it("the lead email carries the sign-in link and points to lesson 0.2", async () => {
    const email = await renderEmail(await loadTemplate("lead_welcome"), vars, {
      appUrl: "https://c.example",
    });
    expect(email.html).toContain("token_hash=abc");
    expect(email.text).toMatch(/lesson 0\.2/i);
  });

  it("the verdict email has a next step for every colour", async () => {
    const template = await loadTemplate("verdict_meaning");
    expect(Object.keys(template.nextSteps).sort()).toEqual(["amber", "green", "none", "red"]);
  });
});
