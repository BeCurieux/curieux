/**
 * Cron endpoint authentication (§50, §58 CRON_SECRET).
 *
 * These endpoints queue work and spend money on provider calls, so they are
 * not public. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; a
 * manual invocation can use the same header.
 *
 * The comparison is constant-time. A timing oracle on a shared secret is a
 * small risk, but it costs one function to remove.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/config/env";

/** Returns a response when the request should be rejected, null when it is fine. */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const expected = serverEnv().CRON_SECRET;

  // Refuse rather than run unauthenticated: an unset secret in production
  // would leave the generation trigger open to anyone who guesses the path.
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
