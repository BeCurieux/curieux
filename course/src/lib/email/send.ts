import "server-only";
import { serverEnv } from "@/env";
import { currencyFor } from "@/lib/calc/format";
import { REFUND_DAYS } from "@/lib/commerce/plan";
import { catalogue, priceTokens } from "@/lib/pages/prices";
import { serviceClient } from "@/lib/supabase/server";
import { loadTemplate, renderEmail, type TemplateId } from "./templates";
import { deliver } from "./transport";
import { unsubscribeUrl } from "./unsubscribe";

// Sending one email, exactly once (SPEC.md → Email: every send is recorded
// in email_events first). The claim is the row: unique per recipient and
// key, so a retried webhook or a second cron run finds it and stops. If the
// send fails, the claim is removed so the next run tries again.

export type Recipient = { userId: string; email: string } | { leadEmail: string };
export type SendOutcome = "sent" | "duplicate" | "suppressed" | "failed";

export function emailSecret(): string {
  const env = serverEnv();
  const secret = env.EMAIL_TOKEN_SECRET ?? env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new Error(
      "EMAIL_TOKEN_SECRET (or SUPABASE_SECRET_KEY) is needed to sign unsubscribe links",
    );
  return secret;
}

export const addressOf = (to: Recipient) =>
  ("leadEmail" in to ? to.leadEmail : to.email).toLowerCase();

export async function isSuppressed(email: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from("email_suppressions")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

/** The tokens every email can use, in the recipient's currency. */
async function baseVars(to: Recipient): Promise<Record<string, string>> {
  const appUrl = serverEnv().APP_URL;
  let firstName = "there";
  let country: string | null = null;
  if ("userId" in to) {
    const { data } = await serviceClient()
      .from("profiles")
      .select("first_name, country")
      .eq("user_id", to.userId)
      .maybeSingle();
    if (data?.first_name) firstName = data.first_name;
    country = data?.country ?? null;
  }
  return {
    first_name: firstName,
    learn_url: `${appUrl}/learn`,
    lesson_0_2_url: `${appUrl}/learn/module-0/lesson-0-2`,
    account_url: `${appUrl}/account`,
    verdict_url: `${appUrl}/verdict`,
    pricing_url: `${appUrl}/pricing`,
    check_url: `${appUrl}/check`,
    support_email: serverEnv().SUPPORT_EMAIL ?? serverEnv().EMAIL_REPLY_TO ?? "",
    ...priceTokens(await catalogue(), currencyFor(country)),
    refund_days: String(REFUND_DAYS),
  };
}

export async function sendEmail(
  template: TemplateId,
  key: string,
  to: Recipient,
  vars: Record<string, string> = {},
): Promise<SendOutcome> {
  const db = serviceClient();
  const address = addressOf(to);
  const loaded = await loadTemplate(template);
  if (loaded.kind === "marketing" && (await isSuppressed(address))) return "suppressed";

  const claim = await db
    .from("email_events")
    .insert(
      "leadEmail" in to
        ? { lead_email: address, template: key }
        : { user_id: to.userId, template: key },
    )
    .select("id")
    .single();
  if (claim.error) {
    if (claim.error.code === "23505") return "duplicate";
    console.error("email claim", key, claim.error.message);
    return "failed";
  }

  try {
    const appUrl = serverEnv().APP_URL;
    const unsubscribe = unsubscribeUrl(appUrl, address, emailSecret());
    const rendered = await renderEmail(
      loaded,
      { ...(await baseVars(to)), ...vars },
      { appUrl, unsubscribeUrl: unsubscribe },
    );
    const result = await deliver({
      to: address,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: claim.data.id,
      // One-click unsubscribe for mail apps (RFC 8058), marketing only.
      headers:
        rendered.kind === "marketing"
          ? {
              "List-Unsubscribe": `<${unsubscribe.replace("/unsubscribe?", "/api/unsubscribe?")}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
    });
    await db
      .from("email_events")
      .update({ sent_at: new Date().toISOString(), provider_id: result.id })
      .eq("id", claim.data.id);
    return "sent";
  } catch (error) {
    console.error("email send", key, error instanceof Error ? error.message : error);
    await db.from("email_events").delete().eq("id", claim.data.id);
    return "failed";
  }
}
