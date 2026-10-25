import { NextResponse } from "next/server";
import { serverEnv, sessionSecret } from "@/env";
import { currentUser } from "@/lib/auth/session";
import { makeRef } from "@/lib/billing/ref";
import { track } from "@/lib/analytics/track";

// Sends a signed-in customer to Gumroad with her email filled in and a
// signed reference, so the purchase finds her account even if she changes
// the email at checkout.
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", request.url));
  const base = serverEnv().GUMROAD_PRODUCT_URL;
  if (!base) return NextResponse.redirect(new URL("/account", request.url));
  const url = new URL(base);
  url.searchParams.set("wanted", "true");
  url.searchParams.set("email", user.email);
  url.searchParams.set("empire_ref", makeRef(user.id, sessionSecret()));
  await track("checkout_started", user.id);
  return NextResponse.redirect(url);
}
