import { describe, expect, it } from "vitest";
import { getMarket } from "@/config/markets";
import { brand, PRODUCT_NAME } from "@/config/brand";
import {
  feedbackRequestEmail,
  generationFailedEmail,
  pilotEndingEmail,
  weeklyPlanEmail,
  welcomeEmail,
} from "@/lib/notifications/templates";
import { MockNotificationProvider } from "@/lib/notifications";
import { EXAMPLE_BACKUP, EXAMPLE_PLAN } from "@/lib/example-plan";

const market = getMarket("sydney");
const UNSUBSCRIBE = "https://example.test/unsubscribe?t=abc";

describe("the Thursday plan email (§23)", () => {
  const rendered = weeklyPlanEmail({
    plan: EXAMPLE_PLAN,
    backup: EXAMPLE_BACKUP,
    market,
    recipientName: null,
    unsubscribeUrl: UNSUBSCRIBE,
  });

  it("uses one of the brief's subject lines", () => {
    expect([
      "Your Saturday is sorted.",
      "Your weekend is ready.",
      "We planned this one for you.",
    ]).toContain(rendered.subject);
  });

  it("carries the plan title, the shape of the day and the four deciding facts", () => {
    expect(rendered.html).toContain(EXAMPLE_PLAN.title);
    // Weather, cost, activity level and travel — what decides whether it happens.
    expect(rendered.html).toContain("24°C and sunny");
    expect(rendered.html).toContain("65");
    expect(rendered.html).toContain("Easy");
    expect(rendered.html).toContain("28 min from home");
  });

  it("labels costs as estimates rather than stating a price (§22)", () => {
    expect(rendered.html).toMatch(/estimate/i);
  });

  it("links to the full plan rather than reproducing it", () => {
    expect(rendered.html).toContain(`/app/plans/${EXAMPLE_PLAN.id}`);
    // The timeline is a summary: travel legs stay in the app.
    expect(rendered.html).not.toContain("Head home");
  });

  it("offers the backup as an escape hatch, not a second option", () => {
    expect(rendered.html).toContain("Too tired?");
    expect(rendered.html).toContain(EXAMPLE_BACKUP.title);
  });

  it("includes the fit reason, which is the sentence that sells the product", () => {
    expect(rendered.html).toContain("consistently liked water");
  });

  it("always includes a working unsubscribe link", () => {
    expect(rendered.html).toContain(UNSUBSCRIBE);
    expect(rendered.text).toContain(UNSUBSCRIBE);
  });

  it("has a plain-text alternative carrying the same plan", () => {
    expect(rendered.text).toContain(EXAMPLE_PLAN.title);
    // Stops, with their times — the travel legs stay in the app, same as the
    // HTML version, so the two alternatives say the same thing.
    expect(rendered.text).toContain("10:05");
    expect(rendered.text).toContain("Easy 5.4 km waterfront walk");
  });

  it("reads the brand name from config, never a literal", () => {
    expect(rendered.html).toContain(PRODUCT_NAME);
    expect(rendered.html).toContain(brand.supportEmail);
  });

  it("escapes HTML in venue names, which are third-party strings (§50)", () => {
    const hostile = {
      ...EXAMPLE_PLAN,
      title: '<script>alert("x")</script> Cafe',
    };
    const output = weeklyPlanEmail({
      plan: hostile,
      backup: null,
      market,
      recipientName: null,
      unsubscribeUrl: UNSUBSCRIBE,
    });
    expect(output.html).not.toContain("<script>");
    expect(output.html).toContain("&lt;script&gt;");
  });

  it("renders without a backup", () => {
    const output = weeklyPlanEmail({
      plan: EXAMPLE_PLAN,
      backup: null,
      market,
      recipientName: null,
      unsubscribeUrl: UNSUBSCRIBE,
    });
    expect(output.html).not.toContain("Too tired?");
  });

  it("uses no external images, so it renders with images off", () => {
    expect(rendered.html).not.toMatch(/<img/i);
  });
});

describe("the Sunday feedback email (§24)", () => {
  const rendered = feedbackRequestEmail({
    plan: EXAMPLE_PLAN,
    market,
    token: "tok",
    unsubscribeUrl: UNSUBSCRIBE,
  });

  it("asks the one question that matters", () => {
    expect(rendered.subject).toBe("Did you do it?");
  });

  it("makes yes and no answerable in one tap from the inbox", () => {
    // The north-star metric depends on this being a single click, so the
    // answer travels in the link rather than waiting behind a form.
    expect(rendered.html).toContain("did=yes");
    expect(rendered.html).toContain("did=no");
  });

  it("names the plan so they remember what is being asked about", () => {
    expect(rendered.html).toContain(EXAMPLE_PLAN.title);
  });
});

describe("lifecycle emails", () => {
  it("tells the truth when we could not build a good plan (§39)", () => {
    const rendered = generationFailedEmail({ unsubscribeUrl: UNSUBSCRIBE });
    expect(rendered.html).toMatch(/couldn[’']t build one we[’']d genuinely recommend/i);
    // It must not offer a worse plan as consolation.
    expect(rendered.html).not.toMatch(/here([’']s| is) (a|an|another)/i);
  });

  it("reports honest numbers in the pilot conversion email", () => {
    const rendered = pilotEndingEmail({
      weekendsDone: 4,
      didItCount: 3,
      upgradeUrl: "https://example.test/upgrade",
      unsubscribeUrl: UNSUBSCRIBE,
    });
    expect(rendered.html).toContain("3");
    expect(rendered.html).toContain("https://example.test/upgrade");
  });

  it("sets expectations about the first delivery in the welcome email", () => {
    const rendered = welcomeEmail({
      onboardingUrl: "https://example.test/onboarding",
      firstDeliveryLabel: "Thursday 12 March",
      unsubscribeUrl: UNSUBSCRIBE,
    });
    expect(rendered.html).toContain("Thursday 12 March");
    expect(rendered.html).toContain(brand.tagline);
  });
});

describe("notification provider", () => {
  it("records what would have been sent, in development", async () => {
    const provider = new MockNotificationProvider();
    const result = await provider.sendEmail({
      to: "person@example.test",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
      idempotencyKey: "key-1",
    });

    expect(result.ok).toBe(true);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.idempotencyKey).toBe("key-1");
  });
});
