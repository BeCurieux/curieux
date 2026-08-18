/**
 * HTML to the words a shopper reads. No parser, on purpose.
 *
 * The engine's portability is a real property — it runs with `zod` and nothing
 * else, on a laptop with no accounts — and a DOM library is a large dependency
 * to take on for a job that is mostly "delete the parts nobody reads". The
 * highest-value paths do not need one anyway: a Shopify product endpoint and a
 * JSON-LD block are both JSON, and what they hand back is a small fragment of
 * HTML rather than a document.
 *
 * So this is careful string work with tests around the cases that actually
 * break it: nested boilerplate, entities, block elements that need a newline,
 * and a `</script>` inside a string inside a script.
 *
 * The bias throughout is to keep too much rather than too little. A stray
 * shipping table in the scanned text costs a false positive the founder can
 * see and dismiss; a silently dropped sustainability paragraph costs a finding
 * nobody knows is missing.
 */

/** Elements whose content is never product copy. Removed with their contents. */
const DROP_WHOLE = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "select",
  "option",
];

/**
 * Elements that are usually chrome. Removed with their contents, but only at
 * the outer level — `header` inside an article is a heading, not a masthead,
 * and this cannot tell the difference, so the list stays short and obvious.
 */
const DROP_CHROME = ["nav", "footer", "form"];

/**
 * Vertical space, in the two sizes HTML actually means.
 *
 * Everything gets at least a newline, so two blocks of text never fuse into
 * one sentence — "Firms skinBrightens" is a claim neither rule can read. The
 * paragraph-ish closers get two, so a fetched page keeps the shape a reader
 * saw: a bulleted list stays tight, and paragraphs stay apart. `tidy` then
 * collapses anything longer.
 */
const BLOCK_BREAK =
  /<\/?(p|div|section|article|main|aside|header|footer|nav|ul|ol|dl|table|blockquote|pre|figure)\b[^>]*>|<hr\b[^>]*>/gi;
const LINE_BREAK =
  /<\/?(li|dt|dd|thead|tbody|tr|td|th|h[1-6]|figcaption)\b[^>]*>|<br\b[^>]*>/gi;

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
  trade: "™",
  reg: "®",
  copy: "©",
  deg: "°",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
  bull: "•",
  middot: "·",
  times: "×",
  frac12: "½",
  euro: "€",
  pound: "£",
  cent: "¢",
  sup2: "²",
  micro: "µ",
};

/**
 * Entities matter more here than they look. "&amp;" left undecoded is cosmetic,
 * but a non-breaking space left as `&nbsp;` breaks a phrase match down the
 * middle, and "carbon&nbsp;neutral" is exactly the phrase that must not slip
 * through because of a character nobody can see.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]{1,31});/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const codePoint = body[1]?.toLowerCase() === "x"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return whole;
      }
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Remove an element and everything inside it, however deeply it nests. */
function dropElements(html: string, tags: string[]): string {
  let out = html;
  for (const tag of tags) {
    // Non-greedy to the *first* matching close tag. A `</script>` inside a JS
    // string ends the block early, which is what a browser does too — and
    // erring towards dropping less of the document than more.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "\n");
    // Self-closing or unclosed: drop the tag, keep whatever followed it.
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "\n");
  }
  return out;
}

function breakBlocks(html: string): string {
  return (
    html
      .replace(BLOCK_BREAK, "\n\n")
      .replace(LINE_BREAK, "\n")
      // Source whitespace sits between the newlines the tags just produced —
      // `</li>\n  <li>` — so the runs have to be closed up before they can be
      // counted.
      .replace(/[ \t\u00a0]*\n[ \t\u00a0]*/g, "\n")
      // A closing tag and the opening tag beside it each contributed. Two
      // newlines therefore mean one line break between list items; four mean a
      // paragraph boundary. Halving in that order keeps both.
      .replace(/\n{2}/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
  );
}

/** Collapse to at most one blank line, trim every line, trim the whole. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t    ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A fragment — a product `body_html`, a JSON-LD description — to text.
 * No chrome stripping: a fragment has none, and stripping would only risk
 * eating a `<footer>` somebody used as a styling hook.
 */
export function fragmentToText(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const withoutDrops = dropElements(withoutComments, DROP_WHOLE);
  return tidy(decodeEntities(breakBlocks(withoutDrops).replace(/<[^>]*>/g, "")));
}

/** A whole page to text, chrome removed. */
export function htmlToText(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const withoutDrops = dropElements(withoutComments, [...DROP_WHOLE, ...DROP_CHROME]);
  return tidy(decodeEntities(breakBlocks(withoutDrops).replace(/<[^>]*>/g, "")));
}

/**
 * The `<main>` element, or the largest `<article>`, if the page has one.
 *
 * A well-built PDP marks its content and this halves the boilerplate. A page
 * that does not gets the whole body, which is noisier but never emptier.
 */
export function mainRegion(html: string): string | null {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(html);
  if (main?.[1] && main[1].trim().length > 200) return main[1];

  let largest: string | null = null;
  for (const match of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/gi)) {
    const body = match[1] ?? "";
    if (!largest || body.length > largest.length) largest = body;
  }
  return largest && largest.trim().length > 200 ? largest : null;
}

export function titleOf(html: string): string | undefined {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  return title ? tidy(decodeEntities(title.replace(/<[^>]*>/g, ""))) || undefined : undefined;
}

/** Every JSON-LD block on the page that parses. Ones that do not are skipped. */
export function jsonLdBlocks(html: string): unknown[] {
  const found: unknown[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    const body = match[1];
    if (!body) continue;
    try {
      found.push(JSON.parse(body));
    } catch {
      // A malformed block is common and is not worth a failed scan.
    }
  }
  return found;
}

type Jsonish = Record<string, unknown>;
const isObject = (value: unknown): value is Jsonish => typeof value === "object" && value !== null;

/** Walk `@graph`, arrays and nesting to find the Product node, if there is one. */
export function findProduct(blocks: unknown[]): Jsonish | undefined {
  const queue: unknown[] = [...blocks];
  while (queue.length > 0) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (!isObject(node)) continue;
    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((t) => typeof t === "string" && t.toLowerCase() === "product")) return node;
    if (Array.isArray(node["@graph"])) queue.push(...node["@graph"]);
  }
  return undefined;
}
