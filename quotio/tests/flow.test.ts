import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalStore } from "@/lib/db/local";
import { setStore, uniqueSlug } from "@/lib/db/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { summarise } from "@/lib/analytics/events";
import { can, mustShowBadge, PLANS } from "@/lib/plans";
import { templateBySlug } from "@/lib/templates/catalogue";
import { createWidgetFor, isLimitError, publicDocument, renderableFor } from "@/lib/widgets/service";

let directory: string;
let store: LocalStore;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mekmi-"));
  // A fresh file per test, and the global dev cache cleared with it.
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  store = new LocalStore(path.join(directory, "store.json"));
  setStore(store);
});

afterEach(() => {
  setStore(null);
  rmSync(directory, { recursive: true, force: true });
});

const cleaning = () => structuredClone(templateBySlug("cleaning-estimate")!.document);

describe("creating widgets", () => {
  it("enforces the plan's widget limit", async () => {
    const user = await store.createUser({});
    const limit = PLANS.free.limits.widgets;

    for (let index = 0; index < limit; index += 1) {
      const created = await createWidgetFor(user.id, "free", cleaning());
      expect(isLimitError(created)).toBe(false);
    }

    const overflow = await createWidgetFor(user.id, "free", cleaning());
    expect(isLimitError(overflow)).toBe(true);
    expect(await store.countWidgets(user.id)).toBe(limit);

    // The same account on Pro can carry on.
    const onPro = await createWidgetFor(user.id, "pro", cleaning());
    expect(isLimitError(onPro)).toBe(false);
  });

  it("never reuses a public slug", async () => {
    const user = await store.createUser({});
    const first = await createWidgetFor(user.id, "pro", cleaning());
    const second = await createWidgetFor(user.id, "pro", cleaning());
    expect(isLimitError(first) || isLimitError(second)).toBe(false);
    if (isLimitError(first) || isLimitError(second)) return;

    expect(first.slug).toBe("cleaning-estimate");
    expect(second.slug).toBe("cleaning-estimate-2");
    expect(await uniqueSlug(store, "cleaning-estimate")).toBe("cleaning-estimate-3");
  });
});

describe("draft and published are separate (§34)", () => {
  it("serves nothing publicly until published, then the published copy", async () => {
    const user = await store.createUser({});
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");

    expect(publicDocument(created)).toBeNull();

    const published = await store.publishWidget(created.id);
    expect(publicDocument(published!)?.name).toBe("Cleaning Estimate");

    // Editing the draft must not change what visitors see.
    const edited = { ...cleaning(), name: "Work in progress" };
    const afterEdit = await store.updateWidgetDraft(created.id, edited, edited.name);
    expect(afterEdit!.draft.name).toBe("Work in progress");
    expect(publicDocument(afterEdit!)?.name).toBe("Cleaning Estimate");

    // …until they publish again.
    const republished = await store.publishWidget(created.id);
    expect(publicDocument(republished!)?.name).toBe("Work in progress");
  });

  it("takes a widget off the air when unpublished", async () => {
    const user = await store.createUser({});
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");

    await store.publishWidget(created.id);
    const off = await store.unpublishWidget(created.id);
    expect(publicDocument(off!)).toBeNull();
  });
});

