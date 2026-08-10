// The storage seam.
//
// Everything above this line — pages, server actions, API routes — talks to
// `Store`. Two implementations satisfy it:
//
//   local     a JSON file under .data/. Zero setup, so `npm run dev` gives a
//             complete working product on a laptop with no accounts anywhere.
//   supabase  Postgres + RLS, per the suggested stack (§31/§32).
//
// The local store is not a mock. It is a real, persistent implementation used
// by the whole test suite, which is what lets §41's "no fake functionality"
// bar be met on a fresh clone.

import type {
  EventRecord,
  LeadRecord,
  Session,
  SubscriptionRecord,
  User,
  WidgetRecord,
  WidgetVersion,
} from "./types";
import type { WidgetDocument } from "@/lib/widget/schema";
import type { PlanId } from "@/lib/plans";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";

export interface CreateWidgetInput {
  ownerId: string;
  name: string;
  slug: string;
  draft: WidgetDocument;
}

export interface NewEvent {
  widgetId: string;
  sessionId: string;
  type: string;
  stepId?: string;
  metadata?: Record<string, string | number | boolean>;
  /**
   * Only set by seeding and imports. The API never accepts a timestamp from a
   * caller — a widget on someone else's site must not be able to backdate
   * traffic, so /api/events drops this field on the way in.
   */
  createdAt?: string;
}

export interface NewLead {
  widgetId: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface Store {
  /* users + sessions ------------------------------------------------ */
  createUser(input: { email?: string | null; passwordHash?: string | null }): Promise<User>;
  getUser(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  setUserPlan(userId: string, plan: PlanId): Promise<void>;

  createSession(userId: string): Promise<Session>;
  getSession(token: string): Promise<Session | null>;
  deleteSession(token: string): Promise<void>;

  /**
   * Turn an anonymous author into a signed-up one, keeping their work (§27).
   * Implementations must be idempotent: a double-submitted signup form must
   * not duplicate or orphan widgets.
   */
  claimWidgets(fromUserId: string, toUserId: string): Promise<number>;

  /* widgets ---------------------------------------------------------- */
  createWidget(input: CreateWidgetInput): Promise<WidgetRecord>;
  getWidget(id: string): Promise<WidgetRecord | null>;
  getWidgetBySlug(slug: string): Promise<WidgetRecord | null>;
  listWidgets(ownerId: string): Promise<WidgetRecord[]>;
  countWidgets(ownerId: string): Promise<number>;
  updateWidgetDraft(id: string, draft: WidgetDocument, name?: string): Promise<WidgetRecord | null>;
  publishWidget(id: string): Promise<WidgetRecord | null>;
  unpublishWidget(id: string): Promise<WidgetRecord | null>;
  deleteWidget(id: string): Promise<void>;
  slugExists(slug: string): Promise<boolean>;

  /* versions (§33) --------------------------------------------------- */
  createVersion(widgetId: string, schema: WidgetDocument, label: string): Promise<WidgetVersion>;
  listVersions(widgetId: string, limit?: number): Promise<WidgetVersion[]>;

  /* analytics (§25/§26) ---------------------------------------------- */
  recordEvents(events: NewEvent[]): Promise<void>;
  listEvents(widgetId: string, since?: Date): Promise<EventRecord[]>;
  countInteractionsThisMonth(ownerId: string): Promise<number>;

  /* leads (§20) ------------------------------------------------------ */
  createLead(lead: NewLead): Promise<LeadRecord>;
  listLeads(widgetId: string, limit?: number): Promise<LeadRecord[]>;
  countLeads(widgetId: string): Promise<number>;

  /* billing (§35) ---------------------------------------------------- */
  getSubscription(userId: string): Promise<SubscriptionRecord | null>;
  upsertSubscription(record: SubscriptionRecord): Promise<void>;
}

let cached: Store | null = null;

/**
 * Pick an implementation. `DATA_STORE=supabase` opts in; anything else — and
 * therefore a fresh clone with no .env at all — gets the local store.
 *
 * Both are imported statically rather than lazily. It costs a little bundle
 * size on the server, and it buys the same module graph everywhere: Next's
 * bundler, `tsx` running a script, and Vitest all resolve this identically.
 */
export function getStore(): Store {
  if (cached) return cached;
  cached = process.env.DATA_STORE === "supabase" ? new SupabaseStore() : new LocalStore();
  return cached;
}

/** Test seam. */
export function setStore(store: Store | null): void {
  cached = store;
}

/** Short, URL-safe, sortable-ish ids. */
export function newId(prefix = ""): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${random}`;
}

/**
 * Find a slug nobody is using, appending -2, -3 … as needed.
 * Hosted URLs are public and permanent, so collisions have to be impossible
 * rather than unlikely.
 */
export async function uniqueSlug(store: Store, base: string): Promise<string> {
  const root = base || "widget";
  if (!(await store.slugExists(root))) return root;
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await store.slugExists(candidate))) return candidate;
  }
  return `${root}-${newId()}`;
}
