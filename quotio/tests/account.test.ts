import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalStore } from "@/lib/db/local";
import { setStore } from "@/lib/db/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createWidgetFor, isLimitError } from "@/lib/widgets/service";
import { templateBySlug } from "@/lib/templates/catalogue";

/**
 * These cover the store half of changing a password and closing an account.
 * The half that checks *who is asking* lives in lib/auth/session.ts, which is
 * request-scoped (`server-only`, reads cookies) and is exercised by the
 * browser walk instead.
 *
 * What matters here is that deleting takes everything with it. A leftover
 * session is an account someone can still act as; a leftover widget is a
 * calculator still serving a business that closed its account.
 */
let store: LocalStore;
let directory: string;

const cleaning = () => structuredClone(templateBySlug("cleaning-estimate")!.document);

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mekmi-account-"));
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  store = new LocalStore(path.join(directory, "store.json"));
  setStore(store);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
});

describe("changing a password", () => {
  it("replaces the hash, and the old password stops working", async () => {
    const user = await store.createUser({
      email: "a@example.com",
      passwordHash: await hashPassword("old-password"),
    });

    await store.setUserPassword(user.id, await hashPassword("new-password"));

    const after = await store.getUser(user.id);
    expect(await verifyPassword("new-password", after!.passwordHash)).toBe(true);
    expect(await verifyPassword("old-password", after!.passwordHash)).toBe(false);
  });

  it("signs out everywhere except the session doing the changing", async () => {
    // The point of the change may be that somebody else has your password.
    // Leaving their session alive would make it pointless.
    const user = await store.createUser({ email: "a@example.com", passwordHash: "x" });
    const mine = await store.createSession(user.id);
    const theirs = await store.createSession(user.id);
    const stranger = await store.createUser({ email: "b@example.com", passwordHash: "x" });
    const unrelated = await store.createSession(stranger.id);

    await store.deleteSessionsForUser(user.id, mine.token);

    expect(await store.getSession(mine.token)).not.toBeNull();
    expect(await store.getSession(theirs.token)).toBeNull();
    // Someone else's sessions are none of this operation's business.
    expect(await store.getSession(unrelated.token)).not.toBeNull();
  });

  it("can sign out every session when no token is kept", async () => {
    const user = await store.createUser({ email: "a@example.com", passwordHash: "x" });
    const one = await store.createSession(user.id);
    const two = await store.createSession(user.id);

    await store.deleteSessionsForUser(user.id);

    expect(await store.getSession(one.token)).toBeNull();
    expect(await store.getSession(two.token)).toBeNull();
  });
});

describe("closing an account", () => {
  const populated = async () => {
    const user = await store.createUser({
      email: "a@example.com",
      passwordHash: await hashPassword("password"),
    });
    const session = await store.createSession(user.id);
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");
    await store.publishWidget(created.id);
    await store.recordEvents([
      { widgetId: created.id, sessionId: "v1", type: "widget_view" },
      { widgetId: created.id, sessionId: "v1", type: "widget_start" },
    ]);
    await store.createLead({ widgetId: created.id, email: "visitor@example.com" });
    return { user, session, widgetId: created.id, slug: created.slug };
  };

  it("takes the user, their sessions, widgets, analytics and enquiries", async () => {
    const { user, session, widgetId } = await populated();

    await store.deleteUser(user.id);

    expect(await store.getUser(user.id)).toBeNull();
    expect(await store.getSession(session.token)).toBeNull();
    expect(await store.getWidget(widgetId)).toBeNull();
    expect(await store.listEvents(widgetId)).toEqual([]);
    expect(await store.countLeads(widgetId)).toBe(0);
    expect(await store.listWidgets(user.id)).toEqual([]);
  });

  it("stops a published widget resolving by its public slug", async () => {
    // Somebody's embed pointing at it must stop working, not keep serving a
    // calculator for a business that closed its account.
    const { user, slug } = await populated();
    expect(await store.getWidgetBySlug(slug)).not.toBeNull();

    await store.deleteUser(user.id);
    expect(await store.getWidgetBySlug(slug)).toBeNull();
  });

  it("leaves every other account untouched", async () => {
    const doomed = await populated();
    const keeper = await store.createUser({ email: "b@example.com", passwordHash: "x" });
    const keeperSession = await store.createSession(keeper.id);
    const theirs = await createWidgetFor(keeper.id, "pro", cleaning());
    if (isLimitError(theirs)) throw new Error("unexpected limit");
    await store.createLead({ widgetId: theirs.id, email: "someone@example.com" });

    await store.deleteUser(doomed.user.id);

    expect(await store.getUser(keeper.id)).not.toBeNull();
    expect(await store.getSession(keeperSession.token)).not.toBeNull();
    expect(await store.getWidget(theirs.id)).not.toBeNull();
    expect(await store.countLeads(theirs.id)).toBe(1);
  });

  it("survives being asked to delete an account that isn't there", async () => {
    await expect(store.deleteUser("u_nobody")).resolves.toBeUndefined();
  });

  it("is durable — the account is still gone after a reload", async () => {
    const { user, widgetId } = await populated();
    await store.deleteUser(user.id);

    (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
    const reopened = new LocalStore(path.join(directory, "store.json"));
    expect(await reopened.getUser(user.id)).toBeNull();
    expect(await reopened.getWidget(widgetId)).toBeNull();
  });
});
