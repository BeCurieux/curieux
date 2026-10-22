import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { billingDeps } from "@/lib/billing";
import { parsePing } from "@/lib/billing/gumroad";
import { handlePing } from "@/lib/billing/service";
import { track } from "@/lib/analytics/track";

// Gumroad's Ping (and refund/dispute resource subscriptions) post here:
//   https://<app>/api/billing/gumroad?token=<GUMROAD_PING_SECRET>
// Gumroad doesn't sign pings, so the secret only filters noise; trust comes
// from re-verifying the sale with Gumroad's API (src/lib/billing/service.ts).
// Always answers 200 once the token is right, so Gumroad doesn't retry a
// ping we deliberately ignored.

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: NextRequest) {
  const secret = serverEnv().GUMROAD_PING_SECRET;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!secret || !same(token, secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = new URLSearchParams(await request.text());
  try {
    const result = await handlePing(billingDeps(), parsePing(form));
    if (!result) {
      console.warn("gumroad ping could not be verified", form.get("sale_id"));
      return NextResponse.json({ ok: true, verified: false });
    }
    if (result.event === "created") await track("purchase_verified", result.purchase.userId, { product_type: result.purchase.productType });
    if (result.event === "refunded") await track("purchase_refunded", result.purchase.userId, { product_type: result.purchase.productType });
    return NextResponse.json({ ok: true, verified: true });
  } catch (error) {
    // Let Gumroad retry: something on our side or theirs failed.
    console.error("gumroad ping", error);
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
}
