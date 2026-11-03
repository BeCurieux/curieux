import { readFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@react-email/components";
import { EmailLayout } from "@emails/layout";
import { splitFrontmatter } from "@/lib/content/load";
import { fillTokens } from "@/lib/pages/content";

// Every email the platform sends (SPEC.md → Email). Words from
// content/emails/<id>.md; the layout from /emails.

export const TEMPLATES = [
  "lead_welcome",
  "nudge_1",
  "nudge_2",
  "nudge_3",
  "receipt",
  "onboarding_1",
  "onboarding_2",
  "onboarding_3",
  "onboarding_4",
  "onboarding_5",
  "founding_welcome",
  "refund",
  "verdict_meaning",
  "review_ready",
] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export interface EmailTemplate {
  id: TemplateId;
  subject: string;
  preview: string;
  kind: "transactional" | "marketing";
  draft: boolean;
  button?: { label: string; url: string };
  nextSteps: Record<string, string>;
  body: string;
}

const ROOT = path.join(process.cwd(), "content", "emails");

export async function loadTemplate(id: TemplateId): Promise<EmailTemplate> {
  const { data, body } = splitFrontmatter(await readFile(path.join(ROOT, `${id}.md`), "utf8"));
  const meta = (data ?? {}) as Record<string, unknown>;
  if (!meta.subject) throw new Error(`content/emails/${id}.md: no subject`);
  return {
    id,
    subject: String(meta.subject),
    preview: String(meta.preview ?? ""),
    kind: meta.kind === "marketing" ? "marketing" : "transactional",
    draft: meta.draft === true,
    button:
      meta.button && meta.button_url
        ? { label: String(meta.button), url: String(meta.button_url) }
        : undefined,
    nextSteps: (meta.next_steps ?? {}) as Record<string, string>,
    body: body.trim(),
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  kind: EmailTemplate["kind"];
}

/** Fills the tokens and renders HTML and plain text. */
export async function renderEmail(
  template: EmailTemplate,
  vars: Record<string, string>,
  options: { appUrl: string; unsubscribeUrl?: string },
): Promise<RenderedEmail> {
  const fill = (text: string) => fillTokens(text, vars);
  const element = EmailLayout({
    preview: fill(template.preview),
    markdown: fill(template.body),
    button: template.button
      ? { label: fill(template.button.label), url: fill(template.button.url) }
      : undefined,
    unsubscribeUrl: template.kind === "marketing" ? options.unsubscribeUrl : undefined,
    appUrl: options.appUrl,
  });
  return {
    subject: fill(template.subject),
    html: await render(element),
    text: await render(element, { plainText: true }),
    kind: template.kind,
  };
}
