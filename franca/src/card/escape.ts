/**
 * Escaping, which is not a formality here.
 *
 * Everything the card renders is somebody else's marketing copy, fetched from
 * a page we do not control, and the result is a file the founder sends to a
 * stranger and later a page served from our own domain. A product page with a
 * script tag in an alt attribute is not a hypothetical; scraped copy is
 * hostile input by default.
 *
 * So the renderers take strings and never markup, and every value that reaches
 * a template goes through one of these. There is no "insert this as HTML"
 * escape hatch in this module and there should never be one.
 */

const HTML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** For element content and double-quoted attribute values alike. */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML[char] ?? char);
}

/**
 * SVG is XML, so the same five characters — plus the control characters that
 * make a document unparseable rather than merely wrong. Tab, newline and
 * carriage return survive; nothing else below U+0020 does.
 */
export function escXml(value: string): string {
  return esc(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** Belt and braces for a URL that will sit in an href. */
export function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : undefined;
}
