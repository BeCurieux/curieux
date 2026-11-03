"use server";

import { z } from "zod";
import { sendMagicLink } from "@/lib/auth/magic-link";
import { serviceClient } from "@/lib/supabase/server";

// Every public email form: /check (lead, then a sign-in link to the free
// lessons), /hype (optional, same) and /waitlist (lead only). The lead is
// recorded before anything else, so a failed email still keeps her.

export interface LeadState {
  status: "idle" | "sent" | "listed" | "error";
  message?: string;
  email?: string;
}

const input = z.object({
  email: z.email("That doesn't look like an email address.").max(200),
  // ManyChat's deep links carry utm_source=manychat (SPEC.md → keywords).
  utm_source: z.string().max(60).optional(),
  interests: z.array(z.enum(["founding", "future_modules"])).default([]),
});

async function capture(form: FormData, source: "product_check" | "hype_check" | "waitlist") {
  // A field people can't see; bots fill it in.
  if (String(form.get("website") ?? "") !== "") return { ok: false as const, fake: true as const };
  const parsed = input.safeParse({
    email: String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
    utm_source: form.get("utm_source") ? String(form.get("utm_source")) : undefined,
    interests: form.getAll("interests").map(String),
  });
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]!.message };
  const recorded = parsed.data.utm_source?.toLowerCase() === "manychat" ? "keyword" : source;
  const { error } = await serviceClient().rpc("capture_lead", {
    p_email: parsed.data.email,
    p_source: recorded,
    p_interests: parsed.data.interests,
  });
  if (error) {
    console.error("capture_lead", error.message);
    return { ok: false as const, message: "Something went wrong. Please try again." };
  }
  return { ok: true as const, email: parsed.data.email };
}

/** Lead + sign-in link: the free Product Check and the Hype Check's optional email. */
export async function joinFree(
  source: "product_check" | "hype_check",
  _prev: LeadState,
  form: FormData,
): Promise<LeadState> {
  const result = await capture(form, source);
  if (!result.ok)
    return "fake" in result ? { status: "sent" } : { status: "error", message: result.message };
  if (!(await sendMagicLink(result.email, "/learn")))
    return {
      status: "error",
      message: "We couldn't send your link just now. Wait a minute and try again.",
      email: result.email,
    };
  return { status: "sent", email: result.email };
}

export async function joinWaitlist(_prev: LeadState, form: FormData): Promise<LeadState> {
  if (form.getAll("interests").length === 0)
    return { status: "error", message: "Choose what you'd like to hear about." };
  const result = await capture(form, "waitlist");
  if (!result.ok)
    return "fake" in result ? { status: "listed" } : { status: "error", message: result.message };
  return { status: "listed", email: result.email };
}
