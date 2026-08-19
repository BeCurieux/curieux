/**
 * Which markets this product will answer for, and which it refuses to.
 *
 * The launch set is AU, US and EU. The refusal in `packFor` is the important
 * half of this file. A scanner asked about a market it has no rules for has
 * exactly one honest answer, and "100, nothing found" is not it — that is a
 * badge earned against silence, on a page nobody read, in a market nobody
 * wrote down. So a jurisdiction with no pack throws, and the toggle for it
 * does not exist in the UI until the pack does.
 */

import { auPack } from "../packs/au.js";
import { euEcgtPack } from "../packs/eu-ecgt.js";
import { usFtcPack } from "../packs/us-ftc.js";
import type { Jurisdiction, Rule, RulePack } from "./types.js";

const PACKS: Partial<Record<Jurisdiction, RulePack>> = {
  AU: auPack,
  US: usFtcPack,
  EU: euEcgtPack,
};

export class UnsupportedJurisdictionError extends Error {
  constructor(readonly jurisdiction: Jurisdiction) {
    super(
      `No rule pack for ${jurisdiction}. Supported: ${supportedJurisdictions().join(", ")}. ` +
        `A market with no rules cannot be scanned, and must not be scored as clean.`,
    );
    this.name = "UnsupportedJurisdictionError";
  }
}

export function supportedJurisdictions(): Jurisdiction[] {
  return Object.keys(PACKS) as Jurisdiction[];
}

export function isSupported(jurisdiction: Jurisdiction): boolean {
  return PACKS[jurisdiction] !== undefined;
}

export function packFor(jurisdiction: Jurisdiction): RulePack {
  const pack = PACKS[jurisdiction];
  if (!pack) throw new UnsupportedJurisdictionError(jurisdiction);
  return pack;
}

export function allPacks(): RulePack[] {
  return supportedJurisdictions().map(packFor);
}

export function allRules(): Rule[] {
  return allPacks().flatMap((pack) => pack.rules);
}

export function ruleById(id: string): Rule | undefined {
  return allRules().find((rule) => rule.id === id);
}
