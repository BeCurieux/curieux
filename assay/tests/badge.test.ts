/**
 * The badge's legal defence, as a test.
 *
 * BRIEF.md §9: badge language is descriptive, never a warranty. That is one
 * sentence in a document and it protects a mark that will sit on hundreds of
 * strangers' product pages, so it is checked here across every state the mark
 * has, in the visible text and in the accessible label alike. Relaxing this
 * file is a legal decision, not a test fix.
 */

import { describe, expect, it } from "vitest";
import {
  BADGE_FORBIDDEN,
  BADGE_HEADLINE,
  BADGE_HEIGHT,
  BADGE_WIDTH,
  badgeLines,
  badgeSvg,
  badgeTextFits,
  mayDisplayBadge,
} from "@/card/badge.js";
import { scan } from "@/engine/evaluate.js";
import { supportedJurisdictions } from "@/engine/registry.js";
import { PALETTE } from "@/card/tokens.js";
import { AURELIA_PDP } from "./fixtures/pdp.js";

const ON = new Date("2026-08-18T00:00:00Z");
const paste = { kind: "paste" } as const;

const CLEAN = "A nightly serum of encapsulated retinal, squalane and oat lipids.";
const clean = scan({ text: CLEAN, source: paste, jurisdictions: ["AU", "US", "EU"] });
const dirty = scan({ text: AURELIA_PDP, source: paste, jurisdictions: ["AU", "US", "EU"] });

/** Words a reader sees, plus the label a screen reader hears. */
function everyWord(svg: string): string {
  const visible = [...svg.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(" ");
  const labels = [...svg.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(" ");
  return `${visible} ${labels}`.toLowerCase();
}

describe("the mark never warrants anything", () => {
  const states = [
    ["live", badgeSvg({ result: clean, reviewedOn: ON, live: true })],
    ["lapsed", badgeSvg({ result: clean, reviewedOn: ON, live: false })],
    ["linked", badgeSvg({ result: clean, reviewedOn: ON, href: "https://example.com/s/aurelia" })],
  ] as const;

  for (const [state, svg] of states) {
    it(`carries none of the warranty vocabulary when ${state}`, () => {
      const words = everyWord(svg);
      const found = BADGE_FORBIDDEN.filter((word) => words.includes(word));
      expect(found, `${state} badge said: ${found.join(", ")}`).toEqual([]);
    });
  }

  it("says reviewed, which is the thing that actually happened", () => {
    expect(BADGE_HEADLINE).toBe("Claims reviewed");
    expect(everyWord(states[0][1])).toContain("claims reviewed");
  });

  it("keeps the forbidden list populated, which is how this test stops working", () => {
    expect(BADGE_FORBIDDEN.length).toBeGreaterThan(6);
    expect(BADGE_FORBIDDEN).toContain("certified");
    expect(BADGE_FORBIDDEN).toContain("compliant");
  });
});

describe("what the mark states", () => {
  it("names the score, the markets and the month", () => {
    const words = everyWord(badgeSvg({ result: clean, reviewedOn: ON }));
    expect(words).toContain(String(clean.score.value));
    expect(words).toContain("au · us · eu");
    expect(words).toContain("august 2026");
  });

  it("takes the date rather than reading the clock", () => {
    const lines = badgeLines({ result: clean, reviewedOn: new Date("2019-03-04T00:00:00Z") });
    expect(lines.when).toBe("March 2019");
  });

  it("counts markets instead of listing them once a list would overrun", () => {
    const many = { ...clean, jurisdictions: ["AU", "US", "EU", "GB"] as const };
    expect(badgeLines({ result: { ...many, jurisdictions: [...many.jurisdictions] }, reviewedOn: ON }).markets).toBe(
      "4 markets",
    );
  });

  it("fits its own frame for every market combination it will be asked to show", () => {
    const markets = supportedJurisdictions();
    for (const count of [1, 2, 3]) {
      const result = { ...clean, jurisdictions: markets.slice(0, count) };
      for (const live of [true, false]) {
        expect(badgeTextFits({ result, reviewedOn: ON, live }), `${count} markets, live=${live}`).toBe(true);
      }
    }
  });
});

describe("lapsing", () => {
  it("says it has lapsed rather than quietly going on asserting", () => {
    expect(everyWord(badgeSvg({ result: clean, reviewedOn: ON, live: false }))).toContain("lapsed");
  });

  it("still names the date it was true, and still shows the score", () => {
    const words = everyWord(badgeSvg({ result: clean, reviewedOn: ON, live: false }));
    expect(words).toContain("august 2026");
    expect(words).toContain(String(clean.score.value));
  });

  it("greys out — no accent anywhere on it", () => {
    const lapsed = badgeSvg({ result: clean, reviewedOn: ON, live: false });
    expect(lapsed).not.toContain(PALETTE.accent);
    expect(badgeSvg({ result: clean, reviewedOn: ON, live: true })).toContain(PALETTE.accent);
  });
});

describe("the link", () => {
  it("is there when a real one is given", () => {
    const svg = badgeSvg({ result: clean, reviewedOn: ON, href: "https://example.com/s/aurelia" });
    expect(svg).toContain('href="https://example.com/s/aurelia"');
    expect(svg).toContain('rel="noopener"');
  });

  it("is dropped, along with the anchor, when the scheme is not http", () => {
    const svg = badgeSvg({ result: clean, reviewedOn: ON, href: "javascript:alert(1)" });
    expect(svg).not.toContain("javascript:");
    expect(svg).not.toContain("<a ");
  });
});

describe("eligibility", () => {
  it("refuses the mark to a page carrying a phrase that draws attention", () => {
    expect(dirty.findings.some((f) => f.severity === "high")).toBe(true);
    expect(mayDisplayBadge(dirty)).toBe(false);
  });

  it("offers it to a page that reads clear in every market checked", () => {
    expect(mayDisplayBadge(clean)).toBe(true);
  });
});

describe("the object itself", () => {
  it("is one well-formed svg at its declared size", () => {
    const svg = badgeSvg({ result: clean, reviewedOn: ON });
    expect(svg.match(/<svg/g)).toHaveLength(1);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain(`width="${BADGE_WIDTH}"`);
    expect(svg).toContain(`height="${BADGE_HEIGHT}"`);
  });

  it("keeps every element inside its frame", () => {
    const svg = badgeSvg({ result: clean, reviewedOn: ON });
    for (const x of svg.matchAll(/ x[12]?="(-?[\d.]+)"/g)) {
      expect(Number(x[1])).toBeGreaterThanOrEqual(0);
      expect(Number(x[1])).toBeLessThanOrEqual(BADGE_WIDTH);
    }
  });

  it("renders the same mark twice", () => {
    expect(badgeSvg({ result: clean, reviewedOn: ON })).toBe(badgeSvg({ result: clean, reviewedOn: ON }));
  });
});
