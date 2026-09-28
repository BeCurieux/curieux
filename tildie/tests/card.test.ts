/**
 * The artefact.
 *
 * Two things here are not style checks. The escaping tests are a security
 * boundary — the card reproduces copy fetched from a page we do not control,
 * and the file it produces is sent to strangers and later served from our own
 * domain. And the honesty tests are the product: a card that says "nothing
 * trips a rule" above a note describing a rule is worse than no card, because
 * the whole pitch is that this thing reads language carefully.
 */

import { describe, expect, it } from "vitest";
import { scan } from "@/engine/evaluate.js";
import { resultPage } from "@/card/page.js";
import { shareCard, wrapText, OG_WIDTH } from "@/card/og.js";
import { annotate } from "@/card/annotate.js";
import { esc, escXml, safeUrl } from "@/card/escape.js";
import { MARKET_ACCENT, WORDMARK } from "@/card/tokens.js";
import { FONT_FILES, loadEmbeddedFonts, resolveFont } from "@/card/fonts.js";
import { DISCLAIMER } from "@/engine/framing.js";
import { AURELIA_PDP } from "./fixtures/pdp.js";

const ON = new Date("2026-08-18T00:00:00Z");
const paste = { kind: "paste" } as const;

const dirty = scan({ text: AURELIA_PDP, source: paste, jurisdictions: ["AU", "US", "EU"] });
const CLEAN_COPY = "A nightly serum of encapsulated retinal, squalane and oat lipids. It smells of nothing.";
const clean = scan({ text: CLEAN_COPY, source: paste, jurisdictions: ["AU", "US", "EU"] });

const page = (text: string, result = dirty, extra = {}) =>
  resultPage({ text, result, reviewedOn: ON, ...extra });

describe("escaping", () => {
  const HOSTILE = `Clinically proven <script>alert(1)</script> to work "well" & <img src=x onerror=y>`;

  it("never lets markup out of the copy and into the page", () => {
    const result = scan({ text: HOSTILE, source: paste, jurisdictions: ["US"] });
    const html = page(HOSTILE, result);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never lets markup out of the copy and into the share card", () => {
    const result = scan({ text: HOSTILE, source: paste, jurisdictions: ["US"] });
    const svg = shareCard({ text: HOSTILE, result, reviewedOn: ON });
    expect(svg).not.toContain("<script>alert");
    expect(svg.match(/<svg/g)).toHaveLength(1);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("escapes the source reference, which arrives from a URL bar", () => {
    const result = scan({
      text: "Eco-friendly.",
      source: { kind: "url", reference: `x" onload="alert(1)` },
      jurisdictions: ["EU"],
    });
    const html = page("Eco-friendly.", result);
    expect(html).not.toContain('onload="alert');
  });

  it("escapes the wordmark, which is user input on the CLI", () => {
    expect(page(CLEAN_COPY, clean, { wordmark: "<b>VOUCH</b>" })).not.toContain("<b>VOUCH</b>");
  });

  it("colours by market and never by severity", () => {
    // The rule this pins is the one in CLAUDE.md: colour is identity, not
    // verdict. A market keeps its hue whether the finding under it is high or
    // low severity, and a clean page shows the same hues as a bad one. The
    // moment a colour starts tracking severity or band, the card is an audit
    // tool with traffic lights, which is the thing the positioning is not.
    const markets = ["AU", "US", "EU"] as const;
    const bad = scan({ text: AURELIA_PDP, source: { kind: "paste" }, jurisdictions: [...markets] });
    const quiet = scan({ text: CLEAN_COPY, source: { kind: "paste" }, jurisdictions: [...markets] });

    const hues = (html: string) =>
      markets.filter((m) => html.includes(MARKET_ACCENT[m] as string)).sort();

    // Every market on the page carries its hue, in both directions.
    expect(hues(page(AURELIA_PDP, bad))).toEqual([...markets].sort());
    expect(hues(page(CLEAN_COPY, quiet))).toEqual([...markets].sort());

    // And no hue belongs to a severity or a band.
    for (const word of ["high", "medium", "low", "clear", "review", "rework"]) {
      expect(Object.values(MARKET_ACCENT)).not.toContain(word);
    }
  });

  it("puts the name in the masthead without being asked, and lets a flag override it", () => {
    // Pinned because an unnamed masthead is how a card goes out anonymous, and
    // because the override is what the kill test uses to try another name.
    expect(page(CLEAN_COPY, clean)).toContain(WORDMARK);
    expect(page(CLEAN_COPY, clean, { wordmark: "SORREL" })).toContain("SORREL");
  });

  it("handles the five characters and leaves everything else alone", () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    expect(esc("Émoji — ✓ 90%")).toBe("Émoji — ✓ 90%");
  });

  it("strips the control characters that make an SVG unparseable", () => {
    expect(escXml("a\u0000b\u0007c")).toBe("abc");
    expect(escXml("keeps\ttabs\nand newlines")).toBe("keeps\ttabs\nand newlines");
  });

  it("drops a link scheme that is not http", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("https://eur-lex.europa.eu/x")).toBe("https://eur-lex.europa.eu/x");
    expect(safeUrl(undefined)).toBeUndefined();
  });
});

