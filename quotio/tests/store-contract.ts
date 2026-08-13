import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Store } from "@/lib/db/store";
import { templateBySlug } from "@/lib/templates/catalogue";

/**
 * One contract, two implementations.
 *
 * LocalStore and SupabaseStore both satisfy `Store`, and TypeScript checks
 * that their method *signatures* agree. It cannot check that they *behave* the
 * same, and that is where the damage lives: LocalStore deletes a user's
 * widgets by hand while SupabaseStore leans on `on delete cascade` in the
 * migration. Those are two entirely different mechanisms asked to produce one
 * result, and only one of them has ever run in anger.
 *
 * So the expectations live here, parameterised over a factory, and each store
 * gets a file that runs them. Everything below is about data integrity rather
 * than convenience: what survives a delete, what a second widget's slug is,
 * whose sessions end when one account changes its password. Getting these
 * wrong in production means a widget still serving a closed account, or one
 * customer's enquiries visible to another.
 */

export interface ContractHarness {
  /** A store with no data in it. */
  make: () => Promise<Store> | Store;
  /** Optional cleanup between tests. */
  clean?: () => Promise<void> | void;
}

const document = () => structuredClone(templateBySlug("cleaning-estimate")!.document);

export function describeStoreContract(name: string, harness: ContractHarness) {
  describe(`${name} satisfies the Store contract`, () => {
    let store: Store;

    beforeEach(async () => {
      store = await harness.make();
    });

    afterEach(async () => {
      await harness.clean?.();
    });

    /* users and sessions -------------------------------------------- */

    describe("accounts", () => {
      it("round-trips a user and finds them by email", async () => {
        const user = await store.createUser({ email: "a@example.com", passwordHash: "hash" });
        expect((await store.getUser(user.id))?.email).toBe("a@example.com");
        expect((await store.findUserByEmail("a@example.com"))?.id).toBe(user.id);
      });

      it("returns null rather than throwing for someone who isn't there", async () => {
        expect(await store.getUser("u_nobody")).toBeNull();
        expect(await store.findUserByEmail("nobody@example.com")).toBeNull();
        expect(await store.getSession("t_nobody")).toBeNull();
        expect(await store.getWidget("w_nobody")).toBeNull();
        expect(await store.getWidgetBySlug("nothing-here")).toBeNull();
      });

      it("supports an anonymous author with no email at all (§27)", async () => {
        const anonymous = await store.createUser({});
        expect(anonymous.id).toBeTruthy();
        expect(await store.getUser(anonymous.id)).not.toBeNull();
      });

      it("changes a plan and a password without disturbing the rest", async () => {
        const user = await store.createUser({ email: "a@example.com", passwordHash: "old" });
        await store.setUserPlan(user.id, "pro");
        await store.setUserPassword(user.id, "new");

        const after = await store.getUser(user.id);
        expect(after?.plan).toBe("pro");
        expect(after?.passwordHash).toBe("new");
        expect(after?.email).toBe("a@example.com");
      });
    });

    describe("sessions", () => {
      it("creates, reads and deletes one", async () => {
        const user = await store.createUser({});
        const session = await store.createSession(user.id);

        expect((await store.getSession(session.token))?.userId).toBe(user.id);
        await store.deleteSession(session.token);
        expect(await store.getSession(session.token)).toBeNull();
      });

      it("signs out everywhere except the session doing the asking", async () => {
        const user = await store.createUser({});
        const mine = await store.createSession(user.id);
        const theirs = await store.createSession(user.id);
        const stranger = await store.createUser({});
        const unrelated = await store.createSession(stranger.id);

        await store.deleteSessionsForUser(user.id, mine.token);

        expect(await store.getSession(mine.token)).not.toBeNull();
        expect(await store.getSession(theirs.token)).toBeNull();
        // Somebody else's sessions are none of this operation's business.
        expect(await store.getSession(unrelated.token)).not.toBeNull();
      });

      it("signs out every session when no token is kept", async () => {
        const user = await store.createUser({});
        const one = await store.createSession(user.id);
        const two = await store.createSession(user.id);

        await store.deleteSessionsForUser(user.id);

        expect(await store.getSession(one.token)).toBeNull();
        expect(await store.getSession(two.token)).toBeNull();
      });
    });

    /* widgets --------------------------------------------------------- */

    describe("widgets", () => {
      const create = async (ownerId: string, slug = "cleaning-estimate") =>
        store.createWidget({
          ownerId,
          name: "Cleaning Estimate",
          slug,
          draft: document(),
        });

      it("holds nothing published until it is published (§34)", async () => {
        // The slug lookup deliberately finds the row whatever its status —
        // being published is carried by `published`, and publicDocument() is
        // what turns that into a yes or no for visitors. Both stores have to
        // agree on that, because a store that hid drafts here would make the
        // builder's own "view live" link 404 instead of saying "not published".
        const user = await store.createUser({});
        const widget = await create(user.id);

        expect(widget.status).toBe("draft");
        expect(widget.published).toBeNull();
        expect((await store.getWidgetBySlug(widget.slug))?.published ?? null).toBeNull();

        await store.publishWidget(widget.id);
        const live = await store.getWidgetBySlug(widget.slug);
        expect(live?.id).toBe(widget.id);
        expect(live?.status).toBe("published");
        expect(live?.published?.name).toBe("Cleaning Estimate");

        // Unpublishing takes it off the air without throwing away what was
        // live: status carries the decision, `published` keeps the copy, so
        // publishing again restores exactly what visitors last saw rather than
        // whatever the draft has since become.
        await store.unpublishWidget(widget.id);
        const off = await store.getWidgetBySlug(widget.slug);
        expect(off?.status).toBe("draft");
        expect(off?.published?.name).toBe("Cleaning Estimate");
      });

      it("does not let a draft edit reach what visitors see (§34)", async () => {
        const user = await store.createUser({});
        const widget = await create(user.id);
        await store.publishWidget(widget.id);

        const edited = { ...document(), name: "Work in progress" };
        await store.updateWidgetDraft(widget.id, edited, edited.name);

        const after = await store.getWidget(widget.id);
        expect(after?.draft.name).toBe("Work in progress");
        expect(after?.published?.name).toBe("Cleaning Estimate");
      });

      it("reports a taken slug as taken", async () => {
        const user = await store.createUser({});
        await create(user.id, "taken-slug");
        expect(await store.slugExists("taken-slug")).toBe(true);
        expect(await store.slugExists("free-slug")).toBe(false);
      });

      it("lists and counts only the owner's widgets", async () => {
        const mine = await store.createUser({});
        const theirs = await store.createUser({});
        await create(mine.id, "mine-one");
        await create(mine.id, "mine-two");
        await create(theirs.id, "theirs-one");

        expect(await store.countWidgets(mine.id)).toBe(2);
        expect((await store.listWidgets(mine.id)).map((w) => w.slug).sort()).toEqual([
          "mine-one",
          "mine-two",
        ]);
        expect(await store.countWidgets(theirs.id)).toBe(1);
      });

      it("moves an anonymous author's work onto their new account (§27)", async () => {
        const anonymous = await store.createUser({});
        const registered = await store.createUser({ email: "a@example.com" });
        await create(anonymous.id, "claimed");

        expect(await store.claimWidgets(anonymous.id, registered.id)).toBe(1);
        expect(await store.countWidgets(registered.id)).toBe(1);
        expect(await store.countWidgets(anonymous.id)).toBe(0);
      });

      it("is idempotent when a signup form is double-submitted", async () => {
        // Stated in the interface docs, so it belongs in the contract.
        const anonymous = await store.createUser({});
        const registered = await store.createUser({ email: "a@example.com" });
        await create(anonymous.id, "claimed");

        await store.claimWidgets(anonymous.id, registered.id);
        expect(await store.claimWidgets(anonymous.id, registered.id)).toBe(0);
        expect(await store.countWidgets(registered.id)).toBe(1);
      });
    });

    /* the deletes, which are the whole point ------------------------- */

    describe("deleting", () => {
      const populated = async () => {
        const user = await store.createUser({ email: "a@example.com", passwordHash: "hash" });
        const session = await store.createSession(user.id);
        const widget = await store.createWidget({
          ownerId: user.id,
          name: "Cleaning Estimate",
          slug: "cleaning-estimate",
          draft: document(),
        });
        await store.publishWidget(widget.id);
        await store.recordEvents([
          { widgetId: widget.id, sessionId: "v1", type: "widget_view" },
          { widgetId: widget.id, sessionId: "v1", type: "widget_start" },
        ]);
        await store.createLead({ widgetId: widget.id, email: "visitor@example.com" });
        return { user, session, widget };
      };

      it("takes a widget's events and enquiries with it", async () => {
        const { widget } = await populated();
        await store.deleteWidget(widget.id);

        expect(await store.getWidget(widget.id)).toBeNull();
        expect(await store.listEvents(widget.id)).toEqual([]);
        expect(await store.countLeads(widget.id)).toBe(0);
      });

      it("takes everything an account owns", async () => {
        const { user, session, widget } = await populated();
        await store.deleteUser(user.id);

        expect(await store.getUser(user.id)).toBeNull();
        expect(await store.getSession(session.token)).toBeNull();
        expect(await store.getWidget(widget.id)).toBeNull();
        expect(await store.listEvents(widget.id)).toEqual([]);
        expect(await store.countLeads(widget.id)).toBe(0);
        expect(await store.listWidgets(user.id)).toEqual([]);
      });

      it("stops a deleted account's widget resolving by its public slug", async () => {
        // Somebody's embed pointing at it has to stop working, not keep
        // serving a calculator for a business that closed its account.
        const { user, widget } = await populated();
        expect(await store.getWidgetBySlug(widget.slug)).not.toBeNull();

        await store.deleteUser(user.id);
        expect(await store.getWidgetBySlug(widget.slug)).toBeNull();
      });

      it("leaves every other account untouched", async () => {
        const doomed = await populated();
        const keeper = await store.createUser({ email: "b@example.com" });
        const keeperSession = await store.createSession(keeper.id);
        const theirs = await store.createWidget({
          ownerId: keeper.id,
          name: "Theirs",
          slug: "theirs",
          draft: document(),
        });
        await store.createLead({ widgetId: theirs.id, email: "someone@example.com" });

        await store.deleteUser(doomed.user.id);

        expect(await store.getUser(keeper.id)).not.toBeNull();
        expect(await store.getSession(keeperSession.token)).not.toBeNull();
        expect(await store.getWidget(theirs.id)).not.toBeNull();
        expect(await store.countLeads(theirs.id)).toBe(1);
      });

      it("survives being asked to delete something that isn't there", async () => {
        await expect(store.deleteUser("u_nobody")).resolves.toBeUndefined();
        await expect(store.deleteWidget("w_nobody")).resolves.toBeUndefined();
      });
    });

    /* analytics and leads --------------------------------------------- */

    describe("analytics", () => {
      const withWidget = async () => {
        const user = await store.createUser({});
        const widget = await store.createWidget({
          ownerId: user.id,
          name: "Cleaning Estimate",
          slug: "cleaning-estimate",
          draft: document(),
        });
        return { user, widget };
      };

      it("records and reads events back", async () => {
        const { widget } = await withWidget();
        await store.recordEvents([
          { widgetId: widget.id, sessionId: "v1", type: "widget_view" },
          { widgetId: widget.id, sessionId: "v1", type: "widget_start", stepId: "home_type" },
        ]);

        const events = await store.listEvents(widget.id);
        expect(events).toHaveLength(2);
        expect(events.map((event) => event.type).sort()).toEqual(["widget_start", "widget_view"]);
      });

      it("accepts an empty batch without complaint", async () => {
        // The tracker flushes on a timer and can wake with nothing to send.
        await expect(store.recordEvents([])).resolves.toBeUndefined();
      });

      it("meters starts, not views (§35)", async () => {
        const { user, widget } = await withWidget();
        await store.recordEvents([
          { widgetId: widget.id, sessionId: "v1", type: "widget_view" },
          { widgetId: widget.id, sessionId: "v2", type: "widget_view" },
          { widgetId: widget.id, sessionId: "v1", type: "widget_start" },
          { widgetId: widget.id, sessionId: "v2", type: "widget_start" },
          { widgetId: widget.id, sessionId: "v1", type: "widget_complete" },
        ]);

        // Two starts. Views are free however many there are, and completions
        // are not the metered event either — this is what the plan bills on.
        expect(await store.countInteractionsThisMonth(user.id)).toBe(2);
      });

      it("counts across every widget the account owns, and no one else's", async () => {
        const { user, widget } = await withWidget();
        const second = await store.createWidget({
          ownerId: user.id,
          name: "Second",
          slug: "second",
          draft: document(),
        });
        const stranger = await store.createUser({});
        const theirs = await store.createWidget({
          ownerId: stranger.id,
          name: "Theirs",
          slug: "theirs",
          draft: document(),
        });

        await store.recordEvents([
          { widgetId: widget.id, sessionId: "v1", type: "widget_start" },
          { widgetId: second.id, sessionId: "v2", type: "widget_start" },
          { widgetId: theirs.id, sessionId: "v3", type: "widget_start" },
        ]);

        expect(await store.countInteractionsThisMonth(user.id)).toBe(2);
        expect(await store.countInteractionsThisMonth(stranger.id)).toBe(1);
      });

      it("counts nothing for an account with no widgets", async () => {
        const user = await store.createUser({});
        expect(await store.countInteractionsThisMonth(user.id)).toBe(0);
      });
    });

    describe("leads", () => {
      const withWidget = async () => {
        const user = await store.createUser({});
        return store.createWidget({
          ownerId: user.id,
          name: "Cleaning Estimate",
          slug: "cleaning-estimate",
          draft: document(),
        });
      };

      it("stores and counts them per widget", async () => {
        const widget = await withWidget();
        await store.createLead({ widgetId: widget.id, name: "Ada", email: "ada@example.com" });
        await store.createLead({ widgetId: widget.id, email: "bob@example.com" });

        expect(await store.countLeads(widget.id)).toBe(2);
        const leads = await store.listLeads(widget.id, 25);
        expect(leads).toHaveLength(2);
        expect(leads.map((lead) => lead.email).sort()).toEqual([
          "ada@example.com",
          "bob@example.com",
        ]);
      });

      it("honours the limit it is given", async () => {
        const widget = await withWidget();
        for (let index = 0; index < 5; index += 1) {
          await store.createLead({ widgetId: widget.id, email: `v${index}@example.com` });
        }
        expect(await store.listLeads(widget.id, 2)).toHaveLength(2);
        expect(await store.countLeads(widget.id)).toBe(5);
      });
    });

    /* versions and billing -------------------------------------------- */

    describe("versions and subscriptions", () => {
      it("keeps published versions (§33)", async () => {
        const user = await store.createUser({});
        const widget = await store.createWidget({
          ownerId: user.id,
          name: "Cleaning Estimate",
          slug: "cleaning-estimate",
          draft: document(),
        });

        await store.createVersion(widget.id, document(), "First publish");
        await store.createVersion(widget.id, document(), "Second publish");

        const versions = await store.listVersions(widget.id, 10);
        expect(versions).toHaveLength(2);
        expect(versions.map((version) => version.label)).toContain("First publish");
      });

      it("round-trips a subscription", async () => {
        const user = await store.createUser({});
        expect(await store.getSubscription(user.id)).toBeNull();

        await store.upsertSubscription({
          userId: user.id,
          plan: "pro",
          status: "active",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
        });

        expect((await store.getSubscription(user.id))?.plan).toBe("pro");
      });

      it("updates rather than duplicates on a second upsert", async () => {
        // The webhook can deliver the same event twice; the second must not
        // leave two rows for one account.
        const user = await store.createUser({});
        const record = {
          userId: user.id,
          plan: "pro" as const,
          status: "active",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
        };
        await store.upsertSubscription(record);
        await store.upsertSubscription({ ...record, plan: "business", status: "past_due" });

        const after = await store.getSubscription(user.id);
        expect(after?.plan).toBe("business");
        expect(after?.status).toBe("past_due");
      });
    });
  });
}
