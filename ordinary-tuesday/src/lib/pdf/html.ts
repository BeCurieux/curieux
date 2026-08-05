// Book → HTML for print rendering.
//
// One PDF, in Prodigi's page order (brief §16):
//   page 1            front cover
//   pages 2..n-1      interior, page 2 falling on the right
//   page n            back cover
//
// Interior pages are supplied at EXACT TRIM. Prodigi generates bleed and crop
// marks itself; adding our own would mis-trim every page. Margins mirror so
// the inner edge always clears the PUR gutter, and nothing important ever
// crosses the spine — pages may relate to one another, but no image is
// designed as a double-page spread.

import {
  FORMAT, TRIM_H_IN, TRIM_W_IN, isRightHandPage, pageMarginsMm, mm,
} from "@/lib/book/format";
import type { ArchetypeId } from "@/lib/book/templates";
import type { AgeColour } from "@/lib/book/colours";

export interface RenderBlock {
  type: "text" | "photo" | "quote" | "heading" | "caption" | "label" | "annotation";
  content: string;   // text, or an image URL for photo blocks
}

export interface ListenMark {
  qrDataUri: string;
  label: string;
}

export interface RenderPage {
  /** 1-based interior page number; 1 falls on the right. */
  pageNumber: number;
  archetype: ArchetypeId;
  blocks: RenderBlock[];
  listen?: ListenMark;
  /** Suppress the folio on chapter openers and full-page photographs. */
  hideFolio?: boolean;
}

export interface RenderCover {
  childName: string;
  ageWord: string;     // TWO
  year: string;        // 2028
  imprint: string;
  colour: AgeColour;
  /** Queried from the provider — never computed locally. */
  spineWidthMm: number;
}

export interface RenderBook {
  cover: RenderCover;
  pages: RenderPage[];
}

export type RenderTarget = "digital" | "print";

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Type system (brief §8): exactly two families.
 * Both stacks resolve to faces licensed for commercial embedding — the serif
 * to a Palatino/Iowan-class oldstyle, the sans to a neutral grotesque.
 * Preflight verifies embedding; nothing here may fall back silently to a
 * webfont, because there is no network at render time.
 */
const SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
const SANS = `"Helvetica Neue", Helvetica, Arial, sans-serif`;

