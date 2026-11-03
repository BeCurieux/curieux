import "server-only";
import { formatMoney, type Currency } from "@/lib/calc/format";
import { serviceClient } from "@/lib/supabase/server";
import { planEmails, RECENT_DAYS, type PlanCustomer, type PlanLead, type PlanOrder } from "./plan";
import { sendEmail, type SendOutcome } from "./send";

// Loads what planEmails needs, then sends what's due. The daily cron runs it
// for everyone; a purchase or a refund runs it for that one customer, so her
// receipt and first onboarding email go now rather than tomorrow.

const LOOKBACK_DAYS = 30;
const DAY = 86_400_000;

interface OrderRow {
  id: string;
  user_id: string | null;
  status: "paid" | "refunded";
  created_at: string;
  refunded_at: string | null;
  amount_cents: number;
  currency: string;
  products: { name: string; tier: PlanOrder["tier"] } | null;
}

export async function sweepEmails(options: { userId?: string; now?: Date } = {}) {
  const db = serviceClient();
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY).toISOString();

  let ordersQuery = db
    .from("orders")
    .select(
      "id, user_id, status, created_at, refunded_at, amount_cents, currency, products!orders_product_id_fkey(name, tier)",
    )
    .or(`created_at.gte.${since},refunded_at.gte.${since}`);
  if (options.userId) ordersQuery = ordersQuery.eq("user_id", options.userId);
  const { data: orderRows, error } = await ordersQuery.returns<OrderRow[]>();
  if (error) throw new Error(`orders: ${error.message}`);
  const orders = orderRows.filter((o) => o.user_id && o.products);

  const userIds = [...new Set(orders.map((o) => o.user_id!))];
  const leadsRows = options.userId
    ? []
    : ((
        await db
          .from("leads")
          .select("email, first_seen, converted_user_id")
          .gte("first_seen", new Date(now.getTime() - 21 * DAY).toISOString())
      ).data ?? []);
  const convertedIds = [
    ...new Set(leadsRows.map((l) => l.converted_user_id).filter((id): id is string => Boolean(id))),
  ];
  const allIds = [...new Set([...userIds, ...convertedIds])];

  const profiles = allIds.length
    ? ((await db.from("profiles").select("user_id, email").in("user_id", allIds)).data ?? [])
    : [];
  const tiers = new Map<string, PlanCustomer["tier"]>();
  for (const id of allIds) {
    const { data } = await db.rpc("tier_of", { p_user: id });
    tiers.set(id, (data ?? "free") as PlanCustomer["tier"]);
  }
  const emails = [...profiles.map((p) => p.email.toLowerCase()), ...leadsRows.map((l) => l.email)];
  const suppressed = new Set(
    emails.length
      ? ((await db.from("email_suppressions").select("email").in("email", emails)).data ?? []).map(
          (s) => s.email,
        )
      : [],
  );
  const recipients = [...allIds, ...leadsRows.map((l) => l.email)];
  const sent = new Set(
    recipients.length
      ? (
          (await db.from("email_events").select("recipient, template").in("recipient", recipients))
            .data ?? []
        ).map((e) => `${e.recipient}|${e.template}`)
      : [],
  );

  const customers: PlanCustomer[] = profiles
    .filter((p) => userIds.includes(p.user_id))
    .map((p) => ({
      userId: p.user_id,
      email: p.email,
      tier: tiers.get(p.user_id) ?? "free",
      suppressed: suppressed.has(p.email.toLowerCase()),
    }));
  const leads: PlanLead[] = leadsRows.map((l) => {
    const tier = l.converted_user_id ? tiers.get(l.converted_user_id) : undefined;
    return {
      email: l.email,
      firstSeen: l.first_seen,
      bought: tier === "module0" || tier === "course" || tier === "founding",
      suppressed: suppressed.has(l.email),
    };
  });

  const due = planEmails({
    now,
    orders: orders.map((o) => ({
      id: o.id,
      userId: o.user_id!,
      tier: o.products!.tier,
      status: o.status,
      createdAt: o.created_at,
      refundedAt: o.refunded_at,
    })),
    customers,
    leads,
    sent,
  });

  const results: { key: string; to: string; outcome: SendOutcome }[] = [];
  for (const email of due) {
    const order = email.orderId ? orders.find((o) => o.id === email.orderId) : undefined;
    const vars: Record<string, string> = order
      ? {
          product: order.products!.name,
          amount: formatMoney(order.amount_cents / 100, order.currency.toUpperCase() as Currency),
          date: new Date(
            email.template === "refund" ? order.refunded_at! : order.created_at,
          ).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        }
      : {};
    const outcome = await sendEmail(email.template, email.key, email.to, vars);
    results.push({
      key: email.key,
      to: "leadEmail" in email.to ? email.to.leadEmail : email.to.email,
      outcome,
    });
  }
  return { due: due.length, results, recentDays: RECENT_DAYS };
}
