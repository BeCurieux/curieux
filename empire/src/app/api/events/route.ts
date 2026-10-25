import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { isAutomatedVisitor } from "@/lib/analytics/automated";
import { track, type EventName } from "@/lib/analytics/track";

// Events the browser reports. Only these names; properties are filtered by
// track()'s allow list, so nothing a customer typed can be sent.
const CLIENT_EVENTS = new Set<EventName>([
  "landing_viewed",
  "pricing_viewed",
  "preview_started",
  "asset_copied",
  "asset_downloaded",
  "calculator_viewed",
  "fit_landing_viewed",
  "fit_check_viewed",
  "offer_viewed",
  "offer_clicked",
]);

export async function POST(request: Request) {
  let body: { name?: unknown; props?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const name = typeof body.name === "string" ? (body.name as EventName) : null;
  if (!name || !CLIENT_EVENTS.has(name)) return NextResponse.json({ ok: false }, { status: 400 });
  // Deployment checks and crawlers get the same answer but aren't counted.
  if (isAutomatedVisitor(request.headers.get("user-agent"))) return NextResponse.json({ ok: true });
  const props =
    body.props && typeof body.props === "object" ? (body.props as Record<string, unknown>) : {};
  const user = await currentUser().catch(() => null);
  await track(name, user?.id ?? null, props);
  return NextResponse.json({ ok: true });
}