describe("the page says what is true", () => {
  it("carries the disclaimer, always", () => {
    expect(page(AURELIA_PDP)).toContain(esc(DISCLAIMER));
    expect(page(CLEAN_COPY, clean)).toContain(esc(DISCLAIMER));
  });

  it("does not claim a clean sheet when a rule was tripped", () => {
    // A 96 with one low-severity narrowing is `clear`, and used to be
    // described as "nothing in this copy trips a rule" — with the note about
    // that rule printed directly below it.
    const scored = scan({
      text: "The bottle is recyclable.",
      source: paste,
      jurisdictions: ["US"],
    });
    expect(scored.score.band).toBe("clear");
    expect(scored.findings.length).toBeGreaterThan(0);
    expect(page("The bottle is recyclable.", scored)).not.toContain("Nothing in this copy trips a rule");
  });

  it("does say so when nothing was found", () => {
    expect(page(CLEAN_COPY, clean)).toContain("Nothing in this copy trips a rule");
  });

  it("names every market it checked, with the pack version it used", () => {
    const html = page(AURELIA_PDP);
    for (const [market, version] of Object.entries(dirty.packVersions)) {
      expect(html).toContain(version);
      expect(html).toContain(market === "EU" ? "European Union" : market === "US" ? "United States" : "Australia");
    }
  });

  it("shows an arithmetic line for every deduction in the headline market", () => {
    const html = page(AURELIA_PDP);
    for (const deduction of dirty.score.deductions) {
      expect(html).toContain(esc(deduction.ruleTitle));
    }
  });
});

describe("the copy and the notes agree", () => {
  it("numbers every mark in the copy and answers it in the notes", () => {
    const html = page(AURELIA_PDP);
    const { marks } = annotate(AURELIA_PDP, dirty.findings);
    expect(marks.length).toBeGreaterThan(3);
    for (const mark of marks) {
      expect(html).toContain(`<sup>${mark.index}</sup>`);
      expect(html).toContain(`<div class="note__index">${mark.index}</div>`);
    }
  });

  it("cites the rule id under every finding", () => {
    const html = page(AURELIA_PDP);
    for (const finding of dirty.findings) expect(html).toContain(finding.ruleId);
  });

  it("prefers a supplied rewrite over the generic remedy", () => {
    const first = dirty.findings[0]!;
    const html = page(AURELIA_PDP, dirty, {
      rewrites: { [`${first.ruleId}@${first.trigger.span.start}`]: "Say the measured thing instead." },
    });
    expect(html).toContain("Say the measured thing instead.");
  });
});

describe("the badge is offered only when it is earned", () => {
  it("is absent from a page that cannot carry it", () => {
    expect(dirty.score.band).not.toBe("clear");
    expect(page(AURELIA_PDP)).toContain("The mark is not offered for this copy yet");
  });

  it("is present on a page that can", () => {
    const html = page(CLEAN_COPY, clean);
    expect(html).toContain("CLAIMS VERIFIED");
    expect(html).not.toContain("The mark is not offered");
  });
});

