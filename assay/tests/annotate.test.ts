import { describe, expect, it } from "vitest";
import { annotate, headlineMark, marksFor, marketsOf } from "@/card/annotate.js";
import { scan } from "@/engine/evaluate.js";
import type { Finding, Jurisdiction, Severity } from "@/engine/types.js";
import { AURELIA_PDP } from "./fixtures/pdp.js";

const finding = (
  ruleId: string,
  start: number,
  end: number,
  severity: Severity = "medium",
  jurisdiction: Jurisdiction = "AU",
): Finding => ({
  ruleId,
  ruleTitle: ruleId,
  jurisdiction,
  categories: ["efficacy"],
  severity,
  modality: "may_be_unsubstantiated",
  citation: { instrument: "Test instrument" },
  claimId: null,
  trigger: { text: "x", span: { start, end } },
  headline: "h",
  concern: "c",
  remedy: "r",
  rewriteGuidance: "g",
});

describe("the document survives being marked up", () => {
  it("puts every character back, once, in order", () => {
    const result = scan({ text: AURELIA_PDP, source: { kind: "paste" }, jurisdictions: ["AU", "US", "EU"] });
    const { pieces } = annotate(AURELIA_PDP, result.findings);
    const rebuilt = pieces.map((piece) => (piece.kind === "text" ? piece.text : piece.mark.text)).join("");
    expect(rebuilt).toBe(AURELIA_PDP);
  });

  it("gives every mark the exact source text of its span", () => {
    const result = scan({ text: AURELIA_PDP, source: { kind: "paste" }, jurisdictions: ["EU"] });
    for (const mark of annotate(AURELIA_PDP, result.findings).marks) {
      expect(AURELIA_PDP.slice(mark.span.start, mark.span.end)).toBe(mark.text);
    }
  });

  it("leaves copy with nothing found completely alone", () => {
    const { pieces, marks } = annotate("A serum. It smells of neroli.", []);
    expect(marks).toEqual([]);
    expect(pieces).toEqual([{ kind: "text", text: "A serum. It smells of neroli." }]);
  });
});

describe("merging", () => {
  it("collapses three markets flagging one phrase into one mark", () => {
    const marks = marksFor([
      finding("eu-rule", 10, 22, "high", "EU"),
      finding("us-rule", 10, 22, "medium", "US"),
      finding("au-rule", 10, 22, "high", "AU"),
    ]);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.findings).toHaveLength(3);
    expect(marketsOf(marks[0]!)).toEqual(["EU", "AU", "US"]);
  });

  it("takes the union when two rules catch different lengths of a phrase", () => {
    const marks = marksFor([finding("long", 10, 27), finding("short", 21, 27)]);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.span).toEqual({ start: 10, end: 27 });
  });

  it("keeps separate phrases separate, even when adjacent", () => {
    const marks = marksFor([finding("a", 0, 5), finding("b", 5, 9)]);
    expect(marks).toHaveLength(2);
  });

  it("numbers marks in reading order whatever order the findings arrived in", () => {
    const marks = marksFor([finding("c", 90, 95), finding("a", 2, 5), finding("b", 40, 44)]);
    expect(marks.map((m) => [m.index, m.span.start])).toEqual([
      [1, 2],
      [2, 40],
      [3, 90],
    ]);
  });

  it("leads each mark with its strongest finding", () => {
    const marks = marksFor([finding("low", 0, 9, "low"), finding("high", 0, 9, "high")]);
    expect(marks[0]!.findings[0]!.ruleId).toBe("high");
  });
});

describe("the phrase the share card leads with", () => {
  it("is the strongest, not the first", () => {
    const marks = marksFor([finding("first", 0, 5, "low"), finding("worst", 50, 60, "high")]);
    expect(headlineMark(marks)?.findings[0]?.ruleId).toBe("worst");
  });

  it("breaks a tie by reading order", () => {
    const marks = marksFor([finding("earlier", 5, 9, "high"), finding("later", 50, 60, "high")]);
    expect(headlineMark(marks)?.findings[0]?.ruleId).toBe("earlier");
  });

  it("is nothing at all when nothing was found", () => {
    expect(headlineMark([])).toBeUndefined();
  });
});
