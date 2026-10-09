/**
 * Mass units, and only mass units.
 *
 * International Units are not converted: the factor depends on the nutrient
 * and on its form (vitamin E has two), and a conversion table in the engine
 * would be a regulatory fact without a citation. An amount in IU is reported
 * as not assessed until the merchant gives it in mass.
 */

import type { MassUnit } from "./rules.js";

const MICROGRAMS: Record<MassUnit, number> = { g: 1_000_000, mg: 1_000, "µg": 1 };

/** Spellings a label or a catalogue uses for the three units. */
const ALIASES: Record<string, MassUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  "µg": "µg",
  "μg": "µg", // Greek mu, which is a different code point from the micro sign
  mcg: "µg",
  ug: "µg",
  microgram: "µg",
  micrograms: "µg",
};

export function massUnit(unit: string | undefined): MassUnit | null {
  if (!unit) return null;
  return ALIASES[unit.trim().toLowerCase()] ?? ALIASES[unit.trim()] ?? null;
}

export function convert(amount: number, from: MassUnit, to: MassUnit): number {
  return (amount * MICROGRAMS[from]) / MICROGRAMS[to];
}
