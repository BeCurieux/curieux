import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { anonClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitiseUserText } from "@/lib/security/sanitise";

const bodySchema = z.object({
  email: z.string().email().max(320),
  city: z.string().min(2).max(80),
});

/** "Not in your city yet?" (§5). */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "waitlist", { limit: 5, windowSeconds: 300 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and city" }, { status: 400 });
  }

  const { error } = await anonClient()
    .from("waitlist_entries")
    .insert({
      email: parsed.data.email.toLowerCase().trim(),
      city: sanitiseUserText(parsed.data.city, 80),
    });

  // 23505 means they are already on the list, which is a success from the
  // visitor’s point of view and should not be reported as a failure.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Couldn’t add you just now" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
