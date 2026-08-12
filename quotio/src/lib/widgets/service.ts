// Widget operations shared by server actions, API routes and scripts.
//
// No `server-only` marker: nothing here touches the request, so the seed
// script and the tests can use exactly the same creation path a real user
// does rather than reaching into the store behind its back.
//
// Ownership, plan limits and slug allocation live here rather than in each
// caller, so there is one place to check that a mutation is allowed and one
// place that decides what a widget's public URL is.

import { getStore, uniqueSlug } from "@/lib/db/store";
import type { WidgetRecord } from "@/lib/db/types";
import { slugify } from "@/lib/widget/format";
import { widgetSchema, type Widget, type WidgetDocument } from "@/lib/widget/schema";
import { can, interactionLimit, mustShowBadge, widgetLimit, type PlanId } from "@/lib/plans";

export interface WidgetLimitError {
  error: "limit";
  message: string;
}

export async function createWidgetFor(
  ownerId: string,
  plan: PlanId,
  document: WidgetDocument
): Promise<WidgetRecord | WidgetLimitError> {
  const store = getStore();
  const count = await store.countWidgets(ownerId);
  const limit = widgetLimit(plan);

  if (count >= limit) {
    return {
      error: "limit",
      message: `Your plan includes ${limit} widget${limit === 1 ? "" : "s"}. Delete one or upgrade to add more.`,
    };
  }

  const slug = await uniqueSlug(store, slugify(document.name, "widget"));
  return store.createWidget({ ownerId, name: document.name, slug, draft: document });
}

export function isLimitError(value: unknown): value is WidgetLimitError {
  return typeof value === "object" && value !== null && (value as WidgetLimitError).error === "limit";
}

/**
 * The document to render publicly.
 *
 * Published widgets serve their published schema, never the draft — editing a
 * live widget must not change what customers see until Publish is pressed
 * (§34). Returns null for a widget that has never been published.
 */
export function publicDocument(record: WidgetRecord): WidgetDocument | null {
  return record.status === "published" ? record.published : null;
}

/** Attach the row's identity to a document so the renderer can be given one object. */
export function toRenderable(record: WidgetRecord, document: WidgetDocument): Widget {
  return widgetSchema.parse({
    ...document,
    id: record.id,
    slug: record.slug,
    status: record.status,
  });
}

export interface RenderableWidget {
  widget: Widget;
  showBadge: boolean;
  /** True when a gate changed what the visitor sees, for the builder's note. */
  leadCaptureGated: boolean;
  /**
   * The owner has used every interaction their plan allows this month, so
   * visitors get a notice instead of the widget until it resets.
   */
  overInteractionLimit: boolean;
}

/**
 * Has this owner used up the month's interactions?
 *
 * The limit counts `widget_start` — someone answering something — which is
 * also what the dashboard's usage bar counts, so the number you watch there
 * is the number that runs out.
 *
 * Enforced here rather than at the events endpoint on purpose: a widget that
 * still takes answers but quietly stops recording them would show its owner a
 * frozen count and no reason for it. Stopping at the door is visible to
 * everyone it affects.
 */
export async function isOverInteractionLimit(ownerId: string, plan: PlanId): Promise<boolean> {
  const used = await getStore().countInteractionsThisMonth(ownerId);
  return used >= interactionLimit(plan);
}

/**
 * Apply the owner's plan to a widget before anyone looks at it (§35).
 *
 * The important part is that gating happens *here* and not in the renderer.
 * A free plan doesn't hide the lead form with CSS — the form is removed from
 * the document, so there is no button that quietly does nothing (§41).
 */
export async function renderableFor(
  record: WidgetRecord,
  document: WidgetDocument
): Promise<RenderableWidget> {
  const owner = await getStore().getUser(record.ownerId);
  const plan = owner?.plan ?? "free";
  const allowsLeads = can(plan, "leadCapture");
  const gated = !allowsLeads && document.settings.leadCapture.mode !== "none";

  const effective: WidgetDocument = gated
    ? {
        ...document,
        settings: {
          ...document.settings,
          leadCapture: { ...document.settings.leadCapture, mode: "none" },
        },
      }
    : document;

  return {
    widget: toRenderable(record, effective),
    showBadge: mustShowBadge(plan, document.settings.showBadge),
    leadCaptureGated: gated,
    overInteractionLimit: await isOverInteractionLimit(record.ownerId, plan),
  };
}

/** Server-side gate for the lead endpoint. */
export async function ownerCanCaptureLeads(record: WidgetRecord): Promise<boolean> {
  const owner = await getStore().getUser(record.ownerId);
  return can(owner?.plan ?? "free", "leadCapture");
}

/**
 * Save a version before a publish, so there is something to point at when
 * someone says "it was better yesterday" (§33).
 */
export async function snapshot(record: WidgetRecord, label: string): Promise<void> {
  await getStore().createVersion(record.id, record.draft, label);
}