describe("plan gating reaches the rendered widget (§35)", () => {
  it("removes the lead form on free rather than showing a dead one", async () => {
    const user = await store.createUser({ email: "free@example.com" });
    const created = await createWidgetFor(user.id, "free", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");
    const published = (await store.publishWidget(created.id))!;

    const free = await renderableFor(published, publicDocument(published)!);
    expect(free.widget.settings.leadCapture.mode).toBe("none");
    expect(free.leadCaptureGated).toBe(true);
    expect(free.showBadge).toBe(true);

    await store.setUserPlan(user.id, "pro");
    const pro = await renderableFor(published, publicDocument(published)!);
    expect(pro.widget.settings.leadCapture.mode).toBe("after");
    expect(pro.leadCaptureGated).toBe(false);
  });

  it("keeps the badge on free even if the setting says otherwise", () => {
    expect(mustShowBadge("free", false)).toBe(true);
    expect(mustShowBadge("pro", false)).toBe(false);
    expect(mustShowBadge("pro", true)).toBe(true);
    expect(can("free", "analytics")).toBe(false);
    expect(can("business", "advancedLogic")).toBe(true);
  });
});

describe("anonymous authors keep their work (§27)", () => {
  it("moves widgets onto the account created at publish time", async () => {
    const anonymous = await store.createUser({});
    const created = await createWidgetFor(anonymous.id, "free", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");

    const registered = await store.createUser({
      email: "someone@example.com",
      passwordHash: await hashPassword("hunter2hunter2"),
    });

    const moved = await store.claimWidgets(anonymous.id, registered.id);
    expect(moved).toBe(1);
    expect(await store.countWidgets(registered.id)).toBe(1);
    expect(await store.countWidgets(anonymous.id)).toBe(0);
    // The empty anonymous shell is cleaned up.
    expect(await store.getUser(anonymous.id)).toBeNull();
  });

  it("verifies passwords and rejects wrong ones", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batteri", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    // Salted: the same password twice never produces the same stored value.
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});

describe("analytics roll-ups (§25)", () => {
  it("counts people, not events, and measures completion against starts", async () => {
    const user = await store.createUser({});
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");
    const id = created.id;

    await store.recordEvents([
      { widgetId: id, sessionId: "a", type: "widget_view" },
      { widgetId: id, sessionId: "a", type: "widget_start" },
      { widgetId: id, sessionId: "a", type: "widget_complete" },
      { widgetId: id, sessionId: "a", type: "cta_click" },
      { widgetId: id, sessionId: "b", type: "widget_view" },
      { widgetId: id, sessionId: "b", type: "widget_start" },
      // A visitor who reloads shouldn't count twice.
      { widgetId: id, sessionId: "b", type: "widget_view" },
      { widgetId: id, sessionId: "c", type: "widget_view" },
    ]);

    const stats = summarise(await store.listEvents(id), await store.countLeads(id));
    expect(stats).toEqual({
      views: 3,
      starts: 2,
      completions: 1,
      completionRate: 50,
      ctaClicks: 1,
      leads: 0,
    });
  });

  it("counts a month's interactions across all of an owner's widgets", async () => {
    const user = await store.createUser({});
    const first = await createWidgetFor(user.id, "pro", cleaning());
    const second = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(first) || isLimitError(second)) throw new Error("unexpected limit");

    await store.recordEvents([
      { widgetId: first.id, sessionId: "a", type: "widget_start" },
      { widgetId: second.id, sessionId: "b", type: "widget_start" },
      { widgetId: second.id, sessionId: "c", type: "widget_view" },
    ]);

    expect(await store.countInteractionsThisMonth(user.id)).toBe(2);
  });

  it("backdates a seeded enquiry, and stamps a real one with now", async () => {
    // Seeding walks a fortnight of traffic; without this the enquiries all
    // landed on the day the script ran while the events that produced them
    // were spread across two weeks.
    const user = await store.createUser({});
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");

    const lastTuesday = "2026-08-04T10:00:00.000Z";
    await store.createLead({ widgetId: created.id, email: "seeded@example.com", createdAt: lastTuesday });
    await store.createLead({ widgetId: created.id, email: "real@example.com" });

    const leads = await store.listLeads(created.id, 10);
    const seeded = leads.find((lead) => lead.email === "seeded@example.com")!;
    const real = leads.find((lead) => lead.email === "real@example.com")!;

    expect(seeded.createdAt).toBe(lastTuesday);
    // Not backdated, and not wildly off either.
    expect(Date.parse(real.createdAt)).toBeGreaterThan(Date.parse(lastTuesday));
    expect(Math.abs(Date.now() - Date.parse(real.createdAt))).toBeLessThan(60_000);
  });

  it("gives a visitor no way to choose when their enquiry arrived", async () => {
    // `createdAt` exists on NewLead for seeding. The public endpoint builds
    // its object field by field, so the field is unreachable from outside —
    // this pins that, because the cheap version of /api/leads would have been
    // to spread the parsed body and quietly accept whatever it contained.
    const source = readFileSync("src/app/api/leads/route.ts", "utf8");
    expect(source).not.toMatch(/\.\.\.parsed\.data/);
    expect(source).not.toMatch(/createdAt/);
  });

  it("takes analytics and leads with a deleted widget", async () => {
    const user = await store.createUser({});
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");

    await store.recordEvents([{ widgetId: created.id, sessionId: "a", type: "widget_view" }]);
    await store.createLead({ widgetId: created.id, email: "a@example.com" });

    await store.deleteWidget(created.id);
    expect(await store.listEvents(created.id)).toEqual([]);
    expect(await store.countLeads(created.id)).toBe(0);
    expect(await store.getWidget(created.id)).toBeNull();
  });
});

describe("persistence", () => {
  it("survives a restart", async () => {
    const user = await store.createUser({ email: "keep@example.com" });
    const created = await createWidgetFor(user.id, "pro", cleaning());
    if (isLimitError(created)) throw new Error("unexpected limit");
    await store.publishWidget(created.id);

    // Force the queued write to land, then read the file with a new instance.
    await new Promise((resolve) => setTimeout(resolve, 50));
    (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
    const reopened = new LocalStore(path.join(directory, "store.json"));

    const found = await reopened.getWidgetBySlug(created.slug);
    expect(found?.status).toBe("published");
    expect(found?.published?.name).toBe("Cleaning Estimate");
    expect((await reopened.findUserByEmail("keep@example.com"))?.id).toBe(user.id);
  });
});
