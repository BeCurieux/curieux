/**
 * The badge's legal defence, as a test.
 *
 * BRIEF.md §9: badge language is descriptive, never a warranty. That is one
 * sentence in a document and it protects a mark that will sit on hundreds of
 * strangers' product pages, so it is checked here across every state the mark
 * has, in the visible text and in the accessible label alike. Relaxing this
 * file is a legal decision, not a test fix.
 *
 * It has been relaxed once, deliberately: "verified" came off the forbidden
 * list when the owner kept §4's "Claims Verified" over the reading that §9
 * required "reviewed". The tests below pin both halves of that decision — the
 * headline is the brief's wording, and the mark still carries the descriptive
 * line saying what was actually done — so neither can drift back by accident.
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
import { badgeEligible } from "@/engine/score.js";
import { scan } from "@/engine/evaluate.js";
import { supportedJurisdictions } from "@/engine/registry.js";
import { BADGE_NIGHT_PALETTE, BADGE_PALETTE, PALETTE } from "@/card/tokens.js";
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
    // The dark ground is a state of the mark, not a separate mark, so it takes
    // every §9 assertion in this block rather than a suite of its own.
    ["night", badgeSvg({ result: clean, reviewedOn: ON, live: true, theme: "night" })],
    ["night lapsed", badgeSvg({ result: clean, reviewedOn: ON, live: false, theme: "night" })],
  ] as const;

  for (const [state, svg] of states) {
    it(`carries none of the warranty vocabulary when ${state}`, () => {
      const words = everyWord(svg);
      const found = BADGE_FORBIDDEN.filter((word) => words.includes(word));
      expect(found, `${state} badge said: ${found.join(", ")}`).toEqual([]);
    });
  }

  it("says what BRIEF.md §4 names it, which the owner kept on purpose", () => {
    expect(BADGE_HEADLINE).toBe("Claims Verified");
    expect(everyWord(states[0][1])).toContain("claims verified");
  });

  it("still says what was actually done, under the name", () => {
    // The headline names a status; this line is where §9's descriptive
    // requirement lives now. Losing it would leave the mark asserting a state
    // with nothing on it saying what produced the state.
    for (const [state, svg] of states) {
      expect(everyWord(svg), state).toContain("reviewed against");
    }
  });

  it("keeps the forbidden list populated, which is how this test stops working", () => {
    expect(BADGE_FORBIDDEN.length).toBeGreaterThan(6);
    expect(BADGE_FORBIDDEN).toContain("certified");
    expect(BADGE_FORBIDDEN).toContain("compliant");
    expect(BADGE_FORBIDDEN).toContain("approved");
  });

  it("has exactly one word removed from it, and it is the one that was decided", () => {
    // A guard against the list quietly shrinking again. Anything else coming
    // off is a legal decision and should fail here until it is taken as one.
    expect(BADGE_FORBIDDEN).not.toContain("verified");
    expect([...BADGE_FORBIDDEN].sort()).toEqual([
      "approved",
      "certificate",
      "certified",
      "compliance",
      "compliant",
      "endorsed",
      "guarantee",
      "guaranteed",
      "passed",
      "safe",
    ]);
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
      "Reviewed against 4 markets",
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
    expect(lapsed).not.toContain(BADGE_PALETTE.accent);
    expect(badgeSvg({ result: clean, reviewedOn: ON, live: true })).toContain(BADGE_PALETTE.accent);
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

  /**
   * The regression this exists for: a kill-test run whose fetches all failed
   * wrote thirty empty copy files, scanned them, and rendered thirty
   * "Claims Verified · 100/100" marks for thirty named brands. Empty copy has
   * nothing to deduct for, so it scores 100, and 100 is `clear`.
   */
  it("refuses the mark to copy that was never read, however high it scores", () => {
    for (const nothing of ["", "   ", "\n\t\n"]) {
      const empty = scan({ text: nothing, source: paste, jurisdictions: ["AU", "US", "EU"] });
      expect(empty.score.value).toBe(100);
      expect(empty.score.band).toBe("clear");
      expect(badgeEligible(empty.score)).toBe(true);
      expect(empty.readChars).toBe(0);
      expect(mayDisplayBadge(empty)).toBe(false);
    }
  });

  /**
   * The floor is empty, not short. Copy can legitimately be one sentence and
   * carry no claims the lexicon recognises — that page is the mark's whole
   * customer, and an over-eager guard would refuse exactly the wrong brand.
   */
  it("still offers it to short, careful copy that trips nothing", () => {
    expect(clean.claims).toHaveLength(0);
    expect(clean.readChars).toBeGreaterThan(0);
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

  it("offers a dark ground the merchant opts into, without becoming the page", () => {
    const night = badgeSvg({ result: clean, reviewedOn: ON, live: true, theme: "night" });
    expect(night).toContain(BADGE_NIGHT_PALETTE.paperRaised);
    // Lighter than the page, deliberately: the mark sits on top of a dark PDP
    // rather than matching one, and the page's near-black would read as a hole.
    expect(night).not.toContain(PALETTE.paper);
    expect(night).not.toContain(BADGE_PALETTE.paperRaised);
  });

  it("changes the colours and nothing else", () => {
    // The guard on the whole idea of a theme. Strip every fill and stroke from
    // both marks and what is left must be identical — same words, same layout,
    // same aria-label. A variant that could say something different is a
    // second badge with no test around its language.
    const strip = (svg: string) => svg.replace(/(?:fill|stroke)="[^"]*"/g, "");
    const paper = badgeSvg({ result: clean, reviewedOn: ON, live: true });
    const night = badgeSvg({ result: clean, reviewedOn: ON, live: true, theme: "night" });
    expect(strip(night)).toBe(strip(paper));
  });

  it("greys a lapsed mark on the dark ground too", () => {
    const lapsed = badgeSvg({ result: clean, reviewedOn: ON, live: false, theme: "night" });
    expect(lapsed).toContain("LAPSED");
    expect(lapsed).not.toContain(BADGE_NIGHT_PALETTE.accent);
  });

  it("does not follow the product's dark ground onto somebody else's page", () => {
    // The page and the share card are near-black. The badge is not, and this
    // is the assertion that keeps it that way: it renders inside a merchant's
    // PDP, which is usually pale, and a black rectangle dropped into one is
    // worse than a mark that simply looks like a stamp.
    const mark = badgeSvg({ result: clean, reviewedOn: ON, live: true });
    expect(mark).toContain(BADGE_PALETTE.paperRaised);
    expect(mark).not.toContain(PALETTE.paper);
    expect(mark).not.toContain(PALETTE.accent);
  });
});
