import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { billingDeps } from "@/lib/billing";
import { recheck } from "@/lib/billing/service";

// Daily (vercel.json cron): re-verify recent purchases so a refund is caught
// even if its notification never arrived. Vercel sends CRON_SECRET as a
// bearer token.
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await recheck(billingDeps());
  return NextResponse.json(result);
}
