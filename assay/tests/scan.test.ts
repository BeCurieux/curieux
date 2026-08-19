import { describe, expect, it } from "vitest";
import { scan, weakestMarket } from "@/engine/evaluate.js";
import { badgeEligible } from "@/engine/score.js";
import { UnsupportedJurisdictionError } from "@/engine/registry.js";
import { AURELIA_PDP } from "./fixtures/pdp.js";

const paste = { kind: "paste" } as const;
const full = () => scan({ text: AURELIA_PDP, source: paste, jurisdictions: ["AU", "US", "EU"] });

describe("a real page, end to end", () => {
  it("finds the things a person would find, and cites a rule for each", () => {
    const result = full();
    const ids = new Set(result.findings.map((f) => f.ruleId));
    expect(ids).toContain("us-ftc-proven-efficacy");
    expect(ids).toContain("us-fda-disease-claim");
    expect(ids).toContain("eu-ecgt-generic-environmental");
    expect(ids).toContain("eu-ecgt-offset-neutrality");
    expect(ids).toContain("au-tga-cosmetic-crossing-into-therapeutic");
    for (const finding of result.findings) {
      expect(finding.citation.instrument.length).toBeGreaterThan(3);
      expect(finding.headline.length).toBeGreaterThan(20);
    }
  });

  it("quotes the exact words it is talking about", () => {
    for (const finding of full().findings) {
      const { start, end } = finding.trigger.span;
      expect(AURELIA_PDP.slice(start, end)).toBe(finding.trigger.text);
    }
  });

  it("attributes most findings to a claim, so they can be shown inline", () => {
    const result = full();
    const attributed = result.findings.filter((f) => f.claimId !== null);
    expect(attributed.length).toBeGreaterThan(result.findings.length / 2);
    const claimIds = new Set(result.claims.map((c) => c.id));
    for (const finding of attributed) expect(claimIds).toContain(finding.claimId);
  });

  it("reports the findings in the order a reader meets them", () => {
    const starts = full().findings.map((f) => f.trigger.span.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("does not offer the badge to a page like this", () => {
    expect(badgeEligible(full().score)).toBe(false);
  });
});

describe("more markets never means a worse number", () => {
  it("headlines the weakest market rather than adding the markets up", () => {
    const result = full();
    const perMarket = result.jurisdictions.map((j) => result.byJurisdiction[j]!.value);
    expect(result.score.value).toBe(Math.min(...perMarket));
    expect(result.byJurisdiction[weakestMarket(result)]!.value).toBe(result.score.value);
  });

  it("scores one market the same whether or not others were selected too", () => {
    const alone = scan({ text: AURELIA_PDP, source: paste, jurisdictions: ["EU"] });
    const together = full();
    expect(together.byJurisdiction.EU!.value).toBe(alone.score.value);
  });

  it("carries the pack version of every market it checked", () => {
    expect(Object.keys(full().packVersions).sort()).toEqual(["AU", "EU", "US"]);
  });

  it("ignores a market listed twice", () => {
    const result = scan({ text: AURELIA_PDP, source: paste, jurisdictions: ["EU", "EU"] });
    expect(result.jurisdictions).toEqual(["EU"]);
  });
});

describe("a market with no rules is not a clean sheet", () => {
  it("refuses a jurisdiction that has no pack", () => {
    expect(() => scan({ text: "Eco-friendly.", source: paste, jurisdictions: ["GB"] })).toThrow(
      UnsupportedJurisdictionError,
    );
  });

  it("refuses a scan against no markets at all", () => {
    expect(() => scan({ text: "Eco-friendly.", source: paste, jurisdictions: [] })).toThrow(/at least one/);
  });

  it("refuses even when one of several markets is unsupported", () => {
    expect(() => scan({ text: "Eco-friendly.", source: paste, jurisdictions: ["EU", "CA_QC"] })).toThrow(
      UnsupportedJurisdictionError,
    );
  });
});

describe("determinism", () => {
  it("gives the identical result twice", () => {
    expect(JSON.stringify(full())).toBe(JSON.stringify(full()));
  });

  it("scores copy with nothing in it at 100", () => {
    const result = scan({
      text: "A serum in an amber bottle. It smells of neroli, moss and a little smoke.",
      source: paste,
      jurisdictions: ["AU", "US", "EU"],
    });
    expect(result.findings).toEqual([]);
    expect(result.score.value).toBe(100);
    expect(badgeEligible(result.score)).toBe(true);
  });
});
