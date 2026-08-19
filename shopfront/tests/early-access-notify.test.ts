/**
 * Telling somebody a merchant wrote in.
 *
 * The thing worth testing hardest here is not that an email goes out. It is
 * that **nothing about the email can cost us the merchant**. By the time the
 * notifier runs, a row exists in `public.early_access` — the message is
 * already safe — so every failure mode below has to end with the request still
 * succeeding and the row still being the record.
 *
 * The transport is injected for all of it, so no test needs a network, a key,
 * or anybody's inbox.
 */

import { describe, expect, it, vi } from "vitest";
import {
  composeEarlyAccessMail,
  notifyEarlyAccess,
  resendTransport,
  type Mail,
  type MailTransport,
} from "@/lib/earlyaccess/notify";
import type { EarlyAccessRecord } from "@/lib/earlyaccess/types";

function record(over: Partial<EarlyAccessRecord> = {}): EarlyAccessRecord {
  return {
    id: "row-1",
    name: "Ana Ruiz",
    email: "ana@casalino.example",
    store: "casalino.example",
    brief: "Something for the people who saw the Ibiza reel.",
    receivedAt: "2026-08-19T09:00:00.000Z",
    ...over,
  } as EarlyAccessRecord;
}

/** Records what it was handed and succeeds. */
function spy(): { transport: MailTransport; sent: Mail[] } {
  const sent: Mail[] = [];
  return {
    sent,
    transport: async (mail) => {
      sent.push(mail);
    },
  };
}

describe("notifying on an early-access request", () => {
  it("sends one message carrying what the merchant typed", async () => {
    const { transport, sent } = spy();
    const result = await notifyEarlyAccess(record(), { transport, to: "you@example.com", from: "popuup <no@example.com>" });

    expect(result.outcome).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("you@example.com");
    expect(sent[0]!.text).toContain("Ana Ruiz");
    expect(sent[0]!.text).toContain("casalino.example");
    expect(sent[0]!.text).toContain("Ibiza reel");
  });

  it("replies to the merchant, not to us", async () => {
    // The whole point of the email is that answering it is one tap. A
    // reply-to of our own address makes it a notification you then have to go
    // and act on somewhere else.
    const { transport, sent } = spy();
    await notifyEarlyAccess(record(), { transport, to: "you@example.com" });
    expect(sent[0]!.replyTo).toBe("ana@casalino.example");
  });

  it("subjects the message with the store", async () => {
    // An inbox sorted by subject is then sorted by the thing you would go
    // looking for.
    const { transport, sent } = spy();
    await notifyEarlyAccess(record(), { transport, to: "you@example.com" });
    expect(sent[0]!.subject).toContain("casalino.example");
  });

  it("says so when there is no brief rather than sending a blank line", async () => {
    const { transport, sent } = spy();
    await notifyEarlyAccess(record({ brief: undefined }), { transport, to: "you@example.com" });
    expect(sent[0]!.text).toMatch(/no brief/i);
  });

  it("skips silently when no transport is configured", async () => {
    // A deployment with no key — a preview, a local run, this project for its
    // whole life until now — records the row and says nothing. `skipped` is a
    // normal outcome and must not read as a failure in a log.
    const result = await notifyEarlyAccess(record(), { transport: null });
    expect(result.outcome).toBe("skipped");
    expect(result.reason).toBeUndefined();
  });

  it("reports a send failure instead of throwing it", async () => {
    /*
     * The one that matters. The row already exists when this runs, so a
     * notifier that threw would turn our missing email into the merchant's
     * 503 — telling somebody to write again when we already have what they
     * sent. It has to come back as a value the caller can log.
     */
    const transport: MailTransport = async () => {
      throw new Error("Resend answered 422: domain not verified");
    };

    const result = await notifyEarlyAccess(record(), { transport });
    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("422");
  });
});

describe("the Resend transport", () => {
  it("posts the message and never puts the key anywhere but the header", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await resendTransport("re_secret_key")({
      from: "popuup <no@example.com>",
      to: "you@example.com",
      replyTo: "ana@casalino.example",
      subject: "popuup — casalino.example",
      text: "body",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_secret_key");

    // The key must not travel in the body, where it would end up in any log
    // that records a request payload.
    expect(String(init.body)).not.toContain("re_secret_key");
    expect(JSON.parse(String(init.body)).reply_to).toBe("ana@casalino.example");

    vi.unstubAllGlobals();
  });

  it("raises with the status and Resend's own words, and without the key", async () => {
    const fetchMock = vi.fn(async () => new Response("domain not verified", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resendTransport("re_secret_key")({} as Mail)).rejects.toThrow(/422/);
    await expect(resendTransport("re_secret_key")({} as Mail)).rejects.not.toThrow(/re_secret_key/);

    vi.unstubAllGlobals();
  });
});

describe("the composed message", () => {
  it("carries the brief verbatim rather than a summary of it", () => {
    // The point of the email is to carry their words. Anything that trimmed,
    // truncated or rephrased them would make the table the only honest copy.
    const brief = "Two campaigns a month, and I photograph everything myself on a kitchen table.";
    const mail = composeEarlyAccessMail(record({ brief }), "you@example.com", "popuup <no@example.com>");
    expect(mail.text).toContain(brief);
  });

  it("names the table, so the reader knows email is not the system of record", () => {
    const mail = composeEarlyAccessMail(record(), "you@example.com", "popuup <no@example.com>");
    expect(mail.text).toContain("early_access");
  });
});
