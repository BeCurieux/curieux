/**
 * The funnel endpoint.
 *
 * The only route in the system that takes input from anybody with a URL, so it
 * is deliberately small and deliberately dull.
 *
 * It always answers 204, even on a body it rejected. A shopper cannot fix a
 * malformed analytics call, a shop that visibly broke because event recording
 * was down would be the tail wagging the dog, and an endpoint that reports
 * precisely why it refused something is an endpoint that helps somebody work
 * out what it will accept. Reasons go to the server log.
 */

import { NextResponse } from "next/server";
import { FunnelEventBatch, recordEvents } from "@/lib/funnel/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enough for a page's worth of events; small enough not to be a payload. */
const MAX_BYTES = 8_000;

const NO_CONTENT = new NextResponse(null, { status: 204 });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) return NO_CONTENT;

    const raw = await request.text();
    if (raw.length > MAX_BYTES) return NO_CONTENT;

    const parsed = FunnelEventBatch.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn("[funnel] rejected a batch:", parsed.error.issues.slice(0, 3));
      return NO_CONTENT;
    }

    const { dropped } = await recordEvents(parsed.data.events);
    if (dropped.length > 0) console.warn("[funnel] dropped:", dropped.slice(0, 3));
  } catch (error) {
    // Including a JSON parse failure, which is what a probe looks like.
    console.warn("[funnel] failed:", error instanceof Error ? error.message : String(error));
  }

  return NO_CONTENT;
}
