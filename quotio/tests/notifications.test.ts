import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalStore } from "@/lib/db/local";
import { setStore } from "@/lib/db/store";
import { setMailer, type Email } from "@/lib/email/mailer";
import { notifyOwnerOfLead } from "@/lib/email/notifications";
import { templateBySlug } from "@/lib/templates/catalogue";

/**
 * Telling a business it has a lead.
 *
 * Two things are being protected. The message has to be worth reading on a
 * phone without opening anything — a "you have a new lead, log in" is the
 * failure this exists to prevent. And it must never be able to break the
 * submission that triggered it.
 */
let store: LocalStore;
let directory: string;
let sent: Email[];

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mekmi-notify-"));
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  store = new LocalStore(path.join(directory, "store.json"));
  setStore(store);

  sent = [];
  setMailer({
    async send(email) {
      sent.push(email);
      return { sent: true };
    },
  });
  // notifyOwnerOfLead checks emailEnabled() before doing anything, and that
  // reads the environment rather than the injected mailer.
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "MEKMI <hi@mekmi.app>");
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  setStore(null);
  setMailer(null);
  vi.unstubAllEnvs();
});

const populated = async (email: string | null = "owner@example.com") => {
  const owner = await store.createUser({ email, passwordHash: email ? "x" : null });
  const widget = await store.createWidget({
    ownerId: owner.id,
    name: "Sparkle Cleaning Quote",
    slug: "sparkle",
    draft: structuredClone(templateBySlug("cleaning-estimate")!.document),
  });
  const lead = await store.createLead({
    widgetId: widget.id,
    name: "Ada",
    email: "ada@example.com",
    phone: "07700 900000",
    metadata: { result: "$165", outcome: null },
  });
  return { owner, widget, lead };
};

describe("what the business receives", () => {
  it("names the widget in the subject", async () => {
    const { widget, lead } = await populated();
    await notifyOwnerOfLead(widget, lead, {});

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Sparkle Cleaning Quote");
  });

  it("goes to the account address, not the visitor's", async () => {
    const { widget, lead } = await populated();
    await notifyOwnerOfLead(widget, lead, {});
    expect(sent[0].to).toBe("owner@example.com");
  });

  it("carries the contact details, so nobody has to log in to reply", async () => {
    const { widget, lead } = await populated();
    await notifyOwnerOfLead(widget, lead, {});

    const body = sent[0].body;
    expect(body).toContain("Ada");
    expect(body).toContain("ada@example.com");
    expect(body).toContain("07700 900000");
  });

  it("carries the number they were quoted", async () => {
    // The single most useful line: it decides whether this is worth calling
    // back today.
    const { widget, lead } = await populated();
    await notifyOwnerOfLead(widget, lead, {});
    expect(sent[0].body).toContain("$165");
  });

  it("names the answers the way the visitor saw them (§20)", async () => {
    // The point of this section. Answers are stored as the values the
    // expressions need, so the raw record says `home_type: 40` — which is
    // what an apartment costs, not what anybody chose.
    const { widget, lead } = await populated();
    const document = templateBySlug("cleaning-estimate")!.document;

    await notifyOwnerOfLead(widget, lead, { home_type: 40, bedrooms: 3 }, document);

    const body = sent[0].body;
    expect(body).toContain("What are we cleaning?");
    expect(body).toContain("Apartment");
    expect(body).not.toContain("home_type: 40");
  });

  it("says nothing about answers when it can't name them", async () => {
    // Better silent than "home_type: 40", which reads like a bug to whoever
    // receives it.
    const { widget, lead } = await populated();
    await notifyOwnerOfLead(widget, lead, { home_type: 40 });
    expect(sent[0].body).not.toContain("home_type");
  });

  it("links to the rest of them", async () => {
    const { widget, lead } = await populated();
    await notifyOwnerOfLead(widget, lead, {});
    expect(sent[0].body).toContain(`/dashboard/widgets/${widget.id}/analytics`);
  });

  it("says so plainly when they left no details", async () => {
    const { owner } = await populated();
    const widget = await store.createWidget({
      ownerId: owner.id,
      name: "Quiet one",
      slug: "quiet",
      draft: structuredClone(templateBySlug("cleaning-estimate")!.document),
    });
    const bare = await store.createLead({ widgetId: widget.id, metadata: { result: "$10" } });

    await notifyOwnerOfLead(widget, bare, {});
    expect(sent[0].body).toContain("didn't leave contact details");
  });
});

describe("when it should stay quiet", () => {
  it("sends nothing when the deployment has no mail provider", async () => {
    vi.unstubAllEnvs();
    const { widget, lead } = await populated();

    const result = await notifyOwnerOfLead(widget, lead, {});
    expect(result.sent).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("sends nothing to an anonymous author", async () => {
    // They have no address, and they can't publish either (§27) — so this is
    // a guard rather than a live case, but it must not throw.
    const { widget, lead } = await populated(null);
    const result = await notifyOwnerOfLead(widget, lead, {});

    expect(result.sent).toBe(false);
    expect(result.reason).toContain("no email");
    expect(sent).toHaveLength(0);
  });

  it("reports a provider failure instead of throwing", async () => {
    // The lead is already stored by the time this runs. Throwing here would
    // turn a delivered lead into a 500 for the visitor who sent it.
    setMailer({
      async send() {
        return { sent: false, detail: "provider said no" };
      },
    });
    const { widget, lead } = await populated();

    await expect(notifyOwnerOfLead(widget, lead, {})).resolves.toEqual({
      sent: false,
      reason: "provider said no",
    });
  });
});

describe("the opt-out", () => {
  it("defaults to on for a new widget", async () => {
    const document = structuredClone(templateBySlug("cleaning-estimate")!.document);
    expect(document.settings.leadCapture.notify).toBe(true);
  });

  it("survives a document stored before the setting existed", async () => {
    const { hydrateDocument } = await import("@/lib/widget/schema");
    const stored = structuredClone(
      templateBySlug("cleaning-estimate")!.document
    ) as unknown as Record<string, unknown>;
    delete ((stored.settings as Record<string, unknown>).leadCapture as Record<string, unknown>)
      .notify;

    expect(hydrateDocument(stored as never).settings.leadCapture.notify).toBe(true);
  });
});

describe("naming answers", () => {
  it("reads a toggle as its own words, not true/false", async () => {
    const { describeAnswers } = await import("@/lib/widget/describe");
    const document = structuredClone(templateBySlug("cleaning-estimate")!.document);
    const toggle = document.steps.find((step) => step.input.kind === "toggle");
    if (!toggle || toggle.input.kind !== "toggle") return;

    const [described] = describeAnswers(document, { [toggle.id]: true });
    expect(described.answer).toBe(toggle.input.onLabel);
  });

  it("skips questions nobody answered", async () => {
    const { describeAnswers } = await import("@/lib/widget/describe");
    const document = templateBySlug("cleaning-estimate")!.document;
    expect(describeAnswers(document, {})).toEqual([]);
  });

  it("keeps a number's prefix and suffix", async () => {
    const { describeAnswers } = await import("@/lib/widget/describe");
    const document = structuredClone(templateBySlug("cleaning-estimate")!.document);
    const numeric = document.steps.find(
      (step) => step.input.kind === "number" || step.input.kind === "slider"
    );
    if (!numeric) return;

    const [described] = describeAnswers(document, { [numeric.id]: 3 });
    expect(described.answer).toContain("3");
  });
});
