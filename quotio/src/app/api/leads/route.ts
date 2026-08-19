// Lead capture (brief §20).
//
// Also public, for the same reason as /api/events. The answers that produced
// the quote are stored alongside the contact details, because a lead that
// arrives without its context makes the business ring back and ask all the
// questions again — which is the thing the widget was supposed to prevent.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db/store";
import { ownerCanCaptureLeads, publicDocument } from "@/lib/widgets/service";
import { evaluateWidget } from "@/lib/widget/engine";
import { notifyOwnerOfLead } from "@/lib/email/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadSchema = z.object({
  widgetId: z.string().min(1).max(64),
  name: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
  message: z.string().max(2000).optional(),
  /** The visitor's answers, capped so this can't be used as free storage. */
  answers: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const store = getStore();
  const widget = await store.getWidget(parsed.data.widgetId);
  if (!widget || widget.status !== "published") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  // The renderer already hides the form on plans without lead capture; this
  // is the same rule enforced where it can't be bypassed.
  if (!(await ownerCanCaptureLeads(widget))) {
    return NextResponse.json({ ok: false }, { status: 402 });
  }

  const document = publicDocument(widget);
  if (!document) return NextResponse.json({ ok: false }, { status: 404 });

  const answers = sanitiseAnswers(parsed.data.answers ?? {});
  const evaluation = evaluateWidget(document, answers);

  const lead = await store.createLead({
    widgetId: widget.id,
    name: parsed.data.name?.trim() || undefined,
    email: parsed.data.email?.trim().toLowerCase() || undefined,
    phone: parsed.data.phone?.trim() || undefined,
    message: parsed.data.message?.trim() || undefined,
    metadata: {
      answers,
      result: evaluation.display,
      outcome: evaluation.outcome?.title ?? null,
    },
  });

  // Awaited so a serverless invocation isn't frozen mid-send, but never
  // allowed to change the answer. The visitor filled the form in; the lead is
  // stored; whether our mail provider is having a bad afternoon is not
  // something they should find out about.
  if (document.settings.leadCapture.notify) {
    try {
      await notifyOwnerOfLead(widget, lead, answers, document);
    } catch (error) {
      console.error("[leads] notification failed, lead is stored:", error);
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Keep only answers that look like answers: primitives and small arrays of
 * primitives, with a cap on how many. Whatever a widget's questions are, none
 * of them produce a nested object.
 */
function sanitiseAnswers(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of Object.entries(raw)) {
    if (count >= 40 || !/^[a-z][a-z0-9_]{0,47}$/.test(key)) continue;
    if (isSimple(value)) {
      clean[key] = typeof value === "string" ? value.slice(0, 500) : value;
      count += 1;
    } else if (Array.isArray(value) && value.length <= 20 && value.every(isSimple)) {
      clean[key] = value.map((item) => (typeof item === "string" ? item.slice(0, 200) : item));
      count += 1;
    }
  }
  return clean;
}

function isSimple(value: unknown): boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
