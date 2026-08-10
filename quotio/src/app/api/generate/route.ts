// Natural language → widget (brief §11).
//
// A route rather than a server action because the caller is a screen showing
// progress ("Understanding your idea…", §29) and wants to handle its own
// success, failure and redirect. It creates the widget and hands back an id.
//
// Anonymous callers are fine: `ensureAuthor` gives them an account with no
// email on it, which is the whole point of §27.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuthor } from "@/lib/auth/session";
import { getAIProvider, MAX_PROMPT_LENGTH } from "@/lib/ai/provider";
import { widgetTypeSchema } from "@/lib/widget/schema";
import { createWidgetFor, isLimitError } from "@/lib/widgets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  prompt: z.string().min(3).max(MAX_PROMPT_LENGTH),
  type: widgetTypeSchema.optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Tell us a little about what you want to build." },
      { status: 400 }
    );
  }

  const author = await ensureAuthor();

  let generated;
  try {
    generated = await getAIProvider().generateWidget(parsed.data.prompt, {
      preferredType: parsed.data.type,
    });
  } catch (error) {
    // The providers already fall back internally; this is the belt to that
    // pair of braces, so a generation request can't 500.
    console.error("[generate] provider threw", error);
    return NextResponse.json(
      { ok: false, error: "We couldn't build that one. Try describing it a little differently." },
      { status: 502 }
    );
  }

  const created = await createWidgetFor(author.id, author.plan, generated.document);
  if (isLimitError(created)) {
    return NextResponse.json({ ok: false, error: created.message }, { status: 402 });
  }

  return NextResponse.json({
    ok: true,
    widgetId: created.id,
    source: generated.source,
    note: generated.note,
  });
}
