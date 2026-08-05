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
  body { font-family:${SERIF}; color:#191A17; -webkit-font-smoothing:antialiased; }

  .page { width:${w}in; height:${h}in; page-break-after:always;
          position:relative; overflow:hidden; background:#fff; }
  .content { position:absolute; display:flex; flex-direction:column; }

  h1 { font-size:38pt; font-weight:400; line-height:1.04; letter-spacing:-0.02em; }
  h2 { font-size:25pt; font-weight:400; line-height:1.12; letter-spacing:-0.015em; }
  p  { font-size:11.5pt; line-height:1.72; }

  .photo { width:100%; height:100%; object-fit:cover; display:block; }
  .full-bleed img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

  .caption { font-family:${SANS}; font-size:8.5pt; line-height:1.5;
             letter-spacing:0.015em; color:#7A7D77; margin-top:${mm(3)}in; max-width:34em; }
  .label { font-family:${SANS}; font-size:7pt; text-transform:uppercase;
           letter-spacing:0.15em; color:#B87F0C; }
  .annotation { font-family:${SANS}; font-size:8pt; letter-spacing:0.02em; color:#7A7D77; }

  .quote { font-size:26pt; line-height:1.36; font-style:italic; max-width:17em; }
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
              letter-spacing:0.15em; color:#B87F0C; margin-bottom:${mm(1.5)}in; }
  .lt-value { font-size:13pt; line-height:1.4; }

  .folio { position:absolute; bottom:${mm(8)}in; font-family:${SANS};
           font-size:7.5pt; letter-spacing:0.12em; color:#9DA09A; }
  .folio.right { right:${FORMAT.outerMarginMm}mm; }
  .folio.left  { left:${FORMAT.outerMarginMm}mm; }

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
      inner = `<div class="content" style="inset:${inset}"><div style="margin-top:32%">
        ${labels[0] ? `<div class="label">${esc(labels[0].content)}</div>` : ""}
        ${heading ? `<h1 style="margin-top:${mm(6)}in">${esc(heading.content)}</h1>` : ""}
        ${texts[0] ? `<p class="opener-note">${esc(texts[0].content)}</p>` : ""}
      </div></div>`;
      break;

    case "quote_page":
      inner = `<div class="content" style="inset:${inset}"><div class="centered">
        ${quotes.map((q) => `<div class="quote">&ldquo;${esc(q.content)}&rdquo;</div>`).join("")}
        ${annotations[0] ? `<div class="annotation" style="margin-top:${mm(10)}in">${esc(annotations[0].content)}</div>` : ""}
      </div></div>`;
      break;

    case "portrait_plus_story":
      inner = `<div class="content" style="inset:${inset}">
        ${photos[0] ? `<div style="height:60%">${img(photos[0])}</div>` : ""}
        ${cap(captions)}
        <div class="col" style="flex:1;padding-top:${mm(8)}in">
          ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
        </div>
      </div>`;
      break;

    case "object_portrait":
      // Deliberately small. A poor but important photograph earns its place
      // through white space and story, never through enlargement (§14).
      inner = `<div class="content" style="inset:${inset}">
        <div style="margin-top:12%">
          ${photos[0] ? img(photos[0], "photo intimate") : ""}
          ${cap(captions)}
        </div>
        <div class="col" style="flex:1;max-width:24em">
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
        ${heading ? `<h2 style="margin-top:${mm(3)}in;margin-bottom:${mm(8)}in">${esc(heading.content)}</h2>` : ""}
        ${photos[0] ? `<div style="height:52%">${img(photos[0])}</div>` : ""}
        ${cap(captions)}
        <div class="col" style="flex:1;padding-top:${mm(6)}in;max-width:26em">
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
        ${photos[0] ? `<div style="height:50%">${img(photos[0])}</div>` : ""}
        <div class="col" style="flex:1;padding-top:${mm(10)}in;max-width:26em">
          ${heading ? `<h2 style="margin-bottom:${mm(5)}in">${esc(heading.content)}</h2>` : ""}
          ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
        </div>
        ${annotations[0] ? `<div class="annotation bottom">${esc(annotations[0].content)}</div>` : ""}
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

  return `<div class="page" data-page="${page.pageNumber}" data-side="${right ? "right" : "left"}">${inner}${folio}${listen}</div>`;
}
