import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/env";
import { EMAIL_CONSENT_TEXT, EMAIL_CONSENT_VERSION } from "@/content/consent";
import { LocalStore } from "@/lib/data/local";
import { resendSender, type EmailSender, type OutgoingEmail } from "@/lib/email/send";
import { dueStep, parseWelcomeSequence, renderWelcome } from "@/lib/email/sequence";
import { runWelcome, sendNextWelcome, type WelcomeDeps } from "@/lib/email/welcome";

const emails = parseWelcomeSequence(readFileSync("content/emails/welcome-sequence.md", "utf8"));
const DAY = 86_400_000;
const ctx = {
  appUrl: "https://studio.example.test",
  fitCheckUrl: "https://example.test/fit-check.pdf",
  incomeFitTestUrl: "https://herlittleempireco.gumroad.com/l/income-fit-test",
  unsubscribeUrl: "https://studio.example.test/unsubscribe?token=tok",
};

describe("the welcome sequence as sent", () => {
  it("reads five emails on days 0, 2, 4, 7 and 10", () => {
    expect(emails.map((e) => [e.step, e.day])).toEqual([
      [1, 0],
      [2, 2],
      [3, 4],
      [4, 7],
      [5, 10],
    ]);
  });

  it.each(emails)(
    "email $step fills every placeholder and ends with one-click unsubscribe",
    (e) => {
      const r = renderWelcome(e, ctx);
      for (const out of [r.text, r.html]) {
        expect(out).not.toMatch(/\[first name\]|\[Link:/);
        expect(out).toContain("unsubscribe?token=tok");
        expect(out).toContain("ABN 38 813 430 864");
      }
      expect(r.text).toMatch(/^Hi,$/m);
      expect(r.subject).toBe(e.subject);
      expect(r.html).toContain(e.preview.replace(/"/g, "&quot;"));
    },
  );

  it("links to the right places, tagging Studio links with the email they came from", () => {
    const text = (step: number) => renderWelcome(emails[step - 1]!, ctx).text;
    expect(text(1)).toContain(ctx.fitCheckUrl);
    expect(text(1)).toContain(
      "https://studio.example.test/fit?utm_source=email&utm_medium=welcome&utm_campaign=welcome-1",
    );
    expect(text(3)).toContain(
      "https://studio.example.test/ads/tools/calculator?utm_source=email&utm_medium=welcome&utm_campaign=welcome-3",
    );
    expect(text(4)).toContain(ctx.incomeFitTestUrl);
  });

  it("escapes HTML and keeps lists as lists", () => {
    const r = renderWelcome(
      {
        step: 9,
        day: 0,
        subject: "s",
        preview: "p",
        body: "Hi,\n\n1. a <b>\n2. b & c\n\n- x\n- y",
      },
      ctx,
    );
    expect(r.html).toContain("<ol><li>a &lt;b&gt;</li><li>b &amp; c</li></ol>");
    expect(r.html).toContain("<ul><li>x</li><li>y</li></ul>");
  });
});

describe("when each email is due", () => {
  const signup = (over: Partial<Parameters<typeof dueStep>[0]> = {}) => ({
    consentedAt: "2026-11-01T10:00:00.000Z",
    unsubscribedAt: null,
    welcomeSent: 0,
    welcomeLastSentAt: null,
    ...over,
  });
  const at = (days: number) => new Date(Date.parse("2026-11-01T10:00:00.000Z") + days * DAY);

  it("sends email 1 at once and email 2 from day 2", () => {
    expect(dueStep(signup(), emails, at(0))).toBe(1);
    const after1 = signup({ welcomeSent: 1, welcomeLastSentAt: at(0).toISOString() });
    expect(dueStep(after1, emails, at(1.9))).toBeNull();
    expect(dueStep(after1, emails, at(2))).toBe(2);
  });

  it("sends one at a time, at least 20 hours apart, even after a missed day", () => {
    const late = signup({ welcomeSent: 1, welcomeLastSentAt: at(9.5).toISOString() });
    expect(dueStep(late, emails, at(10))).toBeNull();
    expect(dueStep(late, emails, at(10.4))).toBe(2);
  });

  it("stops after five, and for anyone who unsubscribed", () => {
    expect(dueStep(signup({ welcomeSent: 5 }), emails, at(30))).toBeNull();
    expect(dueStep(signup({ unsubscribedAt: at(1).toISOString() }), emails, at(0))).toBeNull();
  });
});

describe("sending", () => {
  function setup(sender: EmailSender) {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "empire-")), "db.json");
    const repo = new LocalStore(file).system();
    let now = new Date("2026-11-01T10:00:00.000Z");
    const deps: WelcomeDeps = {
      repo,
      sender,
      emails,
      appUrl: ctx.appUrl,
      fitCheckUrl: ctx.fitCheckUrl,
      incomeFitTestUrl: ctx.incomeFitTestUrl,
      now: () => now,
    };
    const signUp = async (email: string) => {
      await repo.recordEmailSignup({
        email,
        consentText: EMAIL_CONSENT_TEXT,
        consentVersion: EMAIL_CONSENT_VERSION,
        source: null,
        medium: null,
        campaign: null,
        landing: "/fit-check",
      });
      return (await repo.findEmailSignup(email))!;
    };
    return {
      repo,
      deps,
      signUp,
      advance: (days: number) => (now = new Date(now.getTime() + days * DAY)),
    };
  }

  const recorder = () => {
    const sent: OutgoingEmail[] = [];
    const sender: EmailSender = {
      name: "outbox",
      send: async (e) => {
        sent.push(e);
        return { id: String(sent.length) };
      },
    };
    return { sent, sender };
  };

  it("sends the whole sequence once, with one-click unsubscribe headers", async () => {
    const { sent, sender } = recorder();
    const { repo, deps, signUp, advance } = setup(sender);
    const s = await signUp("a@example.test");

    expect(await sendNextWelcome(s, deps)).toBe("sent");
    expect(sent[0]!.to).toBe("a@example.test");
    expect(sent[0]!.headers["List-Unsubscribe"]).toBe(
      `<https://studio.example.test/api/unsubscribe?token=${s.unsubscribeToken}>`,
    );
    expect(sent[0]!.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent[0]!.idempotencyKey).toBe(`welcome-${s.id}-1`);

    for (let day = 1; day <= 12; day++) {
      advance(1);
      await runWelcome(deps);
    }
    expect(sent.map((e) => e.subject)).toEqual(emails.map((e) => e.subject));
    expect((await repo.findEmailSignup("a@example.test"))!.welcomeSent).toBe(5);
    advance(30);
    expect(await runWelcome(deps)).toEqual({ checked: 0, sent: 0, failed: 0 });
  });

  it("never sends the same email twice when two runs overlap", async () => {
    const { sent, sender } = recorder();
    const { deps, signUp } = setup(sender);
    const s = await signUp("b@example.test");
    const outcomes = await Promise.all([sendNextWelcome(s, deps), sendNextWelcome(s, deps)]);
    expect(outcomes.sort()).toEqual(["sent", "taken"]);
    expect(sent).toHaveLength(1);
  });

  it("hands the step back when sending fails, so the next run retries", async () => {
    let fail = true;
    const { sent, sender } = recorder();
    const flaky: EmailSender = {
      name: "resend",
      send: async (e) => {
        if (fail) throw new Error("down");
        return sender.send(e);
      },
    };
    const { repo, deps, signUp } = setup(flaky);
    const s = await signUp("c@example.test");
    expect(await sendNextWelcome(s, deps)).toBe("failed");
    expect((await repo.findEmailSignup("c@example.test"))!.welcomeSent).toBe(0);
    fail = false;
    expect(await runWelcome(deps)).toEqual({ checked: 1, sent: 1, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it("stops at once for someone who unsubscribes", async () => {
    const { sent, sender } = recorder();
    const { repo, deps, signUp, advance } = setup(sender);
    const s = await signUp("d@example.test");
    await sendNextWelcome(s, deps);
    await repo.unsubscribeEmail(s.unsubscribeToken);
    advance(3);
    expect(await runWelcome(deps)).toEqual({ checked: 0, sent: 0, failed: 0 });
    expect(sent).toHaveLength(1);
  });
});

describe("Resend", () => {
  const email: OutgoingEmail = {
    to: "a@example.test",
    subject: "Hello",
    text: "t",
    html: "<p>h</p>",
    headers: { "List-Unsubscribe": "<https://x.test/u>" },
    idempotencyKey: "welcome-1-1",
  };

  it("posts one email with the key, sender, reply-to and idempotency key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const sender = resendSender({
      apiKey: "re_test_key",
      from: "Vee <hello@herlittleempire.com>",
      replyTo: "hello@herlittleempire.com",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as typeof fetch,
    });
    expect(await sender.send(email)).toEqual({ id: "msg_1" });
    const { url, init } = calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_test_key");
    expect(headers["idempotency-key"]).toBe("welcome-1-1");
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "Vee <hello@herlittleempire.com>",
      to: ["a@example.test"],
      reply_to: "hello@herlittleempire.com",
      subject: "Hello",
      headers: { "List-Unsubscribe": "<https://x.test/u>" },
    });
  });

  it("reports a refusal without repeating the key", async () => {
    const sender = resendSender({
      apiKey: "re_secret_value",
      from: "a@b.test",
      replyTo: "a@b.test",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ message: "domain not verified" }), {
          status: 403,
        })) as unknown as typeof fetch,
    });
    const error = await sender.send(email).catch((e: Error) => e);
    expect(String(error)).toContain("domain not verified");
    expect(String(error)).not.toContain("re_secret_value");
  });
});

describe("production settings", () => {
  const base = {
    EMPIRE_BACKEND: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
    SUPABASE_SECRET_KEY: "sk",
    APP_URL: "https://studio.example.test",
    VERCEL_ENV: "production",
    EMPIRE_EMAIL_OPTIN: "on",
  };

  it("won't open the opt-in in production without a sender and the daily job", () => {
    expect(() => parseServerEnv(base)).toThrow(/RESEND_API_KEY.*EMAIL_FROM.*CRON_SECRET/);
    expect(() =>
      parseServerEnv({
        ...base,
        RESEND_API_KEY: "re_x",
        EMAIL_FROM: "Vee <hello@herlittleempire.com>",
        CRON_SECRET: "x".repeat(32),
      }),
    ).not.toThrow();
  });
});
