import "server-only";

import { brand, appUrl } from "@/config/brand";
import { getStore } from "@/lib/db/store";
import { emailEnabled, getMailer } from "./mailer";
import type { LeadRecord, WidgetRecord } from "@/lib/db/types";
import type { WidgetDocument } from "@/lib/widget/schema";
import { describeAnswers } from "@/lib/widget/describe";

/**
 * Telling a business someone is asking for a quote.
 *
 * This is the product's whole promise, so it is the one message that must not
 * be a bare "you have a new lead — log in to see it". A cleaning company
 * reading this on a phone should be able to reply straight away without
 * opening anything, which means the contact details and the number the
 * visitor was quoted go in the body.
 *
 * Never allowed to fail the request that triggered it. A visitor who filled in
 * a form has done their part; whether our mail provider is having a bad
 * afternoon is not their problem, and the lead is already stored either way.
 */
export async function notifyOwnerOfLead(
  widget: WidgetRecord,
  lead: LeadRecord,
  answers: Record<string, unknown>,
  /** The document they answered, so their answers can be named (§20). */
  document?: WidgetDocument
): Promise<{ sent: boolean; reason?: string }> {
  if (!emailEnabled()) return { sent: false, reason: "email not configured" };

  const owner = await getStore().getUser(widget.ownerId);
  // An anonymous author has nowhere to be written to. They can't publish
  // either (§27), so this is belt and braces rather than a live case.
  if (!owner?.email) return { sent: false, reason: "owner has no email" };

  const result = (lead.metadata as { result?: string } | null)?.result;
  const outcome = (lead.metadata as { outcome?: string | null } | null)?.outcome;

  const lines = [
    `Someone just finished ${widget.name}.`,
    "",
    ...contactLines(lead),
    "",
    result ? `They were quoted: ${result}` : null,
    outcome ? `Result: ${outcome}` : null,
    "",
    ...answerLines(answers, document),
    "",
    `All of them: ${appUrl()}/dashboard/widgets/${widget.id}/analytics`,
    "",
    `Sent by ${brand.name}.`,
  ].filter((line) => line !== null) as string[];

  const result_ = await getMailer().send({
    to: owner.email,
    // The widget's name, so someone running three of them can tell at a
    // glance which business line this is without opening it.
    subject: `New lead from ${widget.name}`,
    body: lines.join("\n"),
  });

  return { sent: result_.sent, reason: result_.detail };
}

function contactLines(lead: LeadRecord): string[] {
  const rows = [
    lead.name ? `Name:    ${lead.name}` : null,
    lead.email ? `Email:   ${lead.email}` : null,
    lead.phone ? `Phone:   ${lead.phone}` : null,
    lead.message ? `Message: ${lead.message}` : null,
  ].filter(Boolean) as string[];
  // The lead form always collects at least one field, but a widget configured
  // down to a single optional one could still produce this.
  return rows.length > 0 ? rows : ["They didn't leave contact details."];
}

/**
 * What they answered, so the business doesn't have to ask twice (§20).
 *
 * Named against the document when we have it. Without it the raw record is
 * all there is, and `home_type: 40` is the value an apartment contributes to
 * the price rather than anything a person said — so with no document, this
 * says nothing rather than something misleading.
 */
function answerLines(
  answers: Record<string, unknown>,
  document?: WidgetDocument
): string[] {
  if (!document) return [];
  const described = describeAnswers(document, answers);
  if (described.length === 0) return [];
  return [
    "What they told you:",
    ...described.map(({ question, answer }) => `  ${question}  ${answer}`),
  ];
}
