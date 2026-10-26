import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appUrl, serverEnv } from "@/env";
import { FIT_CHECK_URL, INCOME_FIT_TEST_URL } from "@/content/catalogue";
import type { EmailSignup, SystemRepo } from "@/lib/data/repo";
import type { EmailSender } from "./send";
import { dueStep, parseWelcomeSequence, renderWelcome, type WelcomeEmail } from "./sequence";

// Sends the five welcome emails: email 1 straight after sign-up
// (src/app/fit-check/actions.ts), the rest from the daily job
// (src/app/api/email/welcome/route.ts).

let cached: WelcomeEmail[] | undefined;

export function welcomeEmails(): WelcomeEmail[] {
  // Bundled with the routes that send (next.config.ts outputFileTracingIncludes).
  cached ??= parseWelcomeSequence(
    readFileSync(path.join(process.cwd(), "content/emails/welcome-sequence.md"), "utf8"),
  );
  return cached;
}

export interface WelcomeDeps {
  repo: SystemRepo;
  sender: EmailSender;
  emails: WelcomeEmail[];
  appUrl: string;
  fitCheckUrl: string;
  incomeFitTestUrl: string;
  now: () => Date;
}

export function welcomeDeps(repo: SystemRepo, sender: EmailSender): WelcomeDeps {
  const env = serverEnv();
  return {
    repo,
    sender,
    emails: welcomeEmails(),
    appUrl: appUrl(),
    fitCheckUrl: env.FIT_CHECK_DOWNLOAD_URL ?? FIT_CHECK_URL,
    incomeFitTestUrl: process.env.NEXT_PUBLIC_INCOME_FIT_TEST_URL || INCOME_FIT_TEST_URL,
    now: () => new Date(),
  };
}

export type SendOutcome = "sent" | "not_due" | "taken" | "failed";

/** Sends the next due email to one sign-up, at most one. */
export async function sendNextWelcome(
  signup: EmailSignup,
  deps: WelcomeDeps,
): Promise<SendOutcome> {
  const now = deps.now();
  const step = dueStep(signup, deps.emails, now);
  if (step === null) return "not_due";
  const email = deps.emails.find((e) => e.step === step)!;

  // Claim the step first so a second run can't send it too.
  const at = now.toISOString();
  if (!(await deps.repo.advanceWelcome(signup.id, step - 1, step, at))) return "taken";

  const unsubscribe = `${deps.appUrl}/unsubscribe?token=${encodeURIComponent(signup.unsubscribeToken)}`;
  const oneClick = `${deps.appUrl}/api/unsubscribe?token=${encodeURIComponent(signup.unsubscribeToken)}`;
  try {
    const rendered = renderWelcome(email, {
      appUrl: deps.appUrl,
      fitCheckUrl: deps.fitCheckUrl,
      incomeFitTestUrl: deps.incomeFitTestUrl,
      unsubscribeUrl: unsubscribe,
    });
    await deps.sender.send({
      to: signup.email,
      ...rendered,
      headers: {
        // One-click unsubscribe from the mail app itself (RFC 8058).
        "List-Unsubscribe": `<${oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      idempotencyKey: `welcome-${signup.id}-${step}`,
    });
    return "sent";
  } catch (error) {
    // Hand the step back so the next run tries again.
    await deps.repo
      .advanceWelcome(signup.id, step, step - 1, signup.welcomeLastSentAt)
      .catch(() => undefined);
    console.error("welcome email", step, error instanceof Error ? error.message : error);
    return "failed";
  }
}

export interface WelcomeRun {
  checked: number;
  sent: number;
  failed: number;
}

/** The daily job: everyone with an email due gets the next one. */
export async function runWelcome(deps: WelcomeDeps, limit = 500): Promise<WelcomeRun> {
  const candidates = await deps.repo.welcomeCandidates(limit);
  const run: WelcomeRun = { checked: candidates.length, sent: 0, failed: 0 };
  for (const signup of candidates) {
    const outcome = await sendNextWelcome(signup, deps);
    if (outcome === "sent") run.sent += 1;
    if (outcome === "failed") run.failed += 1;
  }
  return run;
}
