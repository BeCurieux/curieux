// The Numbers tab (SPEC.md → Admin: today and 7-day — leads, Module 0
// sales, course sales, refunds, conversion lead → buyer). Pure, so the
// definitions are unit-tested:
//
//   leads        leads first seen in the window
//   sales        orders created in the window, by tier (a sale later
//                refunded still counts as a sale; it shows under refunds)
//   refunds      orders refunded in the window
//   conversion   of the leads first seen in the window, how many have an
//                account that has bought Module 0 or more (at any time)
//
// "Today" is today in Sydney, where the business is; "7 days" is today and
// the six days before it.

export const TIME_ZONE = "Australia/Sydney";
const DAY = 86_400_000;

export interface NumbersLead {
  firstSeen: string;
  convertedUserId: string | null;
}

export interface NumbersOrder {
  userId: string | null;
  tier: "module0" | "course" | "founding" | "benchmark_pack";
  createdAt: string;
  refundedAt: string | null;
}

export interface WindowNumbers {
  leads: number;
  module0Sales: number;
  courseSales: number;
  foundingSales: number;
  refunds: number;
  converted: number;
  /** converted ÷ leads, as a whole percentage; null with no leads. */
  conversionPct: number | null;
}

/** Midnight at the start of `now`'s day in the time zone, as a UTC instant. */
export function startOfDay(now: Date, timeZone = TIME_ZONE): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZoneName: "longOffset",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName ?? "");
  const minutes = offset
    ? (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]))
    : 0;
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - minutes * 60_000,
  );
}

const PAID_TIERS = new Set(["module0", "course", "founding"]);

function windowNumbers(
  leads: NumbersLead[],
  orders: NumbersOrder[],
  from: number,
  buyers: Set<string>,
): WindowNumbers {
  const inWindow = (iso: string | null) => iso !== null && new Date(iso).getTime() >= from;
  const windowLeads = leads.filter((l) => inWindow(l.firstSeen));
  const sales = (tier: NumbersOrder["tier"]) =>
    orders.filter((o) => o.tier === tier && inWindow(o.createdAt)).length;
  const converted = windowLeads.filter(
    (l) => l.convertedUserId && buyers.has(l.convertedUserId),
  ).length;
  return {
    leads: windowLeads.length,
    module0Sales: sales("module0"),
    courseSales: sales("course"),
    foundingSales: sales("founding"),
    refunds: orders.filter((o) => inWindow(o.refundedAt)).length,
    converted,
    conversionPct: windowLeads.length ? Math.round((converted / windowLeads.length) * 100) : null,
  };
}

export function computeNumbers(
  leads: NumbersLead[],
  orders: NumbersOrder[],
  now: Date,
  timeZone = TIME_ZONE,
) {
  const today = startOfDay(now, timeZone).getTime();
  // Six local midnights back; computed from a time near midday so a
  // daylight-saving change in the week doesn't shift it by an hour.
  const weekStart = startOfDay(new Date(today + DAY / 2 - 6 * DAY), timeZone).getTime();
  const buyers = new Set(
    orders.filter((o) => o.userId && PAID_TIERS.has(o.tier)).map((o) => o.userId!),
  );
  return {
    today: windowNumbers(leads, orders, today, buyers),
    week: windowNumbers(leads, orders, weekStart, buyers),
  };
}
