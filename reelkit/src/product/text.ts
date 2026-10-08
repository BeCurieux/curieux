/**
 * HTML to plain text, and the entity decoding both halves need.
 *
 * Product descriptions arrive as HTML (Shopify's `body_html`), as entity-laden
 * text (Etsy titles regularly carry `&#39;`), or inside JSON-LD. All of it ends
 * up on a video frame, where a literal `&amp;` is the first thing a seller sees.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  times: "×",
  pound: "£",
  euro: "€",
  cent: "¢",
  yen: "¥",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      // A malformed or out-of-range code point is left as written rather
      // than thrown on: one bad entity should not lose a whole description.
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

const BLOCK =
  /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|blockquote|header|footer)\b[^>]*>/gi;

export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/li\s*>/gi, "")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(BLOCK, "\n")
    .replace(/<[^>]+>/g, " ");
  return tidy(decodeEntities(text));
}

/** Collapse runs of spaces, keep paragraph breaks, trim every line. */
export function tidy(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd() + "…";
}
