"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/env";
import { sendMagicLink } from "@/lib/auth/magic-link";
import { requestOrigin } from "@/lib/auth/origin";
import { sendEmail } from "@/lib/email/send";
import { emailConfigured } from "@/lib/email/transport";
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
  const sent = emailConfigured()
    ? await sendWelcome(result.email)
    : await sendMagicLink(result.email, "/learn");
  if (!sent)
    return {
      status: "error",
      message: "We couldn't send your link just now. Wait a minute and try again.",
      email: result.email,
    };
  return { status: "sent", email: result.email };
}

/**
 * The "lead captured" email (SPEC.md → Email): her sign-in link plus "start
 * with lesson 0.2", sent through Resend rather than Supabase's plain
 * sign-in email. The link is made with the admin API and lands on
 * /auth/confirm like every other sign-in link. One per minute per address,
 * so a double-click doesn't send two.
 */
async function sendWelcome(email: string): Promise<boolean> {
  const origin = requestOrigin(await headers(), serverEnv().APP_URL);
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/confirm` },
  });
  if (error || !data.properties?.hashed_token) {
    console.error("lead welcome link", error?.message);
    return false;
  }
  // A brand-new address gets a "signup" link, an existing one "magiclink";
  // /auth/confirm accepts both.
  const type = data.properties.verification_type ?? "magiclink";
  const link = `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type}`;
  const minute = new Date().toISOString().slice(0, 16);
  const outcome = await sendEmail(
    "lead_welcome",
    `lead_welcome:${minute}`,
    { leadEmail: email },
    { magic_link: link },
  );
  return outcome === "sent" || outcome === "duplicate";
}

export async function joinWaitlist(_prev: LeadState, form: FormData): Promise<LeadState> {
  if (form.getAll("interests").length === 0)
    return { status: "error", message: "Choose what you'd like to hear about." };
  const result = await capture(form, "waitlist");
  if (!result.ok)
    return "fake" in result ? { status: "listed" } : { status: "error", message: result.message };
  return { status: "listed", email: result.email };
}
