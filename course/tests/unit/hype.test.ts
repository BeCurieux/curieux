import { describe, expect, it } from "vitest";
import { MAX_LENGTH, redact, RUBRIC, scoreHype } from "@/lib/hype/score";

describe("Hype Check", () => {
  it("scores a hype post high and names what it leaves out", () => {
    const post =
      "I made $10k a month in 90 days with passive income! Anyone can do it, results guaranteed. Only 5 spots left, act now.";
    const result = scoreHype(post);
    expect(result.signals.map((s) => s.id)).toEqual([
      "money_timeframe",
      "passive",
      "guaranteed",
      "anyone_can",
      "urgency",
    ]);
    expect(result.score).toBe(100);
    expect(result.band).toBe("Heavy hype");
    expect(result.leavesOut).toEqual([
      "What it cost: stock, ads, fees, the tools.",
      "How many hours it takes.",
      "What's typical, rather than the best case.",
    ]);
  });

  it("adds up the weights, counting each signal up to its max", () => {
    // money with a timeframe ×1 (25), passive ×2 (30), no costs (10), no hours (10)
    const result = scoreHype("Passive, passive, passive. $500 per week.");
    expect(result.score).toBe(25 + 15 * 2 + 10 + 10);
    expect(result.band).toBe("Heavy hype");
  });

  it("doesn't mark down a grounded post for what it doesn't claim", () => {
    const post =
      "We sold 40 candles last month. Stock cost $6 each, plus fees, and I spent about 10 hours a week. Most people take 2 years to break even.";
    const result = scoreHype(post);
    expect(result.signals).toEqual([]);
    expect(result.score).toBe(0);
    expect(result.band).toBe("Mostly grounded");
    expect(result.leavesOut).toEqual(["Anything that didn't work."]);
  });

  it("only adds the costs and hours penalties when they're missing", () => {
    const withBoth = scoreHype("Guaranteed sales! It cost me $200 in stock and 5 hours.");
    expect(withBoth.score).toBe(20);
    expect(withBoth.band).toBe("Mostly grounded");
    const withNeither = scoreHype("Guaranteed sales!");
    expect(withNeither.score).toBe(40);
    expect(withNeither.band).toBe("Some hype");
  });

  it("recognises amounts in other forms", () => {
    for (const text of [
      "US$3,000/month easy",
      "A$1.5k a week",
      "£200 every day",
      "a six-figure business",
      "€9000 in 30 days",
    ])
      expect(
        scoreHype(text).signals.map((s) => s.id),
        text,
      ).toContain("money_timeframe");
    expect(scoreHype("It costs $40 to start").signals).toEqual([]);
  });

  it("every rubric pattern is a valid regular expression", () => {
    for (const entry of [...RUBRIC.signals, ...RUBRIC.omissions])
      for (const p of entry.patterns) expect(() => new RegExp(p, "gi")).not.toThrow();
  });
});

describe("redact", () => {
  it("removes emails, links, handles and phone numbers before logging", () => {
    expect(
      redact(
        "DM @jess.makes or email jess@example.com, see https://x.co/a and www.shop.com, call +61 412 345 678",
      ),
    ).toBe("DM [handle] or email [email], see [link] and [link], call [phone]");
  });
  it("keeps the words that matter for tuning", () => {
    expect(redact("I made $10k a month in 90 days")).toBe("I made $10k a month in 90 days");
  });
  it("caps the length", () => {
    expect(redact("a".repeat(MAX_LENGTH + 50))).toHaveLength(MAX_LENGTH);
  });
});
