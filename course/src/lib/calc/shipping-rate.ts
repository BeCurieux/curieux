import type { Calculator } from "./types";

// Shipping Rate (course). SPEC.md: zones, weights, carrier rates → what to
// charge per zone to break even on shipping. Break-even includes packing
// materials and the payment fee taken on the shipping charge itself:
//   charge = (carrier rate + packaging) ÷ (1 − payment fee)

export interface ShippingRateInputs {
  [key: string]: unknown;
  packaging_per_parcel: number;
  payment_fee_pct: number;
  zones: { zone: string; weight_kg: number; carrier_rate: number }[];
}

export interface ShippingRateOutputs {
  [key: string]: unknown;
  zones: { zone: string; weight_kg: number; carrier_rate: number; charge: number }[];
}

export const shippingRate: Calculator<ShippingRateInputs, ShippingRateOutputs> = {
  slug: "shipping-rate",
  name: "Shipping Rate",
  description: "What to charge for shipping in each zone so it costs you nothing.",
  minTier: "course",
  moduleNumber: null,
  fields: [
    { key: "packaging_per_parcel", label: "Packaging per parcel", kind: "money", default: 0 },
    { key: "payment_fee_pct", label: "Payment fee", kind: "percent", default: 2.9, max: 99 },
    {
      key: "zones",
      label: "Zones",
      kind: "rows",
      item: "zone",
      minRows: 1,
      maxRows: 10,
      fields: [
        { key: "zone", label: "Zone", kind: "text", maxLength: 60 },
        { key: "weight_kg", label: "Weight (kg)", kind: "number" },
        { key: "carrier_rate", label: "Carrier rate", kind: "money" },
      ],
    },
  ],
  outputs: [],
  tables: [
    {
      key: "zones",
      label: "Charge per zone",
      columns: [
        { key: "zone", label: "Zone", kind: "text" },
        { key: "weight_kg", label: "kg", kind: "number" },
        { key: "carrier_rate", label: "Carrier", kind: "money" },
        { key: "charge", label: "Charge", kind: "money" },
      ],
    },
  ],
  compute: (i) => ({
    zones: i.zones.map((z) => ({
      ...z,
      charge: (z.carrier_rate + i.packaging_per_parcel) / (1 - i.payment_fee_pct / 100),
    })),
  }),
};
