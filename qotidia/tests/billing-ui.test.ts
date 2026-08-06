// Stopping.
//
// The product could start a subscription and had no way to end one from
// inside itself. That is a support burden, and in Australia a subscription
// must be as easy to leave as it was to join, so it was arguably a
// compliance problem too.
//
// These tests are mostly about the *absence* of things — no confirmation
// gauntlet, no retention offer, no immediate cut-off. Absences are what
// erode; nobody ever notices a dark pattern being added one step at a time.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "./helpers/source";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const actions = read("src/app/actions.ts");
const page = read("src/app/settings/billing/page.tsx");
const stripe = read("src/lib/stripe.ts");

const cancelFn = actions.slice(
  actions.indexOf("export async function cancelMembership"),
  actions.indexOf("export async function resumeMembershipAction")
);

describe("stopping a membership", () => {
  it("can be done from inside the product at all", () => {
    expect(actions).toContain("export async function cancelMembership");
    expect(page).toContain("Stop the membership");
  });

  it("ends at the end of the period already paid for, not immediately", () => {
    // Taking away the month they just bought is both mean and a refund
    // request waiting to happen.
    expect(stripe).toContain("cancel_at_period_end: true");
    expect(cancelFn).toContain("endMembership");
  });

  it("asks for no reason and offers no deal", () => {
    // A product whose claim is that a family's memories are theirs cannot
    // make leaving harder than joining.
    const code = codeOnly(page);
    expect(code).not.toMatch(/are you sure/i);
    expect(code).not.toMatch(/before you go|special offer|discount|why are you leaving|reason for/i);
    expect(code).not.toMatch(/confirm.*cancel|type .*CANCEL/i);
  });

  it("says what happens to the archive, on the same screen as the button", () => {
    // Not behind a link, and not discovered afterwards.
    expect(page).toContain("CANCELLATION_PROMISE");
  });

  it("is recorded, so a question about it a year later has an answer", () => {
    expect(cancelFn).toContain('from("billing_events")');
    expect(cancelFn).toContain("cancel_requested");
  });

  it("only lets the person who owns the archive change the plan", () => {
    expect(cancelFn).toContain("ownedFamily");
    const owned = actions.slice(actions.indexOf("async function ownedFamily"));
    expect(owned).toContain("canManageAccess");
  });
});

describe("changing your mind", () => {
  it("can be undone before it takes effect", () => {
    // That window is exactly when people reconsider, and making them
    // re-subscribe would lose the months already counted toward this year's
    // book — a punishment for hesitating.
    expect(stripe).toContain("cancel_at_period_end: false");
    expect(actions).toContain("export async function resumeMembershipAction");
    expect(page).toContain("Start it again");
  });

  it("keeps the months already paid", () => {
    expect(page).toMatch(/months you already paid still count/i);
  });
});

describe("what the page shows", () => {
  it("reads the price from the same helper that charges", () => {
    expect(page).toContain("bookPriceFor");
  });

  it("shows the record we keep ourselves, not only Stripe's", () => {
    // A dispute a year from now is decided by whoever has a record.
    expect(page).toContain('from("billing_events")');
  });

  it("is reachable from the settings a parent already visits", () => {
    const privacy = read("src/app/settings/privacy/page.tsx");
    expect(privacy).toContain('href="/settings/billing"');
  });
});
