/**
 * The corpus keeps its own house in order.
 *
 * These are the checks that make a rule pack a thing you can hand to somebody
 * else. A rule that never fires, a rule whose id was quietly reused, a rule
 * citing nothing — each is invisible on a score page and each destroys the
 * only thing the score page is selling.
 */

import { describe, expect, it } from "vitest";
import { allPacks, allRules, isSupported, packFor, supportedJurisdictions } from "@/engine/registry.js";
import { findingsFor } from "@/engine/evaluate.js";
import { extractClaims } from "@/extract/deterministic.js";
import { LAUNCH_JURISDICTIONS, CLAIM_CATEGORIES } from "@/engine/types.js";
import { TRIGGERS } from "./fixtures/triggers.js";

const rules = allRules();

describe("the launch set", () => {
  it("ships a pack for every jurisdiction the brief committed to", () => {
    for (const jurisdiction of LAUNCH_JURISDICTIONS) {
      expect(isSupported(jurisdiction), `${jurisdiction} has no pack`).toBe(true);
    }
    expect(supportedJurisdictions().sort()).toEqual([...LAUNCH_JURISDICTIONS].sort());
  });

  it("has a version and a label on every pack", () => {
    for (const pack of allPacks()) {
      expect(pack.version, pack.jurisdiction).toMatch(/^\d{4}\.\d{2}\.\d+$/);
      expect(pack.label.length).toBeGreaterThan(10);
    }
  });
});

describe("rule identity", () => {
  it("gives every rule a unique id", () => {
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps ids kebab-case and prefixed by their market", () => {
    for (const rule of rules) {
      expect(rule.id, rule.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
      expect(rule.id.startsWith(rule.jurisdiction.toLowerCase()), rule.id).toBe(true);
    }
  });

  it("files every rule under the pack that claims it", () => {
    for (const pack of allPacks()) {
      for (const rule of pack.rules) expect(rule.jurisdiction).toBe(pack.jurisdiction);
    }
  });
});

describe("rule content", () => {
  it("names an instrument for every rule", () => {
    for (const rule of rules) {
      expect(rule.citation.instrument.length, rule.id).toBeGreaterThan(3);
      expect(rule.instrumentSays.length, rule.id).toBeGreaterThan(40);
    }
  });

  it("says something about the copy, what to do, and how to rewrite it", () => {
    for (const rule of rules) {
      expect(rule.concern.length, rule.id).toBeGreaterThan(40);
      expect(rule.remedy.length, rule.id).toBeGreaterThan(20);
      expect(rule.rewriteGuidance.length, rule.id).toBeGreaterThan(20);
    }
  });

  it("puts every rule in at least one category from the taxonomy", () => {
    for (const rule of rules) {
      expect(rule.categories.length, rule.id).toBeGreaterThan(0);
      for (const category of rule.categories) expect(CLAIM_CATEGORIES).toContain(category);
    }
  });

  it("titles rules in sentence case without a full stop", () => {
    for (const rule of rules) {
      expect(rule.title.endsWith("."), rule.id).toBe(false);
      expect(rule.title.length, rule.id).toBeLessThan(70);
    }
  });
});

describe("every rule earns its place", () => {
  it("has a fixture", () => {
    const missing = rules.filter((rule) => !TRIGGERS[rule.id]).map((rule) => rule.id);
    expect(missing, "rules with no fixture in tests/fixtures/triggers.ts").toEqual([]);
  });

  it("has no fixture for a rule that no longer exists", () => {
    const ids = new Set(rules.map((r) => r.id));
    expect(Object.keys(TRIGGERS).filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const rule of rules) {
    const fixture = TRIGGERS[rule.id];
    if (!fixture) continue;

    it(`${rule.id} fires on the copy it is about`, () => {
      const found = findingsFor(rule.jurisdiction, fixture.trips, extractClaims(fixture.trips));
      expect(found.map((f) => f.ruleId)).toContain(rule.id);
    });

    it(`${rule.id} stays quiet once the copy is fixed`, () => {
      const found = findingsFor(rule.jurisdiction, fixture.quiet, extractClaims(fixture.quiet));
      expect(found.map((f) => f.ruleId)).not.toContain(rule.id);
    });
  }
});

describe("matchers compile", () => {
  it("runs every rule against empty text without throwing", () => {
    for (const jurisdiction of supportedJurisdictions()) {
      expect(() => findingsFor(jurisdiction, "", [])).not.toThrow();
      expect(packFor(jurisdiction).rules.length).toBeGreaterThan(0);
    }
  });
});
