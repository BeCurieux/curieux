// Stored records (brief §32).
//
// The widget document itself is never spread across columns — it lives in one
// `schema_json` blob, validated by Zod on the way in and on the way out. That
// keeps adding a new input type or result kind a schema-file change rather
// than a database migration, which is what §3 means by "future types should be
// possible without architectural changes".

import type { WidgetDocument, WidgetStatus, WidgetType } from "@/lib/widget/schema";
import type { PlanId } from "@/lib/plans";

export interface User {
  id: string;
  /** Null until they sign up — anonymous authors are first-class (§27). */
  email: string | null;
  passwordHash: string | null;
  plan: PlanId;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
}

export interface WidgetRecord {
  id: string;
  ownerId: string;
  name: string;
  type: WidgetType;
  slug: string;
  status: WidgetStatus;
  /** What the builder edits. */
  draft: WidgetDocument;
  /** What the world sees. Null until first publish (§34). */
  published: WidgetDocument | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface WidgetVersion {
  id: string;
  widgetId: string;
  schema: WidgetDocument;
  label: string;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  widgetId: string;
  sessionId: string;
  type: string;
  stepId: string | null;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: string;
}

export interface LeadRecord {
  id: string;
  widgetId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  /** The visitor's answers, so a lead arrives with its context attached. */
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: PlanId;
  status: string;
}
