import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkClaims } from "@/lib/ai/guard";
import { calculate } from "@/lib/ads/calculator";
import { CONSUMER_RIGHTS, REFUND_POLICY } from "@/lib/billing/plans";
import type { BusinessProfile } from "@/lib/domain/profile";

// The welcome sequence follows the house rules: claims guard, the exact
// refund sentence wherever a price appears, a way to stop on every email,
// and no pressure.

const text = readFileSync("content/emails/welcome-sequence.md", "utf8");
const emails = text
  .split(/^## Email /m)
  .slice(1)
  .map((body) => ({ name: body.split("\n")[0]!, body }));

const profile = {
  verifiedClaims: [],
  productsSummary: "",
  goal: "",
  prohibitedClaims: [],
} as unknown as BusinessProfile;

describe("welcome sequence", () => {
  it("has five emails, each with a subject and preview", () => {
    expect(emails).toHaveLength(5);
    for (const e of emails) {
      expect(e.body, e.name).toMatch(/^\*\*Subject:\*\* .+/m);
      expect(e.body, e.name).toMatch(/^\*\*Preview:\*\* .+/m);
    }
  });

  it.each(emails)("email $name passes the claims guard and has an unsubscribe line", (e) => {
    expect(checkClaims(e.body.split("\n"), profile)).toEqual([]);
    expect(e.body).toMatch(/unsubscribe link/);
    expect(e.body).not.toMatch(/last chance|ends (tonight|soon)|only \d+ left|hurry|countdown/i);
  });

  it("uses the exact refund sentence wherever a price appears", () => {
    for (const e of emails.filter((x) => /US\$\d/.test(x.body)))
      expect(e.body, e.name).toContain(`${REFUND_POLICY} ${CONSUMER_RIGHTS}`);
  });

  it("its worked figure matches the calculator", () => {
    const r = calculate({ price: 49, fees: { percent: 0.1, fixed: 0.8 }, refundRate: 0.03 });
    expect(text).toContain(`A$${r.perOrder.contribution.toFixed(2)}`);
  });
});
