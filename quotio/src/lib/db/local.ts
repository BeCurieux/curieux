// The local JSON store.
//
// Its job is to make `git clone && npm install && npm run dev` produce the
// entire product — create, edit, publish, embed, capture leads, read
// analytics — with no accounts, keys or containers. That is not a developer
// nicety: it's the only way the §41 checklist can be verified by anyone who
// picks the repo up.
//
// Writes are serialised through a promise chain and land via a temp file and
// rename, so a crash mid-save can't leave a half-written database behind.
// It is not built for concurrency across processes; Supabase is for that.

import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  EventRecord,
  LeadRecord,
  Session,
  SubscriptionRecord,
  User,
  WidgetRecord,
  WidgetVersion,
} from "./types";
import { newId, type CreateWidgetInput, type NewEvent, type NewLead, type Store } from "./store";
import type { WidgetDocument } from "@/lib/widget/schema";
import type { PlanId } from "@/lib/plans";

interface Database {
  users: User[];
  sessions: Session[];
  widgets: WidgetRecord[];
  versions: WidgetVersion[];
  events: EventRecord[];
  leads: LeadRecord[];
  subscriptions: SubscriptionRecord[];
}

const EMPTY: Database = {
  users: [],
  sessions: [],
  widgets: [],
  versions: [],
  events: [],
  leads: [],
  subscriptions: [],
};

/**
 * Next's dev server re-evaluates modules on edit. Without this the database
 * would silently reset — and worse, two copies would race each other.
 */
const globalCache = globalThis as unknown as { __quotioDb?: Database };

export class LocalStore implements Store {
  private readonly file: string;
  private db: Database;
  private writing: Promise<void> = Promise.resolve();

  constructor(file = process.env.LOCAL_STORE_PATH ?? path.join(process.cwd(), ".data", "store.json")) {
    this.file = file;
    if (globalCache.__quotioDb) {
      this.db = globalCache.__quotioDb;
    } else {
      this.db = this.read();
      globalCache.__quotioDb = this.db;
    }
  }

  private read(): Database {
    try {
      if (!existsSync(this.file)) return structuredClone(EMPTY);
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<Database>;
      return { ...structuredClone(EMPTY), ...parsed };
    } catch {
      // A corrupt dev database should not stop the app from starting.
      return structuredClone(EMPTY);
    }
  }

