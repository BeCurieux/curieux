// Email.
//
// The rule being defended: an email never carries the archive. Every message
// this product can send is built here and checked, because a message that
// leaks a child's private life into a third party's logs cannot be recalled.

import { beforeEach, describe, expect, it } from "vitest";
import {
  bookReady, containsArchiveContent, contributionsWaiting, invitation,
  orderPlaced, orderShipped, yearClosing,
} from "@/lib/email/messages";
import { CLOSING_WEEKS, isClosingDay, weeksUntilBirthday } from "@/lib/email/digest";
import { dailyKey, isTransactional, type EmailKind } from "@/lib/email/send";
import { MockEmailProvider } from "@/lib/email/mock";

const to = { email: "parent@example.com" };

/** Every message the product can send, built with realistic input. */
const ALL_MESSAGES = () => [
  invitation({ to, childName: "Florence", invitedByName: "Alex", token: "tok" }),
  contributionsWaiting({ to, childName: "Florence", count: 3, subjectId: "s1", optOutToken: "o" }),
  bookReady({ to, childName: "Florence", bookTitle: "The Year You Were Two", bookId: "b1" }),
  orderPlaced({ to, bookTitle: "The Year You Were Two", orderId: "o1", copies: 3 }),
  orderShipped({ to, bookTitle: "The Year You Were Two", orderId: "o1", trackingUrl: "https://t" }),
  yearClosing({ to, childName: "Florence", subjectId: "s1", weeksLeft: 3, optOutToken: "o" }),
];

describe("no email ever carries the archive", () => {
  it("passes the guard for every message the product can send", () => {
    for (const m of ALL_MESSAGES()) {
      expect(containsArchiveContent(m), m.subject).toBe(false);
    }
  });

  it("catches a quoted phrase, which is how the archive stores speech", () => {
    // If anyone ever puts a child's words in a subject line, this fires.
    expect(containsArchiveContent({
      to, subject: `Florence said "I do it myself"`, text: "…",
    })).toBe(true);
  });

  it("catches archive content in the body as well as the subject", () => {
    expect(containsArchiveContent({
      to, subject: "Something waiting", text: `She said “Bun Bun tired now” this morning.`,
    })).toBe(true);
  });

  it("never puts a photograph or attachment in a message", () => {
    for (const m of ALL_MESSAGES()) {
      expect(m).not.toHaveProperty("attachments");
      expect(m.html ?? "").not.toMatch(/<img/i);
    }
  });
});

describe("messages say enough to act on and no more", () => {
  it("always gives somewhere to go", () => {
    for (const m of ALL_MESSAGES()) {
      expect(m.text, m.subject).toMatch(/https?:\/\//);
    }
  });

  it("names the child, because a nameless note about your child is worse", () => {
    const m = contributionsWaiting({ to, childName: "Florence", count: 2, subjectId: "s", optOutToken: "o" });
    expect(m.subject).toContain("Florence");
  });

  it("counts in words, as the rest of the product does", () => {
    const m = contributionsWaiting({ to, childName: "Florence", count: 3, subjectId: "s", optOutToken: "o" });
    expect(m.subject).toContain("three things");
  });

  it("uses the singular for one", () => {
    const m = contributionsWaiting({ to, childName: "Florence", count: 1, subjectId: "s", optOutToken: "o" });
    expect(m.subject).toContain("one thing");
  });
});

describe("consent", () => {
  const KINDS: EmailKind[] = [
    "invitation", "contributions_waiting", "book_ready",
    "order_placed", "order_shipped", "year_closing",
  ];

  it("treats what someone paid for as transactional", () => {
    for (const k of ["book_ready", "order_placed", "order_shipped", "invitation"] as EmailKind[]) {
      expect(isTransactional(k), k).toBe(true);
    }
  });

  it("lets the nudges be switched off", () => {
    expect(isTransactional("contributions_waiting")).toBe(false);
    expect(isTransactional("year_closing")).toBe(false);
  });

  it("offers a way out of everything that is optional", () => {
    const optional = [
      contributionsWaiting({ to, childName: "F", count: 1, subjectId: "s", optOutToken: "tok" }),
      yearClosing({ to, childName: "F", subjectId: "s", weeksLeft: 3, optOutToken: "tok" }),
    ];
    for (const m of optional) expect(m.text).toContain("/settings/notifications");
  });

  it("does not clutter transactional mail with an opt-out it cannot honour", () => {
    const m = bookReady({ to, childName: "F", bookTitle: "T", bookId: "b" });
    expect(m.text).not.toContain("/settings/notifications");
  });

  it("classifies every kind", () => {
    for (const k of KINDS) expect(typeof isTransactional(k)).toBe("boolean");
  });
});

describe("a flood of contributions is one message, not forty", () => {
  const day = (s: string) => new Date(`${s}T09:00:00Z`);

  it("collapses everything on a day into a single key", () => {
    expect(dailyKey("contributions_waiting", "s1", day("2027-03-14")))
      .toBe(dailyKey("contributions_waiting", "s1", new Date("2027-03-14T23:30:00Z")));
  });

  it("tells them again the next day", () => {
    expect(dailyKey("contributions_waiting", "s1", day("2027-03-14")))
      .not.toBe(dailyKey("contributions_waiting", "s1", day("2027-03-15")));
  });

  it("keeps families separate", () => {
    expect(dailyKey("contributions_waiting", "s1", day("2027-03-14")))
      .not.toBe(dailyKey("contributions_waiting", "s2", day("2027-03-14")));
  });
});

describe("the year closing — the one message that asks for something", () => {
  const at = (s: string) => new Date(`${s}T12:00:00`);

  it("counts whole weeks to the next birthday", () => {
    expect(weeksUntilBirthday("2024-04-14", at("2027-03-24"))).toBe(3);
  });

  it("fires exactly three weeks out and not otherwise", () => {
    expect(isClosingDay("2024-04-14", at("2027-03-24"))).toBe(true);
    expect(isClosingDay("2024-04-14", at("2027-03-17"))).toBe(false);
    expect(isClosingDay("2024-04-14", at("2027-04-07"))).toBe(false);
  });

  it("looks to next year once this year's birthday has gone", () => {
    // Mid-April, birthday just passed: nearly a full year away, not zero.
    expect(weeksUntilBirthday("2024-04-14", at("2027-04-20"))).toBeGreaterThan(45);
  });

  it("says how long is left, in the message", () => {
    const m = yearClosing({ to, childName: "Florence", subjectId: "s", weeksLeft: CLOSING_WEEKS, optOutToken: "o" });
    expect(m.subject).toContain("three weeks");
  });

  it("does not manufacture urgency about a childhood", () => {
    const m = yearClosing({ to, childName: "Florence", subjectId: "s", weeksLeft: 3, optOutToken: "o" });
    for (const word of ["hurry", "last chance", "don't miss", "act now", "!"]) {
      expect(m.text.toLowerCase()).not.toContain(word);
    }
  });
});

describe("the mock provider, which is the default", () => {
  beforeEach(() => MockEmailProvider.reset());

  it("records rather than sends, so nothing escapes by accident", async () => {
    const p = new MockEmailProvider();
    await p.send(bookReady({ to, childName: "F", bookTitle: "T", bookId: "b" }));
    expect(MockEmailProvider.sent).toHaveLength(1);
    expect(MockEmailProvider.sent[0].to.email).toBe("parent@example.com");
  });

  it("is what you get unless a provider is chosen deliberately", () => {
    expect(process.env.EMAIL_PROVIDER ?? "mock").toBe("mock");
  });
});