export function renderBookHtml(book: RenderBook, target: RenderTarget): string {
  const w = TRIM_W_IN, h = TRIM_H_IN;
  const interior = book.pages.map((p) => renderInterior(p, target)).join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: ${w}in ${h}in; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#fff; }
  /* The volume colour runs through the interior, not just the cover:
     labels, rules, and reversed-out chapter openers. */
  :root { --accent:${book.cover.colour.hex}; --accent-ink:${book.cover.colour.inkHex}; }
  body { font-family:${SERIF}; color:#191A17; -webkit-font-smoothing:antialiased; }

  .page { width:${w}in; height:${h}in; page-break-after:always;
          position:relative; overflow:hidden; background:#fff; }
  .content { position:absolute; display:flex; flex-direction:column; }

  /* Scale contrast is what makes a page feel published rather than filled.
     A chapter title and its label differ by an order of magnitude. */
  /* Tight leading is what display type wants, but line boxes shorter than
     the glyphs clip descenders — so the box carries the overhang. */
  h1 { font-size:82pt; font-weight:400; line-height:0.92; letter-spacing:-0.035em;
       padding-bottom:0.1em; overflow-wrap:break-word; }
  h2 { font-size:46pt; font-weight:400; line-height:0.98; letter-spacing:-0.028em;
       padding-bottom:0.08em; overflow-wrap:break-word; }
  h3 { font-size:19pt; font-weight:400; line-height:1.2; letter-spacing:-0.012em; }
  p  { font-size:11.5pt; line-height:1.78; }

  .photo { width:100%; height:100%; object-fit:cover; display:block; }
  .full-bleed img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

  .caption { font-family:${SANS}; font-size:8.5pt; line-height:1.5;
             letter-spacing:0.015em; color:#7A7D77; margin-top:${mm(3)}in; max-width:34em; }
  .label { font-family:${SANS}; font-size:7pt; text-transform:uppercase;
           letter-spacing:0.22em; color:var(--accent); }
  .annotation { font-family:${SANS}; font-size:8pt; letter-spacing:0.02em; color:#7A7D77; }

  /* A quote page is meant to stop you. It carries the page alone. */
  .quote { font-size:54pt; line-height:1.12; letter-spacing:-0.03em;
           font-style:normal; max-width:11em; padding-bottom:0.06em;
           overflow-wrap:break-word; }
  .opener-note { margin-top:${mm(8)}in; max-width:26em; font-size:11.5pt;
                 line-height:1.7; color:#4E5558; }

  .centered { display:flex; flex-direction:column; justify-content:center;
              align-items:center; height:100%; text-align:center; }
  .bottom { margin-top:auto; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:${mm(6)}in; flex:1; min-height:0; }
  .grid-3 { display:grid; grid-template-columns:2fr 1fr; grid-template-rows:1fr 1fr;
            gap:${mm(6)}in; flex:1; min-height:0; }
  .grid-3 > :first-child { grid-row:span 2; }
  .grid-4 { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;
            gap:${mm(6)}in; flex:1; min-height:0; }
  .col { display:flex; flex-direction:column; justify-content:center; }
  .col p + p { margin-top:${mm(4)}in; }

  /* An intimate-tier photograph is placed small on purpose, with the white
     space doing the work. Never enlarged to fill the frame. */
  .intimate { width:46%; align-self:flex-start; }

  .lt-grid { display:grid; grid-template-columns:1fr 1fr;
             gap:${mm(9)}in ${mm(10)}in; align-content:start; }
  .lt-label { font-family:${SANS}; font-size:7pt; text-transform:uppercase;
              letter-spacing:0.22em; color:var(--accent); margin-bottom:${mm(2)}in; }
  .lt-value { font-size:17pt; line-height:1.3; letter-spacing:-0.01em; }

  .folio { position:absolute; bottom:${mm(8)}in; font-family:${SANS};
           font-size:7.5pt; letter-spacing:0.12em; color:#9DA09A; }
  .folio.right { right:${FORMAT.outerMarginMm}mm; }
  .folio.left  { left:${FORMAT.outerMarginMm}mm; }

  /* A photograph that runs off the outer edge gives the page a direction.
     Always the OUTER edge — the gutter side stays clean. */
  .bleed-out { position:absolute; top:0; bottom:0; width:62%; }
  .bleed-out img { width:100%; height:100%; object-fit:cover; display:block; }
  .bleed-out.to-right { right:0; }
  .bleed-out.to-left  { left:0; }

  /* Text hung on a column rather than centred, so pages have tension. */
  .hang { max-width:23em; }
  .low  { margin-top:auto; }
  .high { margin-bottom:auto; }

  /* Chapter openers reverse out in the volume's colour, tying the interior
     to the cover without a single decorative element. */
  .opener-page { background:var(--accent); color:var(--accent-ink); }
  .opener-page .label { color:var(--accent-ink); opacity:0.62; }
  .opener-page .opener-note { color:var(--accent-ink); opacity:0.78; }

  .rule { height:1px; background:var(--accent); width:${mm(28)}in; }

  .listen { position:absolute; display:flex; align-items:center; gap:${mm(2)}in; }
  .listen img { width:${mm(16)}in; height:${mm(16)}in; display:block; }
  .listen .listen-label { font-family:${SANS}; font-size:6.5pt; letter-spacing:0.08em;
    text-transform:uppercase; color:#78716c; writing-mode:vertical-rl; transform:rotate(180deg); }
</style></head><body>
${renderFrontCover(book.cover)}
${interior}
${renderBackCover(book.cover)}
</body></html>`;
}

/**
 * The cover is typographic (brief §4). The child's name is the hero; there is
 * never a photograph on the front. Solid field, enormous negative space, and
 * a restrained mark — celebrating what matte lamination genuinely does well
 * rather than imitating foil and embossing it cannot do.
 */
function renderFrontCover(c: RenderCover): string {
  const m = FORMAT.outerMarginMm;
  return `<div class="page" data-cover="front"
    style="background:${c.colour.hex};color:${c.colour.inkHex}">
  <div class="content" style="inset:${m + 8}mm ${m}mm ${m}mm ${m}mm">
    <div style="font-size:46pt;line-height:1;letter-spacing:0.01em;text-transform:uppercase">
      ${esc(c.childName)}
    </div>
    <div style="margin-top:${mm(14)}in;font-size:96pt;line-height:0.86;
                letter-spacing:-0.02em;text-transform:uppercase">
      ${esc(c.ageWord)}
    </div>
    <div class="bottom" style="display:flex;justify-content:space-between;align-items:flex-end">
      <span style="font-family:${SANS};font-size:9pt;letter-spacing:0.24em">${esc(c.year)}</span>
      <span style="font-family:${SANS};font-size:7.5pt;letter-spacing:0.3em;text-transform:uppercase;opacity:0.7">
        ${esc(c.imprint)}
      </span>
    </div>
  </div>
</div>`;
}

function renderBackCover(c: RenderCover): string {
  const m = FORMAT.outerMarginMm;
  return `<div class="page" data-cover="back"
    style="background:${c.colour.hex};color:${c.colour.inkHex}">
  <div class="content" style="inset:${m}mm">
    <div class="bottom" style="display:flex;justify-content:space-between;align-items:flex-end">
      <span style="font-family:${SANS};font-size:7.5pt;letter-spacing:0.3em;text-transform:uppercase;opacity:0.7">
        ${esc(c.imprint)}
      </span>
      <span style="font-family:${SANS};font-size:8pt;letter-spacing:0.1em;opacity:0.55">
        A year of ${esc(c.childName)}
      </span>
    </div>
  </div>
</div>`;
}

function renderInterior(page: RenderPage, target: RenderTarget): string {
  const right = isRightHandPage(page.pageNumber);
  const mgn = pageMarginsMm(page.pageNumber);
  const inset = `${mgn.top}mm ${mgn.right}mm ${mgn.bottom}mm ${mgn.left}mm`;

  const photos = page.blocks.filter((b) => b.type === "photo");
  const heading = page.blocks.find((b) => b.type === "heading");
  const texts = page.blocks.filter((b) => b.type === "text");
  const captions = page.blocks.filter((b) => b.type === "caption");
  const quotes = page.blocks.filter((b) => b.type === "quote");
  const labels = page.blocks.filter((b) => b.type === "label");
  const annotations = page.blocks.filter((b) => b.type === "annotation");

  const img = (b: RenderBlock, cls = "photo") =>
    `<img class="${cls}" src="${esc(b.content)}">`;
  const cap = (list: RenderBlock[]) =>
    list.length ? `<div class="caption">${list.map((c) => esc(c.content)).join(" · ")}</div>` : "";

  let inner: string;
  switch (page.archetype) {
    case "hero_photograph":
      // The only layout that reaches the trim edge. Prodigi adds the bleed.
      inner = photos[0] ? `<div class="full-bleed">${img(photos[0])}</div>` : "";
      break;

    case "chapter_opener":
      // Reversed out of the volume colour, title enormous, hung low. The
      // drama is scale and space — nothing is added to decorate it.
      inner = `<div class="content" style="inset:${inset}">
        ${labels[0] ? `<div class="label">${esc(labels[0].content)}</div>` : ""}
        <div class="low">
          ${heading ? `<h1>${esc(heading.content)}</h1>` : ""}
          ${texts[0] ? `<p class="opener-note hang">${esc(texts[0].content)}</p>` : ""}
        </div>
      </div>`;
      break;

    case "quote_page":
      // Set large and hung off the top third, not centred. Centring makes a
      // quote look like a greetings card; hanging it makes it a statement.
      inner = `<div class="content" style="inset:${inset}">
        <div style="margin-top:18%">
          ${quotes.map((q) => `<div class="quote">${esc(q.content)}</div>`).join("")}
        </div>
        ${annotations[0]
          ? `<div class="low"><div class="rule" style="margin-bottom:${mm(4)}in"></div>` +
            `<div class="annotation">${esc(annotations[0].content)}</div></div>`
          : ""}
      </div>`;
      break;

    case "portrait_plus_story": {
      // The photograph runs off the outer edge; the story sits against the
      // gutter side with air above it. Asymmetry gives the page a direction.
      const side = right ? "to-right" : "to-left";
      const textInset = right
        ? `${mgn.top}mm auto ${mgn.bottom}mm ${mgn.left}mm`
        : `${mgn.top}mm ${mgn.right}mm ${mgn.bottom}mm auto`;
      inner =
        (photos[0] ? `<div class="bleed-out ${side}">${img(photos[0])}</div>` : "") +
        `<div class="content" style="inset:${textInset};width:34%">
          <div class="low">
            ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
            ${cap(captions)}
          </div>
        </div>`;
      break;
    }

    case "object_portrait":
      // Deliberately small. A poor but important photograph earns its place
      // through white space and story, never through enlargement (§14).
      inner = `<div class="content" style="inset:${inset}">
        <div style="width:38%;margin-left:${right ? "auto" : "0"}">
          ${photos[0] ? img(photos[0], "photo intimate") : ""}
          ${cap(captions)}
        </div>
        <div class="low hang">
          ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
        </div>
      </div>`;
      break;

    case "two_photo_sequence":
      inner = `<div class="content" style="inset:${inset}">
        <div class="grid-2">${photos.slice(0, 2).map((p) => img(p)).join("")}</div>
        ${cap(captions)}
      </div>`;
      break;

    case "then_now":
      inner = `<div class="content" style="inset:${inset}">
        <div class="grid-2">${photos.slice(0, 2).map((p) => img(p)).join("")}</div>
        <div style="display:flex;justify-content:space-between;margin-top:${mm(3)}in">
          ${(captions.length ? captions : annotations).slice(0, 2)
            .map((c) => `<span class="annotation">${esc(c.content)}</span>`).join("")}
        </div>
      </div>`;
      break;

    case "three_photo_sequence":
      inner = `<div class="content" style="inset:${inset}">
        <div class="grid-3">${photos.slice(0, 3).map((p) => img(p)).join("")}</div>
        ${cap(captions)}
      </div>`;
      break;

    case "ordinary_days":
      inner = `<div class="content" style="inset:${inset}">
        ${heading ? `<h2 style="margin-bottom:${mm(6)}in">${esc(heading.content)}</h2>` : ""}
        <div class="grid-4">${photos.slice(0, 4).map((p) => img(p)).join("")}</div>
        ${cap(captions)}
      </div>`;
      break;

    case "people_page":
      inner = `<div class="content" style="inset:${inset}">
        ${labels[0] ? `<div class="label">${esc(labels[0].content)}</div>` : ""}
        ${heading ? `<h2 style="margin-top:${mm(4)}in">${esc(heading.content)}</h2>` : ""}
        ${photos[0] ? `<div style="height:46%;margin-top:${mm(10)}in">${img(photos[0])}</div>` : ""}
        ${cap(captions)}
        <div class="low hang" style="padding-top:${mm(8)}in">
          ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
        </div>
      </div>`;
      break;

    case "little_things":
      inner = `<div class="content" style="inset:${inset}">
        ${heading ? `<h2 style="margin-bottom:${mm(12)}in">${esc(heading.content)}</h2>` : ""}
        <div class="lt-grid">${texts.map((t) => {
          const [label, ...rest] = t.content.split(":");
          const value = rest.join(":").trim();
          return `<div><div class="lt-label">${esc(label)}</div>` +
                 `<div class="lt-value">${esc(value || label)}</div></div>`;
        }).join("")}</div>
      </div>`;
      break;

    case "closing_page":
      inner = `<div class="content" style="inset:${inset}">
        ${photos[0] ? `<div style="height:44%">${img(photos[0])}</div>` : ""}
        <div class="low">
          ${heading ? `<h2 style="margin-bottom:${mm(7)}in">${esc(heading.content)}</h2>` : ""}
          <div class="hang">${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}</div>
          ${annotations[0] ? `<div class="annotation" style="margin-top:${mm(8)}in">${esc(annotations[0].content)}</div>` : ""}
        </div>
      </div>`;
      break;

    default:
      inner = `<div class="content" style="inset:${inset}">
        ${photos[0] ? `<div style="height:78%">${img(photos[0])}</div>` : ""}
        ${cap(captions)}
      </div>`;
  }

  const folio = page.hideFolio
    ? ""
    : `<div class="folio ${right ? "right" : "left"}">${page.pageNumber}</div>`;

  // The listen mark sits on the outer edge, clear of the gutter.
  const listen = page.listen
    ? `<div class="listen" style="bottom:${mgn.bottom}mm;${right ? `right:${mgn.right}mm` : `left:${mgn.left}mm`}">` +
      `<img src="${esc(page.listen.qrDataUri)}" alt="">` +
      `<span class="listen-label">${esc(page.listen.label)}</span></div>`
    : "";

  const reversed = page.archetype === "chapter_opener" ? " opener-page" : "";
  return `<div class="page${reversed}" data-page="${page.pageNumber}" data-side="${right ? "right" : "left"}">${inner}${folio}${listen}</div>`;
}
