import type { TemplateId } from "./templates";

// What's due to send (SPEC.md → Email). Pure: it takes the state of orders,
// customers and leads, and what's already been sent, and returns the emails
// owed now. The daily cron runs it for everyone; a purchase or refund runs
// it straight away for that customer. email_events makes repeats harmless.
//
//   receipt              each paid order (module0 and up get onboarding too)
//   founding_welcome     each founding order: how to send the verdict for review
//   refund               each refunded order
//   onboarding_1..5      days 0, 2, 5, 10, 14 after her first Module 0+ purchase,
//                        while she still has Module 0+ and hasn't unsubscribed
//   nudge_1..3           days 2, 5, 9 after a lead signed up, unless she has
//                        since bought Module 0+ or unsubscribed
//
// One onboarding or nudge email per person per run: if the cron misses a
// day, she gets the next one tomorrow, not three at once. Receipts and
// refunds older than RECENT_DAYS aren't chased.

export const ONBOARDING_DAYS = [0, 2, 5, 10, 14] as const;
export const NUDGE_DAYS = [2, 5, 9] as const;
export const RECENT_DAYS = 7;
const DAY = 86_400_000;

export interface PlanOrder {
  id: string;
  userId: string;
  tier: "module0" | "course" | "founding" | "benchmark_pack";
  status: "paid" | "refunded";
  createdAt: string;
  refundedAt: string | null;
}

export interface PlanCustomer {
  userId: string;
  email: string;
  /** Effective tier now (refunds already taken away). */
  tier: "free" | "module0" | "course" | "founding";
  suppressed: boolean;
}

export interface PlanLead {
  email: string;
  firstSeen: string;
  /** The account with this email has Module 0 or more. */
  bought: boolean;
  suppressed: boolean;
}

export interface PlannedEmail {
  template: TemplateId;
  /** What email_events.template stores: unique per recipient. */
  key: string;
  to: { userId: string; email: string } | { leadEmail: string };
  orderId?: string;
}

export interface PlanInput {
  now: Date;
  orders: PlanOrder[];
  customers: PlanCustomer[];
  leads: PlanLead[];
  /** `${userId or lead email}|${key}` for everything already claimed. */
  sent: Set<string>;
}

const PAID_TIERS = new Set(["module0", "course", "founding"]);

export function planEmails({ now, orders, customers, leads, sent }: PlanInput): PlannedEmail[] {
  const due: PlannedEmail[] = [];
  const t = now.getTime();
  const recent = (iso: string | null) =>
    iso !== null && t - new Date(iso).getTime() <= RECENT_DAYS * DAY;
  const has = (recipient: string, key: string) => sent.has(`${recipient}|${key}`);
  const byUser = new Map(customers.map((c) => [c.userId, c]));

  for (const order of orders) {
    const customer = byUser.get(order.userId);
    if (!customer) continue;
    const to = { userId: customer.userId, email: customer.email };
    // A receipt for something refunded before we got to it would only confuse.
    if (order.status === "paid" && recent(order.createdAt)) {
      if (!has(customer.userId, `receipt:${order.id}`))
        due.push({ template: "receipt", key: `receipt:${order.id}`, to, orderId: order.id });
      if (order.tier === "founding" && !has(customer.userId, `founding_welcome:${order.id}`))
        due.push({
          template: "founding_welcome",
          key: `founding_welcome:${order.id}`,
          to,
          orderId: order.id,
        });
    }
    if (
      order.status === "refunded" &&
      recent(order.refundedAt) &&
      !has(customer.userId, `refund:${order.id}`)
    )
      due.push({ template: "refund", key: `refund:${order.id}`, to, orderId: order.id });
  }

  for (const customer of customers) {
    if (customer.suppressed || !PAID_TIERS.has(customer.tier)) continue;
    const anchors = orders
      .filter((o) => o.userId === customer.userId && o.status === "paid" && PAID_TIERS.has(o.tier))
      .map((o) => new Date(o.createdAt).getTime());
    if (!anchors.length) continue;
    const start = Math.min(...anchors);
    const next = ONBOARDING_DAYS.findIndex(
      (day, i) => t >= start + day * DAY && !has(customer.userId, `onboarding_${i + 1}`),
    );
    if (next >= 0)
      due.push({
        template: `onboarding_${next + 1}` as TemplateId,
        key: `onboarding_${next + 1}`,
        to: { userId: customer.userId, email: customer.email },
      });
  }

  for (const lead of leads) {
    if (lead.suppressed || lead.bought) continue;
    const start = new Date(lead.firstSeen).getTime();
    const next = NUDGE_DAYS.findIndex(
      (day, i) => t >= start + day * DAY && !has(lead.email, `nudge_${i + 1}`),
    );
    if (next >= 0)
      due.push({
        template: `nudge_${next + 1}` as TemplateId,
        key: `nudge_${next + 1}`,
        to: { leadEmail: lead.email },
      });
  }

  return due;
}
