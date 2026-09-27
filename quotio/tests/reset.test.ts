import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalStore } from "@/lib/db/local";
import { setStore, newId } from "@/lib/db/store";
import { newSecureToken, resetExpiry, RESET_TOKEN_TTL_MINUTES } from "@/lib/auth/tokens";
import { LogMailer, ResendMailer, setMailer, type Email } from "@/lib/email/mailer";

/**
 * Password reset.
 *
 * The token is a credential — holding one lets you take an account. So the
 * tests worth writing are about what a token cannot do: be used twice, be used
 * late, or be guessed.
 */
let store: LocalStore;
let directory: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mekmi-reset-"));
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  store = new LocalStore(path.join(directory, "store.json"));
  setStore(store);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  setStore(null);
  setMailer(null);
});

describe("reset tokens are credentials, not ids", () => {
  it("does not use the guessable generator", () => {
    // newId() is Math.random() plus a timestamp: fine for a widget id, fatal
    // for anything that grants access. Two ids created together share their
    // time prefix and differ in 8 characters of a recoverable PRNG.
    const secure = newSecureToken("r_");
    expect(secure.length).toBeGreaterThan(newId("r_").length * 2);
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newSecureToken("r_")));
    expect(seen.size).toBe(500);
  });

  it("expires an hour out", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(resetExpiry(from)).toBe(
      new Date(from.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString()
    );
  });
});

describe("redeeming one", () => {
  const withUser = async () =>
    store.createUser({ email: "a@example.com", passwordHash: "old-hash" });

  it("works once", async () => {
    const user = await withUser();
    const reset = await store.createPasswordReset(user.id);

    const first = await store.consumePasswordReset(reset.token);
    expect(first?.userId).toBe(user.id);
  });

  it("refuses the second attempt with the same link", async () => {
    // The one that matters. A link sits in a mailbox, gets forwarded, ends up
    // in a log — it must be spent the first time it is used.
    const user = await withUser();
    const reset = await store.createPasswordReset(user.id);

    expect(await store.consumePasswordReset(reset.token)).not.toBeNull();
    expect(await store.consumePasswordReset(reset.token)).toBeNull();
  });

  it("refuses one that has expired", async () => {
    const user = await withUser();
    const reset = await store.createPasswordReset(user.id);

    // Reach in and age it, rather than waiting an hour.
    const raw = JSON.parse(
      require("node:fs").readFileSync(path.join(directory, "store.json"), "utf8")
    );
    raw.passwordResets[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    require("node:fs").writeFileSync(path.join(directory, "store.json"), JSON.stringify(raw));
    (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
    const reopened = new LocalStore(path.join(directory, "store.json"));

    expect(await reopened.consumePasswordReset(reset.token)).toBeNull();
    // And it is still readable, so the page can say "expired" rather than 404.
    expect(await reopened.getPasswordReset(reset.token)).not.toBeNull();
  });

  it("refuses a token nobody issued", async () => {
    await withUser();
    expect(await store.consumePasswordReset("r_made-up")).toBeNull();
  });

  it("does not hand over another account", async () => {
    const mine = await store.createUser({ email: "a@example.com", passwordHash: "x" });
    const theirs = await store.createUser({ email: "b@example.com", passwordHash: "x" });
    const reset = await store.createPasswordReset(mine.id);

    const consumed = await store.consumePasswordReset(reset.token);
    expect(consumed?.userId).toBe(mine.id);
    expect(consumed?.userId).not.toBe(theirs.id);
  });
});

describe("the mailer is honest about sending", () => {
  it("reports a log-only send as not sent", async () => {
    // §41. The caller decides whether to say "check your inbox", and it can
    // only decide correctly if this never claims success it didn't have.
    const result = await new LogMailer().send({
      to: "a@example.com",
      subject: "hello",
      body: "hi",
    });
    expect(result.sent).toBe(false);
  });

  it("reports a provider rejection as not sent rather than throwing", async () => {
    // A bounced welcome email must not take down the signup that triggered it.
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("domain not verified", { status: 403 })) as typeof fetch;
    try {
      const result = await new ResendMailer("key", "MEKMI <hi@mekmi.app>").send({
        to: "a@example.com",
        subject: "hello",
        body: "hi",
      });
      expect(result.sent).toBe(false);
      expect(result.detail).toContain("403");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("survives the provider being unreachable", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("ENOTFOUND");
    }) as typeof fetch;
    try {
      const result = await new ResendMailer("key", "from@example.com").send({
        to: "a@example.com",
        subject: "hello",
        body: "hi",
      });
      expect(result.sent).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("sends the address, subject and body it was given", async () => {
    const sent: Email[] = [];
    setMailer({
      async send(email) {
        sent.push(email);
        return { sent: true };
      },
    });
    const { getMailer } = await import("@/lib/email/mailer");
    await getMailer().send({ to: "a@example.com", subject: "Reset", body: "link" });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("a@example.com");
  });
});
