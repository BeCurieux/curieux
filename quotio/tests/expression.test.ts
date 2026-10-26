import { describe, expect, it } from "vitest";
import {
  ExpressionError,
  compileExpression,
  evaluate,
  evaluateExpression,
  isValidExpression,
  toNumber,
} from "@/lib/widget/expression";

const run = (source: string, scope: Record<string, unknown> = {}) =>
  evaluate(compileExpression(source).ast, scope);

describe("arithmetic", () => {
  it("respects precedence and associativity", () => {
    expect(run("2 + 3 * 4")).toBe(14);
    expect(run("(2 + 3) * 4")).toBe(20);
    expect(run("10 - 3 - 2")).toBe(5);
    expect(run("100 / 10 / 2")).toBe(5);
    expect(run("7 % 4")).toBe(3);
  });

  it("handles unary minus and decimals", () => {
    expect(run("-5 + 2")).toBe(-3);
    expect(run("-(3 * 2)")).toBe(-6);
    expect(run("0.1 + 0.2")).toBeCloseTo(0.3, 10);
    expect(run("2 * -3")).toBe(-6);
  });

  it("reads variables from the scope", () => {
    expect(run("bedrooms * 35 + bathrooms * 25", { bedrooms: 3, bathrooms: 2 })).toBe(155);
  });

  it("supports the allowed functions only", () => {
    expect(run("min(10, 4, 7)")).toBe(4);
    expect(run("max(10, 4)")).toBe(10);
    expect(run("round(2.567, 2)")).toBe(2.57);
    expect(run("round(2.5)")).toBe(3);
    expect(run("ceil(2.1)")).toBe(3);
    expect(run("floor(2.9)")).toBe(2);
  });
});

describe("safety", () => {
  it("rejects anything that isn't arithmetic", () => {
    const attacks = [
      "process.exit(1)",
      "this.foo",
      "a['b']",
      "fetch('http://x')",
      "1; drop table widgets",
      "`${x}`",
      "() => 1",
      "x ? 1 : 2",
      "1 && 2",
      "2 ** 32",
      "1 | 2",
      'require("fs")',
    ];
    for (const source of attacks) {
      expect(() => compileExpression(source), source).toThrow();
    }
  });

  it("treats dangerous-looking words as ordinary, empty variables", () => {
    // These parse as bare identifiers. That is safe because a variable is only
    // ever an own-property lookup on the scope we pass in — it can never walk
    // up to Object.prototype and return a function.
    for (const name of ["globalThis", "constructor", "__proto__", "process"]) {
      expect(run(name, {}), name).toBe(0);
    }
    expect(run("constructor + 1", { constructor: 4 })).toBe(5);
  });

  it("rejects unknown functions", () => {
    expect(() => compileExpression("sqrt(9)")).toThrow(ExpressionError);
    expect(() => compileExpression("eval(9)")).toThrow(ExpressionError);
  });

  it("checks arity", () => {
    expect(() => compileExpression("ceil(1, 2)")).toThrow(/argument/);
    expect(() => compileExpression("round()")).toThrow();
  });

  it("rejects unknown fields when a field list is supplied", () => {
    expect(() => compileExpression("bedrooms * 2", ["bathrooms"])).toThrow(/Unknown field/);
    expect(compileExpression("bedrooms * 2", ["bedrooms"]).variables).toEqual(["bedrooms"]);
  });

  it("refuses malformed input instead of guessing", () => {
    for (const source of ["", "   ", "1 +", "* 3", "(1 + 2", "1 2", "min(1,)"]) {
      expect(() => compileExpression(source), JSON.stringify(source)).toThrow();
    }
  });

  it("caps length and nesting", () => {
    expect(() => compileExpression("1 +".repeat(900) + "1")).toThrow();
    expect(() => compileExpression("(".repeat(64) + "1" + ")".repeat(64))).toThrow(/deeply/);
  });
});

describe("value coercion", () => {
  it("turns widget answers into numbers", () => {
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("large")).toBe(0);
    expect(toNumber([30, 20])).toBe(50);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
  });

  it("prices a toggle by multiplying it", () => {
    expect(run("oven * 30", { oven: true })).toBe(30);
    expect(run("oven * 30", { oven: false })).toBe(0);
  });

  it("sums multi-select answers", () => {
    expect(run("extras", { extras: [30, 20, 15] })).toBe(65);
  });
});

describe("failure behaviour", () => {
  it("never returns Infinity or NaN to a customer's screen", () => {
    expect(run("10 / 0")).toBe(0);
    expect(run("10 % 0")).toBe(0);
    expect(evaluateExpression("bedrooms / rooms", { bedrooms: 3, rooms: 0 })).toBe(0);
  });

  it("falls back rather than throwing at runtime", () => {
    expect(evaluateExpression("this is not valid", {}, 42)).toBe(42);
    expect(isValidExpression("total + 1")).toBe(true);
    expect(isValidExpression("total +")).toBe(false);
  });
});
