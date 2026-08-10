// Postgres via Supabase (brief §31/§32).
//
// Same interface as the local store, so nothing above this file changes when
// you switch. Set DATA_STORE=supabase plus the two keys in .env.local and run
// supabase/migrations/0001_init.sql.
//
// This uses the service-role key and does its own ownership checks in the
// server actions, rather than relying on RLS with a user JWT. The reason is
// §27: widgets are created by anonymous visitors who have no Supabase auth
// user yet, so there is no JWT to enforce against until they sign up. RLS is
// still enabled on every table (see the migration) to deny the anon key
// outright — the service role is the only way in, and it only runs on the
// server.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
import { startOfMonth } from "./local";
import type { WidgetDocument } from "@/lib/widget/schema";
import type { PlanId } from "@/lib/plans";

type Row = Record<string, unknown>;

export class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "DATA_STORE=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /* users + sessions ------------------------------------------------- */

  async createUser(input: { email?: string | null; passwordHash?: string | null }): Promise<User> {
    const row = {
      id: newId("u_"),
      email: input.email?.toLowerCase() ?? null,
      password_hash: input.passwordHash ?? null,
      plan: "free",
    };
    const { data, error } = await this.client.from("users").insert(row).select().single();
    if (error) throw error;
    return toUser(data);
  }

  async getUser(id: string): Promise<User | null> {
    const { data } = await this.client.from("users").select().eq("id", id).maybeSingle();
    return data ? toUser(data) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const { data } = await this.client
      .from("users")
      .select()
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    return data ? toUser(data) : null;
  }

  async setUserPlan(userId: string, plan: PlanId): Promise<void> {
    await this.client.from("users").update({ plan }).eq("id", userId);
  }

  async createSession(userId: string): Promise<Session> {
    const row = { token: newId("s_"), user_id: userId };
    const { data, error } = await this.client.from("sessions").insert(row).select().single();
    if (error) throw error;
    return { token: data.token, userId: data.user_id, createdAt: data.created_at };
  }

  async getSession(token: string): Promise<Session | null> {
    const { data } = await this.client.from("sessions").select().eq("token", token).maybeSingle();
    return data ? { token: data.token, userId: data.user_id, createdAt: data.created_at } : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.client.from("sessions").delete().eq("token", token);
  }

  async claimWidgets(fromUserId: string, toUserId: string): Promise<number> {
    if (fromUserId === toUserId) return 0;
    const { data } = await this.client
      .from("widgets")
      .update({ owner_id: toUserId })
      .eq("owner_id", fromUserId)
      .select("id");
    await this.client.from("users").delete().eq("id", fromUserId).is("email", null);
    return data?.length ?? 0;
  }

  /* widgets ---------------------------------------------------------- */

  async createWidget(input: CreateWidgetInput): Promise<WidgetRecord> {
    const row = {
      id: newId("w_"),
      owner_id: input.ownerId,
      name: input.name,
      type: input.draft.type,
      slug: input.slug,
      status: "draft",
      schema_json: input.draft,
      published_json: null,
    };
    const { data, error } = await this.client.from("widgets").insert(row).select().single();
    if (error) throw error;
    return toWidget(data);
  }

  async getWidget(id: string): Promise<WidgetRecord | null> {
    const { data } = await this.client.from("widgets").select().eq("id", id).maybeSingle();
    return data ? toWidget(data) : null;
  }

  async getWidgetBySlug(slug: string): Promise<WidgetRecord | null> {
    const { data } = await this.client.from("widgets").select().eq("slug", slug).maybeSingle();
    return data ? toWidget(data) : null;
  }

  async listWidgets(ownerId: string): Promise<WidgetRecord[]> {
    const { data } = await this.client
      .from("widgets")
      .select()
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    return (data ?? []).map(toWidget);
  }

  async countWidgets(ownerId: string): Promise<number> {
    const { count } = await this.client
      .from("widgets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId);
    return count ?? 0;
  }

  async updateWidgetDraft(id: string, draft: WidgetDocument, name?: string): Promise<WidgetRecord | null> {
    const { data } = await this.client
      .from("widgets")
      .update({
        schema_json: draft,
        name: name ?? draft.name,
        type: draft.type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    return data ? toWidget(data) : null;
  }

  async publishWidget(id: string): Promise<WidgetRecord | null> {
    const current = await this.getWidget(id);
    if (!current) return null;
    const now = new Date().toISOString();
    const { data } = await this.client
      .from("widgets")
      .update({ published_json: current.draft, status: "published", published_at: now, updated_at: now })
      .eq("id", id)
      .select()
      .maybeSingle();
    return data ? toWidget(data) : null;
  }

  async unpublishWidget(id: string): Promise<WidgetRecord | null> {
    const { data } = await this.client
      .from("widgets")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    return data ? toWidget(data) : null;
  }

  async deleteWidget(id: string): Promise<void> {
    // widget_versions / widget_events / leads cascade on delete.
    await this.client.from("widgets").delete().eq("id", id);
  }

  async slugExists(slug: string): Promise<boolean> {
    const { count } = await this.client
      .from("widgets")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    return (count ?? 0) > 0;
  }

  /* versions --------------------------------------------------------- */

  async createVersion(widgetId: string, schema: WidgetDocument, label: string): Promise<WidgetVersion> {
    const row = { id: newId("v_"), widget_id: widgetId, schema_json: schema, label };
    const { data, error } = await this.client.from("widget_versions").insert(row).select().single();
    if (error) throw error;
    return toVersion(data);
  }

  async listVersions(widgetId: string, limit = 20): Promise<WidgetVersion[]> {
    const { data } = await this.client
      .from("widget_versions")
      .select()
      .eq("widget_id", widgetId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map(toVersion);
  }

  /* analytics -------------------------------------------------------- */

  async recordEvents(events: NewEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.client.from("widget_events").insert(
      events.map((event) => ({
        id: newId("e_"),
        widget_id: event.widgetId,
        session_id: event.sessionId,
        event_type: event.type,
        step_id: event.stepId ?? null,
        metadata_json: event.metadata ?? null,
        ...(event.createdAt ? { created_at: event.createdAt } : {}),
      }))
    );
  }

  async listEvents(widgetId: string, since?: Date): Promise<EventRecord[]> {
    let query = this.client.from("widget_events").select().eq("widget_id", widgetId);
    if (since) query = query.gte("created_at", since.toISOString());
    const { data } = await query;
    return (data ?? []).map(toEvent);
  }

  async countInteractionsThisMonth(ownerId: string): Promise<number> {
    const { data: widgets } = await this.client.from("widgets").select("id").eq("owner_id", ownerId);
    const ids = (widgets ?? []).map((row: Row) => row.id as string);
    if (ids.length === 0) return 0;

    const { count } = await this.client
      .from("widget_events")
      .select("id", { count: "exact", head: true })
      .in("widget_id", ids)
      .eq("event_type", "widget_start")
      .gte("created_at", startOfMonth().toISOString());
    return count ?? 0;
  }

  /* leads ------------------------------------------------------------ */

  async createLead(lead: NewLead): Promise<LeadRecord> {
    const row = {
      id: newId("l_"),
      widget_id: lead.widgetId,
      name: lead.name ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      message: lead.message ?? null,
      metadata_json: lead.metadata ?? null,
    };
    const { data, error } = await this.client.from("leads").insert(row).select().single();
    if (error) throw error;
    return toLead(data);
  }

  async listLeads(widgetId: string, limit = 100): Promise<LeadRecord[]> {
    const { data } = await this.client
      .from("leads")
      .select()
      .eq("widget_id", widgetId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map(toLead);
  }

  async countLeads(widgetId: string): Promise<number> {
    const { count } = await this.client
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("widget_id", widgetId);
    return count ?? 0;
  }

  /* billing ---------------------------------------------------------- */

  async getSubscription(userId: string): Promise<SubscriptionRecord | null> {
    const { data } = await this.client
      .from("subscriptions")
      .select()
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    return {
      userId: data.user_id,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      plan: data.plan,
      status: data.status,
    };
  }

  async upsertSubscription(record: SubscriptionRecord): Promise<void> {
    await this.client.from("subscriptions").upsert(
      {
        user_id: record.userId,
        stripe_customer_id: record.stripeCustomerId,
        stripe_subscription_id: record.stripeSubscriptionId,
        plan: record.plan,
        status: record.status,
      },
      { onConflict: "user_id" }
    );
    await this.setUserPlan(record.userId, record.plan);
  }
}

/* row → record mappers ---------------------------------------------- */

function toUser(row: Row): User {
  return {
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    passwordHash: (row.password_hash as string | null) ?? null,
    plan: (row.plan as PlanId) ?? "free",
    createdAt: row.created_at as string,
  };
}

function toWidget(row: Row): WidgetRecord {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    type: row.type as WidgetRecord["type"],
    slug: row.slug as string,
    status: row.status as WidgetRecord["status"],
    draft: row.schema_json as WidgetDocument,
    published: (row.published_json as WidgetDocument | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    publishedAt: (row.published_at as string | null) ?? null,
  };
}

function toVersion(row: Row): WidgetVersion {
  return {
    id: row.id as string,
    widgetId: row.widget_id as string,
    schema: row.schema_json as WidgetDocument,
    label: (row.label as string) ?? "",
    createdAt: row.created_at as string,
  };
}

function toEvent(row: Row): EventRecord {
  return {
    id: row.id as string,
    widgetId: row.widget_id as string,
    sessionId: row.session_id as string,
    type: row.event_type as string,
    stepId: (row.step_id as string | null) ?? null,
    metadata: (row.metadata_json as EventRecord["metadata"]) ?? null,
    createdAt: row.created_at as string,
  };
}

function toLead(row: Row): LeadRecord {
  return {
    id: row.id as string,
    widgetId: row.widget_id as string,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    metadata: (row.metadata_json as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
  };
}