  /** Serialised, atomic-ish save. Callers may ignore the promise. */
  private save(): Promise<void> {
    this.writing = this.writing.then(async () => {
      const directory = path.dirname(this.file);
      mkdirSync(directory, { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(this.db, null, 2), "utf8");
      await rename(temporary, this.file);
    });
    return this.writing;
  }

  /* users + sessions ------------------------------------------------- */

  async createUser(input: { email?: string | null; passwordHash?: string | null }): Promise<User> {
    const user: User = {
      id: newId("u_"),
      email: input.email?.toLowerCase() ?? null,
      passwordHash: input.passwordHash ?? null,
      plan: "free",
      createdAt: new Date().toISOString(),
    };
    this.db.users.push(user);
    await this.save();
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return this.db.users.find((user) => user.id === id) ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    return this.db.users.find((user) => user.email === needle) ?? null;
  }

  async setUserPlan(userId: string, plan: PlanId): Promise<void> {
    const user = this.db.users.find((entry) => entry.id === userId);
    if (!user) return;
    user.plan = plan;
    await this.save();
  }

  async createSession(userId: string): Promise<Session> {
    const session: Session = {
      token: newId("s_"),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.db.sessions.push(session);
    await this.save();
    return session;
  }

  async getSession(token: string): Promise<Session | null> {
    return this.db.sessions.find((session) => session.token === token) ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    this.db.sessions = this.db.sessions.filter((session) => session.token !== token);
    await this.save();
  }

  async claimWidgets(fromUserId: string, toUserId: string): Promise<number> {
    if (fromUserId === toUserId) return 0;
    let moved = 0;
    for (const widget of this.db.widgets) {
      if (widget.ownerId === fromUserId) {
        widget.ownerId = toUserId;
        moved += 1;
      }
    }
    // The anonymous shell has served its purpose.
    this.db.users = this.db.users.filter((user) => !(user.id === fromUserId && user.email === null));
    await this.save();
    return moved;
  }

  /* widgets ---------------------------------------------------------- */

  async createWidget(input: CreateWidgetInput): Promise<WidgetRecord> {
    const now = new Date().toISOString();
    const record: WidgetRecord = {
      id: newId("w_"),
      ownerId: input.ownerId,
      name: input.name,
      type: input.draft.type,
      slug: input.slug,
      status: "draft",
      draft: input.draft,
      published: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };
    this.db.widgets.push(record);
    await this.save();
    return record;
  }

  async getWidget(id: string): Promise<WidgetRecord | null> {
    return this.db.widgets.find((widget) => widget.id === id) ?? null;
  }

  async getWidgetBySlug(slug: string): Promise<WidgetRecord | null> {
    return this.db.widgets.find((widget) => widget.slug === slug) ?? null;
  }

  async listWidgets(ownerId: string): Promise<WidgetRecord[]> {
    return this.db.widgets
      .filter((widget) => widget.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async countWidgets(ownerId: string): Promise<number> {
    return this.db.widgets.filter((widget) => widget.ownerId === ownerId).length;
  }

  async updateWidgetDraft(id: string, draft: WidgetDocument, name?: string): Promise<WidgetRecord | null> {
    const widget = this.db.widgets.find((entry) => entry.id === id);
    if (!widget) return null;
    widget.draft = draft;
    widget.name = name ?? draft.name;
    widget.type = draft.type;
    widget.updatedAt = new Date().toISOString();
    await this.save();
    return widget;
  }

  async publishWidget(id: string): Promise<WidgetRecord | null> {
    const widget = this.db.widgets.find((entry) => entry.id === id);
    if (!widget) return null;
    const now = new Date().toISOString();
    widget.published = structuredClone(widget.draft);
    widget.status = "published";
    widget.publishedAt = now;
    widget.updatedAt = now;
    await this.save();
    return widget;
  }

  async unpublishWidget(id: string): Promise<WidgetRecord | null> {
    const widget = this.db.widgets.find((entry) => entry.id === id);
    if (!widget) return null;
    widget.status = "draft";
    widget.updatedAt = new Date().toISOString();
    await this.save();
    return widget;
  }

  async deleteWidget(id: string): Promise<void> {
    this.db.widgets = this.db.widgets.filter((widget) => widget.id !== id);
    this.db.versions = this.db.versions.filter((version) => version.widgetId !== id);
    this.db.events = this.db.events.filter((event) => event.widgetId !== id);
    this.db.leads = this.db.leads.filter((lead) => lead.widgetId !== id);
    await this.save();
  }

  async slugExists(slug: string): Promise<boolean> {
    return this.db.widgets.some((widget) => widget.slug === slug);
  }

  /* versions --------------------------------------------------------- */

  async createVersion(widgetId: string, schema: WidgetDocument, label: string): Promise<WidgetVersion> {
    const version: WidgetVersion = {
      id: newId("v_"),
      widgetId,
      schema,
      label,
      createdAt: new Date().toISOString(),
    };
    this.db.versions.push(version);
    await this.save();
    return version;
  }

  async listVersions(widgetId: string, limit = 20): Promise<WidgetVersion[]> {
    return this.db.versions
      .filter((version) => version.widgetId === widgetId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  /* analytics -------------------------------------------------------- */

  async recordEvents(events: NewEvent[]): Promise<void> {
    const now = new Date().toISOString();
    for (const event of events) {
      this.db.events.push({
        id: newId("e_"),
        widgetId: event.widgetId,
        sessionId: event.sessionId,
        type: event.type,
        stepId: event.stepId ?? null,
        metadata: event.metadata ?? null,
        createdAt: event.createdAt ?? now,
      });
    }
    await this.save();
  }

  async listEvents(widgetId: string, since?: Date): Promise<EventRecord[]> {
    const cutoff = since?.toISOString();
    return this.db.events.filter(
      (event) => event.widgetId === widgetId && (!cutoff || event.createdAt >= cutoff)
    );
  }

  async countInteractionsThisMonth(ownerId: string): Promise<number> {
    const owned = new Set(
      this.db.widgets.filter((widget) => widget.ownerId === ownerId).map((widget) => widget.id)
    );
    const monthStart = startOfMonth().toISOString();
    return this.db.events.filter(
      (event) =>
        owned.has(event.widgetId) && event.type === "widget_start" && event.createdAt >= monthStart
    ).length;
  }

  /* leads ------------------------------------------------------------ */

  async createLead(lead: NewLead): Promise<LeadRecord> {
    const record: LeadRecord = {
      id: newId("l_"),
      widgetId: lead.widgetId,
      name: lead.name ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      message: lead.message ?? null,
      metadata: lead.metadata ?? null,
      createdAt: new Date().toISOString(),
    };
    this.db.leads.push(record);
    await this.save();
    return record;
  }

  async listLeads(widgetId: string, limit = 100): Promise<LeadRecord[]> {
    return this.db.leads
      .filter((lead) => lead.widgetId === widgetId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async countLeads(widgetId: string): Promise<number> {
    return this.db.leads.filter((lead) => lead.widgetId === widgetId).length;
  }

  /* billing ---------------------------------------------------------- */

  async getSubscription(userId: string): Promise<SubscriptionRecord | null> {
    return this.db.subscriptions.find((subscription) => subscription.userId === userId) ?? null;
  }

  async upsertSubscription(record: SubscriptionRecord): Promise<void> {
    const index = this.db.subscriptions.findIndex((entry) => entry.userId === record.userId);
    if (index >= 0) this.db.subscriptions[index] = record;
    else this.db.subscriptions.push(record);
    await this.setUserPlan(record.userId, record.plan);
    await this.save();
  }
}

export function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
