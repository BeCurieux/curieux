// The cover is the one piece where a small arithmetic error ruins an entire
// print run: the spine lands off-centre on every copy and nothing is
// salvageable. These tests pin the geometry and the guards around it.

import { describe, expect, it } from "vitest";
import {
  CASE_BINDING, MIN_SPINE_TEXT_INCHES, PAPER_STOCKS,
  coverGeometry, renderCoverHtml, spineTakesText, spineWidth,
} from "@/lib/pdf/cover";
import { runCoverPreflight } from "@/lib/pdf/preflight";
import { BOOK_SPEC } from "@/lib/book/structure";

const stock = PAPER_STOCKS.mohawk_superfine_eggshell;
const measured = { ...stock, measured: true };

describe("spine width", () => {
  it("counts sheets, not pages — two pages print on one leaf", () => {
    const sixtyFour = spineWidth(64, measured);
    const thirtyTwo = spineWidth(32, measured);
    const textBlockDiff = (32 - 16) * measured.caliperInches;
    expect(sixtyFour - thirtyTwo).toBeCloseTo(textBlockDiff, 5);
  });

  it("includes the two cover boards the spine has to bridge", () => {
    const bare = Math.ceil(64 / 2) * measured.caliperInches;
    expect(spineWidth(64, measured)).toBeCloseTo(bare + 2 * CASE_BINDING.boardThicknessInches, 5);
  });

  it("is thicker on heavier stock at the same page count", () => {
    expect(spineWidth(64, PAPER_STOCKS.gloss_photo_200))
      .toBeGreaterThan(spineWidth(64, PAPER_STOCKS.mohawk_superfine_eggshell));
  });

  it("rounds an odd page count up to a whole sheet", () => {
    // 63 pages still occupies 32 leaves of paper.
    expect(spineWidth(63, measured)).toBeCloseTo(spineWidth(64, measured), 5);
  });
});

describe("cover sheet geometry", () => {
  const geo = coverGeometry(64, measured);

  it("spans two boards, two hinges, the spine, and turn-in on both edges", () => {
    const expected =
      2 * geo.boardWidthInches +
      geo.spineWidthInches +
      2 * CASE_BINDING.hingeGapInches +
      2 * CASE_BINDING.turnInInches;
    expect(geo.sheetWidthInches).toBeCloseTo(expected, 3);
  });

  it("is taller than the finished book, by the turn-in on both edges", () => {
    expect(geo.sheetHeightInches).toBeCloseTo(
      geo.boardHeightInches + 2 * CASE_BINDING.turnInInches, 3
    );
    expect(geo.sheetHeightInches).toBeGreaterThan(BOOK_SPEC.trimHeightInches);
  });

  it("overhangs the text block, as a hardcover does", () => {
    expect(geo.boardWidthInches).toBeGreaterThan(BOOK_SPEC.trimWidthInches);
  });

  it("places the spine after the back board and its hinge", () => {
    expect(geo.spineLeftInches).toBeCloseTo(
      CASE_BINDING.turnInInches + geo.boardWidthInches + CASE_BINDING.hingeGapInches, 3
    );
  });

  it("grows only in width as the book gets thicker", () => {
    const thin = coverGeometry(48, measured);
    const thick = coverGeometry(80, measured);
    expect(thick.sheetWidthInches).toBeGreaterThan(thin.sheetWidthInches);
    expect(thick.sheetHeightInches).toBeCloseTo(thin.sheetHeightInches, 5);
  });
});

describe("cover preflight", () => {
  const base = (pageCount = 64, s = measured) => ({
    pageCount, stock: s, geometry: coverGeometry(pageCount, s),
  });

  it("passes a measured stock at a valid page count", () => {
    const result = runCoverPreflight({ ...base(), spineText: "The Year You Were Two · Florence" });
    expect(result.passed).toBe(true);
    expect(result.issues.filter((i) => i.severity === "warning")).toHaveLength(0);
  });

  it("warns — loudly — when the caliper has not been measured", () => {
    const result = runCoverPreflight(base(64, stock));
    expect(result.passed).toBe(true); // a warning, not a block
    expect(result.issues.some((i) => i.code === "caliper_unmeasured")).toBe(true);
  });

  it("rejects an odd page count", () => {
    expect(runCoverPreflight(base(63)).passed).toBe(false);
  });

  it("refuses to set type on a spine too narrow to carry it", () => {
    const thin = { pageCount: 4, stock: measured, geometry: coverGeometry(4, measured) };
    const result = runCoverPreflight({ ...thin, spineText: "A Title" });
    if (!spineTakesText(thin.geometry.spineWidthInches)) {
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.code === "spine_too_narrow_for_text")).toBe(true);
    }
  });

  it("rejects spine text longer than the spine is tall", () => {
    const result = runCoverPreflight({ ...base(), spineText: "x".repeat(400) });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "spine_text_too_long")).toBe(true);
  });

  it("rejects a sheet larger than the provider can print", () => {
    const result = runCoverPreflight({
      ...base(),
      provider: { maxSheetWidthInches: 10, maxSheetHeightInches: 20 },
    });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "cover_too_wide")).toBe(true);
  });
});

describe("cover rendering", () => {
  const geo = coverGeometry(64, measured);

  it("sets the page to the full sheet, not the finished book", () => {
    const html = renderCoverHtml({ title: "The Year You Were Two" }, geo);
    expect(html).toContain(`size: ${geo.sheetWidthInches}in ${geo.sheetHeightInches}in`);
  });

  it("prints the title on the spine when it fits", () => {
    const html = renderCoverHtml({ title: "The Year You Were Two", subtitle: "Florence" }, geo);
    expect(spineTakesText(geo.spineWidthInches)).toBe(true);
    // The element, not the stylesheet rule that is always present.
    expect(html).toContain(`<span class="spine-text">`);
    expect(html).toContain("Florence");
  });

  it("leaves the spine blank when it is too narrow for type", () => {
    const thin = coverGeometry(4, measured);
    expect(thin.spineWidthInches).toBeLessThan(MIN_SPINE_TEXT_INCHES);
    const html = renderCoverHtml({ title: "T" }, thin);
    expect(html).not.toContain(`<span class="spine-text">`);
  });

  it("escapes titles rather than trusting them", () => {
    const html = renderCoverHtml({ title: `<script>alert("x")</script>` }, geo);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("carries no external references — the press gets one self-contained file", () => {
    const html = renderCoverHtml({ title: "T", imprint: "Ordinary Tuesday" }, geo);
    expect(html).not.toMatch(/<link[^>]+href=["']http/);
    expect(html).not.toMatch(/<script[^>]+src=/);
  });
});
