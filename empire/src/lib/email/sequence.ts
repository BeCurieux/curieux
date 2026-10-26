// The five welcome emails, read from the founder-reviewed source
// (content/emails/welcome-sequence.md) and turned into what Resend sends.
// The file stays the single source: tests/unit/emails.test.ts checks its
// wording, and this module only fills in the links and the footer.

import { SELLER } from "@/lib/billing/plans";

export interface WelcomeEmail {
  /** 1 to 5. */
  step: number;
  /** Days after sign-up, from the heading ("Email 2 · Day 2 · …"). */
  day: number;
  subject: string;
  preview: string;
  /** The body as written, with [first name] and [Link: …] placeholders. */
  body: string;
}

export function parseWelcomeSequence(markdown: string): WelcomeEmail[] {
  return markdown
    .split(/^## Email /m)
    .slice(1)
    .map((section) => {
      const heading = section.split("\n")[0]!;
      const match = /^(\d+) · Day (\d+) · /.exec(heading);
      if (!match) throw new Error(`Unreadable email heading: "${heading}"`);
      const subject = /^\*\*Subject:\*\* (.+)$/m.exec(section)?.[1]?.trim();
      const preview = /^\*\*Preview:\*\* (.+)$/m.exec(section)?.[1]?.trim();
      if (!subject || !preview) throw new Error(`Email ${match[1]} needs a subject and preview`);
      const afterPreview = section.slice(section.indexOf("**Preview:**"));
      const body = afterPreview
        .split("\n")
        .slice(1)
        .join("\n")
        .replace(/\n---\s*$/, "")
        .trim();
      return { step: Number(match[1]), day: Number(match[2]), subject, preview, body };
    });
}

export interface RenderContext {
  appUrl: string;
  /** The free Fit Check: a direct download if one is set, else Gumroad. */
  fitCheckUrl: string;
  incomeFitTestUrl: string;
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const STUDIO_HOST = "studio.herlittleempire.com";

/** Where a [Link: …] placeholder points. Throws on a label it doesn't know. */
export function resolveLink(label: string, step: number, ctx: RenderContext): string {
  if (label === "Fit Check") return ctx.fitCheckUrl;
  if (label === "Income Fit Test") return ctx.incomeFitTestUrl;
  if (label.startsWith(STUDIO_HOST)) {
    const path = label.slice(STUDIO_HOST.length) || "/";
    // Tagged so /admin shows which email brought the visit.
    return `${ctx.appUrl}${path}?utm_source=email&utm_medium=welcome&utm_campaign=welcome-${step}`;
  }
  throw new Error(`Email ${step}: no link for "${label}"`);
}

const LINK = /\[Link: ([^\]]+)\]/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function htmlLine(line: string, step: number, ctx: RenderContext): string {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(LINK)) {
    const url = resolveLink(m[1]!, step, ctx);
    out += escapeHtml(line.slice(last, m.index));
    out += `<a href="${escapeHtml(url)}" style="color:#5b2a4e">${escapeHtml(url.replace(/^https?:\/\//, "").replace(/\?.*$/, ""))}</a>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(line.slice(last));
}

function htmlBody(body: string, step: number, ctx: RenderContext): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\d+\. /.test(l)))
        return `<ol>${lines.map((l) => `<li>${htmlLine(l.replace(/^\d+\. /, ""), step, ctx)}</li>`).join("")}</ol>`;
      if (lines.every((l) => /^- /.test(l)))
        return `<ul>${lines.map((l) => `<li>${htmlLine(l.slice(2), step, ctx)}</li>`).join("")}</ul>`;
      return `<p>${lines.map((l) => htmlLine(l, step, ctx)).join("<br>")}</p>`;
    })
    .join("\n");
}

export function renderWelcome(email: WelcomeEmail, ctx: RenderContext): RenderedEmail {
  // No names are collected, so "Hi [first name]," becomes "Hi,".
  const body = email.body.replace(/ ?\[first name\]/g, "");
  const imprint = `${SELLER.name} · ABN ${SELLER.abn} · ${SELLER.email}`;

  const text = [
    body.replace(LINK, (_, label: string) => resolveLink(label, email.step, ctx)),
    "",
    "—",
    `Unsubscribe with one click: ${ctx.unsubscribeUrl}`,
    imprint,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(email.subject)}</title></head>
<body style="margin:0;background:#faf6f1;color:#2b2128;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(email.preview)}</div>
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
${htmlBody(body, email.step, ctx)}
<hr style="border:none;border-top:1px solid #e4d9cf;margin:28px 0 16px">
<p style="font-size:13px;color:#6d6268"><a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#6d6268">Unsubscribe with one click</a><br>${escapeHtml(imprint)}</p>
</div></body></html>`;

  return { subject: email.subject, text, html };
}

/**
 * The next step due for a sign-up, or null. One email per run: if the daily
 * job missed a day, the sequence picks up where it left off rather than
 * sending two at once.
 */
export function dueStep(
  signup: {
    consentedAt: string;
    unsubscribedAt: string | null;
    welcomeSent: number;
    welcomeLastSentAt: string | null;
  },
  emails: WelcomeEmail[],
  now: Date,
): number | null {
  if (signup.unsubscribedAt) return null;
  const next = emails.find((e) => e.step === signup.welcomeSent + 1);
  if (!next) return null;
  const dueAt = Date.parse(signup.consentedAt) + next.day * 86_400_000;
  if (now.getTime() < dueAt) return null;
  // At least 20 hours between emails, whatever the schedule says.
  if (
    signup.welcomeLastSentAt &&
    now.getTime() - Date.parse(signup.welcomeLastSentAt) < 20 * 3_600_000
  )
    return null;
  return next.step;
}
