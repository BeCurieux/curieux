/**
 * Untrusted text handling (§50).
 *
 * Two distinct sources of text we did not write:
 *  - customers (check-in notes, "absolutely not", feedback)
 *  - third parties (provider place names, addresses, website text)
 *
 * Both are data. Neither is ever an instruction to a model, and neither is
 * ever rendered as markup. The rule stated in the brief is unambiguous: place
 * descriptions and external content must never become AI instructions.
 */

/** Patterns that look like attempts to address the model rather than describe a place. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |the |any )?(previous|prior|above)/gi,
  /disregard (all |the |any )?(previous|prior|above)/gi,
  /system prompt/gi,
  /\byou are now\b/gi,
  /\bnew instructions?\b/gi,
  /\bassistant:\s/gi,
  /\bsystem:\s/gi,
  /<\/?(system|assistant|user|untrusted)>/gi,
];

/** Control characters, which have no business in a venue name or a note. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Prepare text for inclusion in a prompt. Strips the delimiters we use to
 * fence untrusted content, neutralises obvious instruction-injection phrasing,
 * collapses whitespace and truncates.
 *
 * This is defence in depth, not the primary control: the primary control is
 * that untrusted text is always wrapped in <untrusted> tags and the system
 * prompt tells the model that such content is never an instruction.
 */
export function sanitiseUserText(input: string, maxLength = 1000): string {
  let text = input.replace(CONTROL_CHARS, " ").replace(/[<>]/g, " ");

  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "[removed]");
  }

  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/**
 * Provider-supplied strings (venue names, addresses) that will be shown to a
 * customer and passed to a model. Names are short and structural, so this is
 * stricter than the user-text path.
 */
export function sanitiseProviderText(input: string, maxLength = 200): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate a redirect target before we send a browser to it (§50). Only
 * same-origin paths are permitted; anything absolute, protocol-relative or
 * containing a backslash is refused.
 */
export function safeRedirectPath(input: string | null | undefined, fallback = "/app"): string {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;
  if (input.includes("\\")) return fallback;
  if (/^\/+\s*https?:/i.test(input)) return fallback;
  return input;
}

/**
 * Only allow links we would be comfortable a customer clicking from an email:
 * https, and no credentials embedded in the URL.
 */
export function safeExternalUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
