// Event ingestion (brief §26).
//
// Public and unauthenticated — it has to be, the callers are widgets on other
// people's websites. Three things keep that safe: the body is a fixed shape
// with a hard batch limit, events for unknown widgets are dropped, and the
// only thing stored is what the schema allows. There is no free-form payload
// to smuggle anything through.

import { NextResponse } from "next/server";
import { eventBatchSchema } from "@/lib/analytics/events";
import { getStore } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = eventBatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const store = getStore();

  // One lookup per distinct widget, not per event.
  const ids = [...new Set(parsed.data.events.map((event) => event.widgetId))];
  const known = new Set<string>();
  for (const id of ids) {
    const widget = await store.getWidget(id);
    // Only published widgets accumulate analytics. A draft being previewed by
    // its author is not traffic (§41 — no fake analytics).
    if (widget?.status === "published") known.add(id);
  }

  const accepted = parsed.data.events.filter((event) => known.has(event.widgetId));
  if (accepted.length > 0) {
    await store.recordEvents(
      accepted.map((event) => ({
        widgetId: event.widgetId,
        sessionId: event.sessionId,
        type: event.type,
        stepId: event.stepId,
        metadata: event.metadata,
      }))
    );
  }

  // 204 keeps sendBeacon quiet and costs nothing to parse.
  return new NextResponse(null, { status: 204 });
}

/** CORS preflight, for embeds served from another origin. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
