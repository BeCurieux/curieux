import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { funnelBySource } from "@/lib/analytics/metrics";
import { sevenDayReport, type RecentEvent, type ReportRow } from "@/lib/analytics/sales-report";
import { checkClaims } from "@/lib/ai/guard";
import { REFUND_POLICY } from "@/lib/billing/plans";
import type { BusinessProfile } from "@/lib/domain/profile";
import { EMAIL_CONSENT_TEXT, EMAIL_CONSENT_VERSION } from "@/content/consent";
import { LocalStore } from "@/lib/data/local";

const signup = (email: string, source: string | null = "instagram") => ({
  email,
  consentText: EMAIL_CONSENT_TEXT,
  consentVersion: EMAIL_CONSENT_VERSION,
  source,
  medium: "social",
  campaign: "fit-check-oct",
  landing: "/fit-check",
});

describe("email sign-ups", () => {
  it("records consent once, unsubscribes by token, and records a new consent on return", async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "empire-")), "db.json");
    const repo = new LocalStore(file).system();

    expect(await repo.recordEmailSignup(signup("a@example.test"))).toBe("new");
    expect(await repo.recordEmailSignup(signup("a@example.test"))).toBe("already");

    const stored = JSON.parse(readFileSync(file, "utf8")) as {
      emailSignups: { email: string; consentText: string; unsubscribeToken: string }[];
    };
    const row = stored.emailSignups[0]!;
    expect(stored.emailSignups).toHaveLength(1);
    expect(row.consentText).toBe(EMAIL_CONSENT_TEXT);
    expect(row.unsubscribeToken.length).toBeGreaterThanOrEqual(32);

    expect(await repo.unsubscribeEmail("not-a-real-token-not-a-real-token")).toBe(false);
    expect(await repo.unsubscribeEmail(row.unsubscribeToken)).toBe(true);
    expect(await repo.unsubscribeEmail(row.unsubscribeToken)).toBe(false);
    expect((await repo.adminMetrics()).emailSignups).toEqual({ active: 0, unsubscribed: 1 });

    expect(await repo.recordEmailSignup(signup("a@example.test"))).toBe("resubscribed");
    expect((await repo.adminMetrics()).emailSignups).toEqual({ active: 1, unsubscribed: 0 });
  });

  it("the consent wording says what she gets and how to stop", () => {
    expect(EMAIL_CONSENT_TEXT).toMatch(/five welcome emails/);
    expect(EMAIL_CONSENT_TEXT).toMatch(/unsubscribe at any time/);
  });
});

describe("marketing funnel", () => {
  it("counts funnel events by source and never guesses a missing one", () => {
    const f = funnelBySource([
      { name: "fit_check_viewed", props: { source: "instagram" } },
      { name: "fit_check_viewed", props: { source: "instagram" } },
      { name: "email_consent_given", props: { source: "instagram" } },
      { name: "purchase_verified", props: {} },
      { name: "generation_requested", props: { source: "instagram" } },
      { name: "landing_viewed", props: null },
    ]);
    expect(f).toEqual({
      instagram: { fit_check_viewed: 2, email_consent_given: 1 },
      "(none recorded)": { purchase_verified: 1, landing_viewed: 1 },
    });
  });
});

describe("marketing content (docs/marketing)", () => {
  const dir = "docs/marketing";
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const profile = {
    verifiedClaims: [],
    productsSummary: "",
    goal: "",
    prohibitedClaims: [],
  } as unknown as BusinessProfile;

  it.each(files)("%s passes the claims guard", (file) => {
    const text = readFileSync(`${dir}/${file}`, "utf8");
    expect(checkClaims(text.split("\n"), profile)).toEqual([]);
  });

  it("the calendar has 30 Reels and 13 carousels, and every paid mention carries the refund sentence", () => {
    const cal = readFileSync(`${dir}/30_DAY_CONTENT_CALENDAR.md`, "utf8");
    expect(cal.match(/^### Day \d+ · Reel/gm)).toHaveLength(30);
    expect(cal.match(/^### Day \d+ · Carousel/gm)).toHaveLength(13);
    for (const piece of cal
      .split(/^### /m)
      .filter((p) => /Income Fit Test/.test(p) && /US\$19/.test(p)))
      expect(piece).toContain(REFUND_POLICY);
    expect(cal).not.toMatch(/barrister|lawyer|counsel\b/i);
  });
});

describe("seven-day sales report", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const ev = (name: string, at: string, extra: Partial<RecentEvent> = {}): RecentEvent => ({
    name,
    at,
    source: null,
    path: null,
    anonymousId: null,
    ...extra,
  });
  const events = [
    ev("offer_viewed", "2026-10-25T01:00:00Z", { path: "income-fit-test", anonymousId: "a" }),
    ev("offer_viewed", "2026-10-24T01:00:00Z", { path: "income-fit-test", anonymousId: "a" }),
    ev("fit_check_viewed", "2026-10-24T02:00:00Z", { anonymousId: "b" }),
    ev("offer_clicked", "2026-10-24T03:00:00Z", { path: "fit-check" }),
    ev("offer_clicked", "2026-10-25T03:00:00Z", { path: "income-fit-test" }),
    ev("purchase_verified", "2026-10-25T04:00:00Z"),
    ev("offer_viewed", "2026-10-10T01:00:00Z", { path: "income-fit-test" }), // outside the window
  ];
  const row = (rows: ReportRow[], key: string) => rows.find((r) => r.key === key)!;

  it("covers the last seven days, oldest first", () => {
    const { days } = sevenDayReport(events, now, { gumroadConnected: true, emailOptInOn: true });
    expect(days).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("counts each funnel step and unique consenting visitors", () => {
    const { rows } = sevenDayReport(events, now, { gumroadConnected: true, emailOptInOn: true });
    expect(row(rows, "product_views").total).toBe(2);
    expect(row(rows, "product_views").perDay.slice(-2)).toEqual([1, 1]);
    expect(row(rows, "visitors").total).toBe(2);
    expect(row(rows, "fit_check").total).toBe(1);
    expect(row(rows, "checkout_starts").total).toBe(1);
    expect(row(rows, "purchases").total).toBe(1);
    expect(row(rows, "refunds").total).toBe(0);
  });

  it("never shows a zero for sales it can't see", () => {
    const { rows } = sevenDayReport(events, now, { gumroadConnected: false, emailOptInOn: false });
    for (const key of ["purchases", "refunds", "email_consents", "website_visitors"]) {
      expect(row(rows, key).status).toBe("not_tracked");
      expect(row(rows, key).total).toBeNull();
      expect(row(rows, key).perDay.every((n) => n === null)).toBe(true);
    }
    expect(row(rows, "purchases").note).toMatch(/not the same as zero sales/);
  });
});
