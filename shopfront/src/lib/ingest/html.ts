/**
 * Shallow HTML extraction, without a DOM.
 *
 * Everything we want from a homepage sits at the surface: meta tags, link
 * tags, JSON-LD script bodies, headings, anchors, style blocks. None of it
 * needs a tree — no descendant selectors, no ancestor questions — so a parser
 * would buy robustness we do not use at the cost of a dependency in the one
 * package that will end up running inside a serverless function.
 *
 * The line to hold: if a helper here ever needs to know what *contains* what,
 * that is the moment to stop and add a real parser rather than write a
 * cleverer regex.
 */

export interface MetaTags {
  /** Keyed by lowercased `name` or `property`. Last one wins, as browsers do. */
  get(key: string): string | undefined;
  /** First non-empty value among the keys, in order. */
  first(...keys: string[]): string | undefined;
}

const TAG = /<([a-z][a-z0-9-]*)\b([^>]*)>/gi;

/** Attributes off a raw tag body: `name="x" content='y' hidden`. */
export function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([a-z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const key = match[1]?.toLowerCase();
    if (!key) continue;
    attributes[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function* tags(html: string, name: string): Generator<Record<string, string>> {
  const wanted = name.toLowerCase();
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(html))) {
    if (match[1]?.toLowerCase() !== wanted) continue;
    yield parseAttributes(match[2] ?? "");
  }
}

export function extractMeta(html: string): MetaTags {
  const values = new Map<string, string>();
  for (const attributes of tags(html, "meta")) {
    const key = (attributes["property"] ?? attributes["name"] ?? attributes["itemprop"] ?? "").toLowerCase();
    const content = attributes["content"];
    if (key && content) values.set(key, content.trim());
  }
  return {
    get: (key) => values.get(key.toLowerCase()) || undefined,
    first: (...keys) => {
      for (const key of keys) {
        const value = values.get(key.toLowerCase());
        if (value) return value;
      }
      return undefined;
    },
  };
}

export function extractLinks(html: string): Record<string, string>[] {
  return [...tags(html, "link")];
}

export function extractImages(html: string): Record<string, string>[] {
  return [...tags(html, "img")];
}

export function extractScriptSrcs(html: string): string[] {
  return [...tags(html, "script")].map((a) => a["src"]).filter((s): s is string => Boolean(s));
}

export function extractTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match?.[1] ? collapse(decodeEntities(stripTags(match[1]))) : "";
  return title || undefined;
}

export function extractHtmlLang(html: string): string | undefined {
  const match = /<html\b([^>]*)>/i.exec(html);
  if (!match?.[1]) return undefined;
  const lang = parseAttributes(match[1])["lang"];
  return lang?.trim() || undefined;
}

/**
 * JSON-LD blocks, `@graph` flattened out and unparseable ones dropped.
 * Storefront themes emit invalid JSON-LD often enough that one bad block must
 * not cost us the good one next to it.
 */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const type = parseAttributes(match[1] ?? "")["type"] ?? "";
    if (!type.toLowerCase().includes("ld+json")) continue;
    const body = (match[2] ?? "").trim();
    if (!body) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    for (const node of [parsed].flat()) {
      if (node && typeof node === "object" && "@graph" in node) {
        const graph = (node as { "@graph": unknown })["@graph"];
        if (Array.isArray(graph)) {
          out.push(...graph);
          continue;
        }
      }
      out.push(node);
    }
  }
  return out;
}

/** JSON-LD nodes whose @type matches, case-insensitively. */
export function jsonLdOfType(nodes: unknown[], ...types: string[]): Record<string, unknown>[] {
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  return nodes.filter((node): node is Record<string, unknown> => {
    if (!node || typeof node !== "object") return false;
    const type = (node as Record<string, unknown>)["@type"];
    const list = Array.isArray(type) ? type : [type];
    return list.some((t) => typeof t === "string" && wanted.has(t.toLowerCase()));
  });
}

export interface Heading {
  level: number;
  text: string;
}

export function extractHeadings(html: string): Heading[] {
  const out: Heading[] = [];
  const pattern = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const text = collapse(decodeEntities(stripTags(match[2] ?? "")));
    if (text) out.push({ level: Number(match[1]), text });
  }
  return out;
}

export interface Anchor {
  href: string;
  text: string;
}

export function extractAnchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const href = parseAttributes(match[1] ?? "")["href"];
    if (!href) continue;
    out.push({ href, text: collapse(decodeEntities(stripTags(match[2] ?? ""))) });
  }
  return out;
}

export function extractButtonLabels(html: string): string[] {
  const out: string[] = [];
  const pattern = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const text = collapse(decodeEntities(stripTags(match[1] ?? "")));
    if (text) out.push(text);
  }
  for (const attributes of tags(html, "input")) {
    const type = (attributes["type"] ?? "").toLowerCase();
    if ((type === "submit" || type === "button") && attributes["value"]) out.push(attributes["value"]);
  }
  return out;
}

export function extractStyleBlocks(html: string): string[] {
  const out: string[] = [];
  const pattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const css = match[1]?.trim();
    if (css) out.push(css);
  }
  return out;
}

export function extractStylesheetHrefs(html: string): string[] {
  return extractLinks(html)
    .filter((a) => (a["rel"] ?? "").toLowerCase().split(/\s+/).includes("stylesheet"))
    .map((a) => a["href"])
    .filter((h): h is string => Boolean(h));
}

/**
 * Body copy, in sentence-sized pieces.
 *
 * Scripts, styles, templates and SVG are removed first — a homepage's largest
 * text node by far is usually a JSON blob inside a <script>, and feeding that
 * to the merchandiser as "how this brand writes" would be worse than sending
 * nothing.
 */
export function extractProse(html: string, limit = 40): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const pattern = /<(p|li|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const out: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cleaned)) && out.length < limit) {
    const text = collapse(decodeEntities(stripTags(match[2] ?? "")));
    if (text.length < 12 || text.length > 400) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  eacute: "é",
  egrave: "è",
  amp39: "'",
};

export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);?/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Plain text from a product's `body_html`.
 *
 * Block boundaries become spaces rather than disappearing, so "…organic
 * cotton.</p><p>Made in Portugal…" does not come out as one run-on word.
 */
export function htmlToText(html: string, maxLength = 1200): string {
  const text = collapse(
    decodeEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, " ")
        .replace(/<[^>]*>/g, " "),
    ),
  );
  if (text.length <= maxLength) return text;
  // Cut at a word boundary; a description ending mid-word reads as a bug in
  // the shop rather than a truncation in the pipeline.
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