describe("determinism", () => {
  it("renders the identical page twice", () => {
    expect(page(AURELIA_PDP)).toBe(page(AURELIA_PDP));
  });

  it("renders the identical share card twice", () => {
    const once = shareCard({ text: AURELIA_PDP, result: dirty, reviewedOn: ON });
    expect(once).toBe(shareCard({ text: AURELIA_PDP, result: dirty, reviewedOn: ON }));
  });

  it("takes the date rather than reading the clock", () => {
    const early = resultPage({ text: CLEAN_COPY, result: clean, reviewedOn: new Date("2024-01-02T00:00:00Z") });
    expect(early).toContain("2 January 2024");
    expect(early).not.toContain("18 August 2026");
  });
});

describe("the share card", () => {
  it("leads with the strongest phrase and counts the rest", () => {
    const svg = shareCard({ text: AURELIA_PDP, result: dirty, reviewedOn: ON });
    expect(svg).toContain("Clinically proven");
    expect(svg).toMatch(/AND \d+ MORE PHRASES/);
  });

  it("says so, rather than nothing, when there is nothing to lead with", () => {
    const svg = shareCard({ text: CLEAN_COPY, result: clean, reviewedOn: ON });
    expect(svg).toContain("Nothing here trips a rule");
  });

  it("carries the not-legal-advice line", () => {
    expect(shareCard({ text: AURELIA_PDP, result: dirty, reviewedOn: ON })).toContain("NOT LEGAL ADVICE");
  });

  it("keeps every element inside the frame", () => {
    const svg = shareCard({ text: AURELIA_PDP, result: dirty, reviewedOn: ON });
    for (const x of svg.matchAll(/ x="(-?[\d.]+)"/g)) {
      expect(Number(x[1])).toBeGreaterThanOrEqual(0);
      expect(Number(x[1])).toBeLessThanOrEqual(OG_WIDTH);
    }
  });
});

describe("wrapping, since SVG will not do it", () => {
  it("never exceeds the line budget", () => {
    const lines = wrapText("Clinically proven to reduce the appearance of fine lines in 28 days", 700, 44);
    for (const line of lines) expect(line.length * 44 * 0.4).toBeLessThanOrEqual(700);
  });

  it("stops at the line limit and marks the truncation", () => {
    const lines = wrapText("word ".repeat(80), 400, 44, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
  });

  it("does not add an ellipsis to text that fitted", () => {
    const lines = wrapText("Two short words", 700, 44, 2);
    expect(lines).toEqual(["Two short words"]);
  });

  it("survives a single word longer than the line", () => {
    expect(wrapText("Supercalifragilisticexpialidocious", 80, 44, 2).join("")).not.toBe("");
  });

  it("survives empty text", () => {
    expect(wrapText("   ", 700, 44)).toEqual([]);
  });
});

describe("the typefaces the card embeds", () => {
  it("are where the renderer expects them, which no other test would notice", () => {
    // The card renderers are pure and the suite exercises them without
    // embedded faces, so a @fontsource release that renames a file would
    // otherwise be found by a founder halfway through the kill test.
    for (const slot of Object.keys(FONT_FILES) as (keyof typeof FONT_FILES)[]) {
      expect(resolveFont(slot), FONT_FILES[slot]).toBeTypeOf("string");
    }
  });

  it("arrive as woff2 data URIs, and the page declares a face for each", () => {
    const fonts = loadEmbeddedFonts(() => {});
    expect(fonts?.display).toMatch(/^data:font\/woff2;base64,/);
    expect(fonts?.text).toMatch(/^data:font\/woff2;base64,/);
    const html = page(CLEAN_COPY, clean, { fonts });
    expect(html).toContain('@font-face{font-family:"Instrument Serif"');
    expect(html).toContain('@font-face{font-family:"Newsreader"');
  });

  it("are absent from a render that was given none, rather than broken", () => {
    expect(page(CLEAN_COPY, clean)).not.toContain("@font-face");
  });
});
