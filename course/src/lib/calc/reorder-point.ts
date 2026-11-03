import type { Calculator } from "./types";

// Reorder Point (course). SPEC.md: daily velocity, lead time, safety days →
// reorder at N units, order quantity for 60 days. Whole units, rounded up.
//   reorder at = velocity × (lead time + safety days)
//   order quantity = velocity × 60

export interface ReorderPointInputs {
  [key: string]: unknown;
  daily_velocity: number;
  lead_time_days: number;
  safety_days: number;
}

export interface ReorderPointOutputs {
  [key: string]: unknown;
  reorder_at: number;
  order_quantity: number;
}

const units = (value: number) => Math.ceil(value - 1e-9);

export const reorderPoint: Calculator<ReorderPointInputs, ReorderPointOutputs> = {
  slug: "reorder-point",
  name: "Reorder Point",
  description: "When to reorder so you don't run out, and how much.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    { key: "daily_velocity", label: "Units sold per day", kind: "number" },
    { key: "lead_time_days", label: "Lead time", kind: "days" },
    { key: "safety_days", label: "Safety days", kind: "days", default: 14 },
  ],
  outputs: [
    { key: "reorder_at", label: "Reorder when stock reaches", kind: "integer" },
    { key: "order_quantity", label: "Order quantity (60 days)", kind: "integer" },
  ],
  compute: (i) => ({
    reorder_at: units(i.daily_velocity * (i.lead_time_days + i.safety_days)),
    order_quantity: units(i.daily_velocity * 60),
  }),
  sentence: (o) =>
    `Reorder when you're down to ${o.reorder_at} units, and order ${o.order_quantity}.`,
};
