import { NextResponse, type NextRequest } from "next/server";
import { billingDeps } from "@/lib/billing";
import { recheck } from "@/lib/billing/service";
import { isCronRequest } from "@/lib/cron";

// Daily (vercel.json cron): re-verify recent purchases so a refund is caught
// even if its notification never arrived.
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await recheck(billingDeps());
  return NextResponse.json(result);
}
