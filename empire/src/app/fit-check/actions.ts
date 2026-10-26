"use server";

import { z } from "zod";
import { serverEnv } from "@/env";
import { EMAIL_CONSENT_TEXT, EMAIL_CONSENT_VERSION } from "@/content/consent";
import { track } from "@/lib/analytics/track";
import { systemRepo } from "@/lib/data";
import { senderFromEnv } from "@/lib/email/send";
import { sendNextWelcome, welcomeDeps } from "@/lib/email/welcome";

export interface OptInState {
  status: "idle" | "done" | "error";
  message?: string;
}

const emailSchema = z.email("That doesn't look like an email address.").max(200);
// Campaign names only: letters, numbers and a few separators.
const tag = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim().slice(0, 60) : "";
  return /^[\w.:/-]+$/.test(s) ? s : null;
};

export async function optIn(_prev: OptInState, form: FormData): Promise<OptInState> {
  if (serverEnv().EMPIRE_EMAIL_OPTIN !== "on")
    return { status: "error", message: "Email sign-up isn't open yet." };
  // A field people can't see: if it's filled in, a bot filled it.
  if (String(form.get("website") ?? "") !== "") return { status: "done" };
  if (form.get("consent") !== "yes")
    return { status: "error", message: "Tick the box if you'd like the emails." };
  const parsed = emailSchema.safeParse(
    String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  const source = tag(form.get("source"));
  const medium = tag(form.get("medium"));
  const campaign = tag(form.get("campaign"));
  const result = await systemRepo().recordEmailSignup({
    email: parsed.data,
    consentText: EMAIL_CONSENT_TEXT,
    consentVersion: EMAIL_CONSENT_VERSION,
    source,
    medium,
    campaign,
    landing: "/fit-check",
  });
  if (result !== "already")
    await track("email_consent_given", null, {
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
      path: "/fit-check",
    });
  if (result !== "already") await sendFirstEmail(parsed.data);
  // The same answer whether or not she was already on the list.
  return { status: "done" };
}

// Email 1 goes out straight away. If it fails, the daily job retries it, so
// a sending problem never turns into an error on the page.
async function sendFirstEmail(email: string): Promise<void> {
  try {
    const sender = senderFromEnv();
    const repo = systemRepo();
    const signup = sender ? await repo.findEmailSignup(email) : null;
    if (sender && signup) await sendNextWelcome(signup, welcomeDeps(repo, sender));
  } catch (error) {
    console.error("welcome email 1", error instanceof Error ? error.message : error);
  }
}
