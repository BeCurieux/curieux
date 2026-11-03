import type { Calculator } from "./types";

// 1. Landed Cost (free). SPEC.md → Calculator specs, exactly:
//   landed cost per unit = unit cost + freight/units + duty (on unit cost +
//     freight share) + packaging + misc/units
//   fee cost per unit at the intended sale price
//   returns allowance per unit = sale price × return rate × 0.5
//   true cost per unit = landed + fees + returns allowance

export interface LandedCostInputs {
  [key: string]: unknown;
  sale_price: number;
  unit_cost: number;
  units_per_order: number;
  freight: number;
  duty_rate: number;
  packaging: number;
  payment_fee_pct: number;
  payment_fixed_fee: number;
  return_rate: number;
  inbound_misc: number;
}

export interface LandedCostOutputs {
  [key: string]: unknown;
  freight_per_unit: number;
  duty_per_unit: number;
  misc_per_unit: number;
  landed_cost: number;
  fees_per_unit: number;
  returns_allowance: number;
  true_cost: number;
}

export const landedCost: Calculator<LandedCostInputs, LandedCostOutputs> = {
  slug: "landed-cost",
  name: "Landed Cost",
  description: "What one unit really costs you once it's here, sold and sometimes sent back.",
  minTier: "free",
  moduleNumber: 0,
  fields: [
    {
      key: "sale_price",
      label: "Intended sale price",
      kind: "money",
      help: "What you plan to charge for one unit.",
    },
    {
      key: "unit_cost",
      label: "Unit cost",
      kind: "money",
      help: "What the supplier charges per unit.",
    },
    { key: "units_per_order", label: "Units per order", kind: "integer", min: 1 },
    {
      key: "freight",
      label: "Freight for the order",
      kind: "money",
      help: "Shipping the whole order to you.",
    },
    { key: "duty_rate", label: "Duty rate", kind: "percent", default: 0, max: 100 },
    { key: "packaging", label: "Packaging per unit", kind: "money", default: 0 },
    { key: "payment_fee_pct", label: "Payment fee", kind: "percent", default: 2.9, max: 100 },
    { key: "payment_fixed_fee", label: "Fixed fee per payment", kind: "money", default: 0.3 },
    { key: "return_rate", label: "Expected return rate", kind: "percent", default: 5, max: 100 },
    {
      key: "inbound_misc",
      label: "Inbound misc for the order",
      kind: "money",
      default: 0,
      help: "Labels, inspection and anything else paid once per order.",
    },
  ],
  outputs: [
    { key: "landed_cost", label: "Landed cost per unit", kind: "money" },
    { key: "fees_per_unit", label: "Payment fees per unit", kind: "money" },
    {
      key: "returns_allowance",
      label: "Returns allowance per unit",
      kind: "money",
      help: "Half the sale price lost on each typical return.",
    },
    { key: "true_cost", label: "True cost per unit", kind: "money" },
  ],
  compute(i) {
    const freight_per_unit = i.freight / i.units_per_order;
    const duty_per_unit = (i.duty_rate / 100) * (i.unit_cost + freight_per_unit);
    const misc_per_unit = i.inbound_misc / i.units_per_order;
    const landed_cost =
      i.unit_cost + freight_per_unit + duty_per_unit + i.packaging + misc_per_unit;
    const fees_per_unit = i.sale_price * (i.payment_fee_pct / 100) + i.payment_fixed_fee;
    const returns_allowance = i.sale_price * (i.return_rate / 100) * 0.5;
    return {
      freight_per_unit,
      duty_per_unit,
      misc_per_unit,
      landed_cost,
      fees_per_unit,
      returns_allowance,
      true_cost: landed_cost + fees_per_unit + returns_allowance,
    };
  },
  sentence: (o, money) => `Each unit really costs you ${money(o.true_cost)}.`,
};
