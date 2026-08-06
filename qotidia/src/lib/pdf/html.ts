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
  FORMAT, isRightHandPage, pageMarginsMm, mm,
} from "@/lib/book/format";
import type { ArchetypeId } from "@/lib/book/templates";
import { accentForPaper, type AgeColour } from "@/lib/book/colours";

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
 *
 * Serif is Bitstream Charter — Matthew Carter designed it for printing, with
 * sturdy low-contrast strokes and open counters that survive ink spread. That
 * makes it the right face for uncoated Mohawk, which softens detail and
 * flattens contrast; a high-contrast Didone would lose its hairlines on this
 * stock. Its licence permits redistribution and embedding.
 *
 * Sans is Liberation Sans for dates, captions and metadata only.
 *
 * These must be REAL, installed faces: there is no network at render time, so
 * a missing family silently becomes Chromium's default serif and the whole
 * book quietly turns into Times.
 */
const SERIF = `Charter, "Bitstream Charter", "Charis SIL", Georgia, serif`;
const SANS = `"Liberation Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`;

export function renderBookHtml(book: RenderBook, target: RenderTarget): string {
  // Points are the PDF's native unit; giving Chromium mm or inches routes
  // through CSS pixels and lands the MediaBox at 209.89mm instead of 210.
  const w = `${(FORMAT.trimWidthMm / 25.4 * 72).toFixed(3)}pt`;
  const h = `${(FORMAT.trimHeightMm / 25.4 * 72).toFixed(3)}pt`;
  const foot = `${book.cover.childName} · ${book.cover.ageWord.toLowerCase()}`;
  const interior = book.pages.map((p) => renderInterior(p, target, foot)).join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: ${w} ${h}; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#fff; }
  /* The volume colour runs through the interior, not just the cover:
     labels, rules, and reversed-out chapter openers. */
  :root { --accent:${book.cover.colour.hex}; --accent-ink:${book.cover.colour.inkHex};
          --accent-paper:${accentForPaper(book.cover.colour)}; }
  body { font-family:${SERIF}; color:#191A17; -webkit-font-smoothing:antialiased; }

  .page { width:${w}; height:${h}; page-break-after:always;
          position:relative; overflow:hidden; background:#fff; }
  .content { position:absolute; display:flex; flex-direction:column; }

  /* Scale contrast is what makes a page feel published rather than filled.
     A chapter title and its label differ by an order of magnitude. */
  /* Tight leading is what display type wants, but line boxes shorter than
     the glyphs clip descenders — so the box carries the overhang. */
  /* Brought down from 82/46pt. That scale belonged to the earlier, louder
     identity; Qotidia's is quiet, and a headline three times the size of the
     photograph's caption already does everything scale contrast needs to. */
  h1 { font-size:48pt; font-weight:400; line-height:1.04; letter-spacing:-0.018em;
       padding-bottom:0.1em; overflow-wrap:break-word; }
  h2 { font-size:30pt; font-weight:400; line-height:1.1; letter-spacing:-0.012em;
       padding-bottom:0.08em; overflow-wrap:break-word; }
  h3 { font-size:19pt; font-weight:400; line-height:1.2; letter-spacing:-0.012em; }
  p  { font-size:11.5pt; line-height:1.78; }

  .photo { width:100%; height:100%; object-fit:cover; display:block; }
  .full-bleed img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

  .caption { font-family:${SANS}; font-size:8.5pt; line-height:1.5;
             letter-spacing:0.015em; color:#7A7D77; margin-top:${mm(3)}in; max-width:34em; }
  .label { font-family:${SANS}; font-size:7pt; text-transform:uppercase;
           letter-spacing:0.22em; color:var(--accent-paper); }
  .annotation { font-family:${SANS}; font-size:8pt; letter-spacing:0.02em; color:#7A7D77; }

  /* A quote page is meant to stop you. It carries the page alone. */
  .quote { font-size:34pt; line-height:1.28; letter-spacing:-0.008em;
           font-style:normal; max-width:16em; padding-bottom:0.06em;
           overflow-wrap:break-word; }
  /* The opener sets its own scale: quiet and centred, not the 82pt h1 the
     interior pages use for a headline sitting beside a photograph. */
  .opener-title { font-size:40pt; font-weight:400; line-height:1.12;
                  letter-spacing:-0.005em; padding-bottom:0.08em; max-width:14em; }
  .opener-rule { width:${mm(20)}in; height:0.6pt; background:currentColor;
                 opacity:0.45; margin:${mm(9)}in 0; }
  .opener-note { max-width:24em; font-size:11pt; line-height:1.7; }

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
  .intimate { width:100%; align-self:flex-start; }

  /* One column, not two. Eight short entries cannot fill an A4 spread in
     two columns without leaving craters between rows; run down the page and
     let the values carry real size. */
  .lt-grid { display:grid; grid-template-columns:1fr;
             gap:${mm(13)}in; align-content:start; max-width:30em; }
  .lt-label { font-family:${SANS}; font-size:7pt; text-transform:uppercase;
              letter-spacing:0.22em; color:var(--accent-paper); margin-bottom:${mm(2.5)}in; }
  .lt-value { font-size:22pt; line-height:1.22; letter-spacing:-0.015em; }

  .folio { position:absolute; bottom:${mm(8)}in; font-family:${SANS};
           font-size:7.5pt; letter-spacing:0.12em; color:#9DA09A; }
  .folio.right { right:${FORMAT.outerMarginMm}mm; }
  .folio.left  { left:${FORMAT.outerMarginMm}mm; }
  /* On a page whose photograph occupies the outer edge, the folio moves to
     the gutter side so it never sits on the image. */
  .folio.inner.right { right:auto; left:${FORMAT.innerMarginMm}mm; }
  .folio.inner.left  { left:auto; right:${FORMAT.innerMarginMm}mm; }

  /* A photograph that runs off the outer edge gives the page a direction.
     Always the OUTER edge — the gutter side stays clean. */
  .bleed-out { position:absolute; top:0; bottom:0; width:62%; }
  .bleed-out img { width:100%; height:100%; object-fit:cover; display:block; }
  .bleed-out.to-right { right:0; }
  .bleed-out.to-left  { left:0; }

  /* Runs off the top and the outer edge, stopping partway down the page. */
  .bleed-top { position:absolute; top:0; }
  .bleed-top img { width:100%; height:100%; object-fit:cover; display:block; }
  .bleed-top.to-right { right:0; }
  .bleed-top.to-left  { left:0; }

  /* Text hung on a column rather than centred, so pages have tension. */
  .hang { max-width:23em; }
  .low  { margin-top:auto; }
  .high { margin-bottom:auto; }

  /* Chapter openers reverse out in the volume's colour, tying the interior
     to the cover without a single decorative element. */
  .opener-page { background:var(--accent); color:var(--accent-ink); }
  .opener-page .label { color:var(--accent-ink); opacity:0.62; }
  .opener-page .opener-note { color:var(--accent-ink); opacity:0.78; }

  .rule { height:1px; background:var(--accent-paper); width:${mm(28)}in; }

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
/**
 * House style: our own typography is set lowercase — the wordmark, the cover,
 * chapter titles and section headings.
 *
 * It is applied ONLY to type we wrote. A quotation, a parent's note and any
 * transcript are left exactly as they were given to us: those are somebody's
 * words, and a house style that quietly rewrites what a two-year-old said
 * would be the same failure as inventing it.
 */
function houseCase(s: string): string {
  return s.toLowerCase();
}

function renderFrontCover(c: RenderCover): string {
  const m = FORMAT.outerMarginMm;
  // Centred, lowercase, and quiet. The name is the largest thing on it but
  // it is set at reading weight rather than shouted — the cover is meant to
  // sit on a shelf for eighteen years, not to be seen once across a shop.
  // The rules above and below the age do the work a heavier weight would.
  return `<div class="page" data-cover="front"
    style="background:${c.colour.hex};color:${c.colour.inkHex}">
  <div class="content" style="inset:${m}mm;text-align:center">
    <!-- The cluster centres inside its own flexible box. Centring it on the
         parent instead fights .bottom's margin-top:auto, which absorbs the
         free space and pushes everything to the top of the cover. -->
    <div style="flex:1;display:flex;flex-direction:column;
                align-items:center;justify-content:center">
      <div style="font-size:36pt;line-height:1.1;letter-spacing:0.005em">
        ${esc(houseCase(c.childName))}
      </div>

      <div style="width:${mm(18)}in;height:0.6pt;background:currentColor;
                  opacity:0.5;margin:${mm(10)}in 0"></div>

      <div style="font-size:20pt;line-height:1.2;letter-spacing:0.04em">
        ${esc(houseCase(c.ageWord))}
      </div>

      <div style="width:${mm(18)}in;height:0.6pt;background:currentColor;
                  opacity:0.5;margin:${mm(10)}in 0"></div>

      <div style="font-family:${SANS};font-size:9.5pt;letter-spacing:0.2em;opacity:0.75">
        ${esc(c.year)}
      </div>
    </div>

    <div class="bottom">
      <span style="font-family:${SANS};font-size:8pt;letter-spacing:0.26em;opacity:0.7">
        ${esc(houseCase(c.imprint))}
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
      <span style="font-family:${SANS};font-size:8pt;letter-spacing:0.26em;opacity:0.7">
        ${esc(houseCase(c.imprint))}
      </span>
      <span style="font-family:${SANS};font-size:8pt;letter-spacing:0.08em;opacity:0.55">
        a year of ${esc(houseCase(c.childName))}
      </span>
    </div>
  </div>
</div>`;
}

function renderInterior(page: RenderPage, target: RenderTarget, imprintFoot = ""): string {
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
      // Reversed out of the volume colour and centred, quiet rather than
      // enormous: the small label above, the title lowercase beneath it, a
      // short rule, then the note. The colour field is doing the work, so
      // the type does not also need to shout — which is the difference
      // between a book you keep and a poster.
      inner = `<div class="content" style="inset:${inset};text-align:center">
        <div style="flex:1;display:flex;flex-direction:column;
                    align-items:center;justify-content:center">
          ${labels[0] ? `<div class="label">${esc(labels[0].content)}</div>` : ""}
          ${heading ? `<h1 class="opener-title">${esc(houseCase(heading.content))}</h1>` : ""}
          <div class="opener-rule"></div>
          ${texts[0] ? `<p class="opener-note">${esc(texts[0].content)}</p>` : ""}
        </div>
        <div class="label" style="opacity:0.5">${esc(imprintFoot)}</div>
      </div>`;
      break;

    case "quote_page":
      // Centred, with a rule and the attribution beneath.
      //
      // This used to be hung off the top third at 54pt, on the argument that
      // centring makes a quote look like a greetings card. That held for the
      // louder typography it was written for; against a quiet lowercase book
      // the hung version reads as a pull quote from a magazine. What a
      // two-year-old actually said wants the page's full silence around it,
      // and the restraint is what stops it becoming a card.
      inner = `<div class="content" style="inset:${inset};text-align:center">
        <div style="flex:1;display:flex;flex-direction:column;
                    align-items:center;justify-content:center">
          ${quotes.map((q) => `<div class="quote">${esc(q.content)}</div>`).join("")}
          ${annotations[0]
            ? `<div class="opener-rule" style="opacity:0.35"></div>` +
              `<div class="annotation">${esc(annotations[0].content)}</div>`
            : ""}
        </div>
      </div>`;
      break;

    case "portrait_plus_story": {
      // The photograph runs off the OUTER edge and off the TOP, occupying
      // about 58% of the page; the story runs beneath it at a full measure.
      // Splitting vertically rather than into columns is what keeps the text
      // readable — a 55% image column leaves barely thirty characters a line.
      const IMG_H = 58;   // % of page height
      const IMG_W = 152;  // mm, from the outer trim edge
      inner =
        (photos[0]
          ? `<div class="bleed-top ${right ? "to-right" : "to-left"}" ` +
            `style="width:${IMG_W}mm;height:${IMG_H}%">${img(photos[0])}</div>`
          : "") +
        `<div class="content" style="top:${IMG_H}%;bottom:${mgn.bottom}mm;` +
        `left:${mgn.left}mm;right:${mgn.right}mm;padding-top:${mm(10)}in">
          <div class="hang">
            ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
          </div>
          ${cap(captions)}
        </div>`;
      break;
    }

    case "object_portrait":
      // Deliberately small. A poor but important photograph earns its place
      // through white space and story, never through enlargement (§14).
      // Sparse by design (brief §9) — but the block sits ON the page rather
      // than in a corner. Air above and below, the object off to one side.
      inner = `<div class="content" style="inset:${inset}">
        <div style="margin:auto 0">
          <div style="width:44%;margin-left:${right ? "auto" : "0"}">
            ${photos[0] ? img(photos[0], "photo intimate") : ""}
            ${cap(captions)}
          </div>
          <div class="hang" style="margin-top:${mm(18)}in">
            ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
          </div>
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
        ${heading ? `<h2 style="margin-bottom:${mm(6)}in">${esc(houseCase(heading.content))}</h2>` : ""}
        <div class="grid-4">${photos.slice(0, 4).map((p) => img(p)).join("")}</div>
        ${cap(captions)}
      </div>`;
      break;

    case "people_page":
      inner = `<div class="content" style="inset:${inset}">
        ${labels[0] ? `<div class="label">${esc(labels[0].content)}</div>` : ""}
        ${heading ? `<h2 style="margin-top:${mm(4)}in">${esc(houseCase(heading.content))}</h2>` : ""}
        ${photos[0] ? `<div style="height:46%;margin-top:${mm(10)}in">${img(photos[0])}</div>` : ""}
        ${cap(captions)}
        <div class="hang" style="padding-top:${mm(12)}in">
          ${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}
        </div>
      </div>`;
      break;

    case "little_things":
      inner = `<div class="content" style="inset:${inset}">
        ${heading ? `<h2 style="margin-bottom:${mm(16)}in">${esc(houseCase(heading.content))}</h2>` : ""}
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
        <div style="margin-top:${mm(14)}in">
          ${heading ? `<h2 style="margin-bottom:${mm(7)}in">${esc(houseCase(heading.content))}</h2>` : ""}
          <div class="hang">${texts.map((t) => `<p>${esc(t.content)}</p>`).join("")}</div>
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

  const bleeds = page.archetype === "portrait_plus_story";
  const folio = page.hideFolio
    ? ""
    : `<div class="folio ${bleeds ? "inner " : ""}${right ? "right" : "left"}">${page.pageNumber}</div>`;

  // The listen mark sits on the outer edge, clear of the gutter.
  const listen = page.listen
    ? `<div class="listen" style="bottom:${mgn.bottom}mm;${right ? `right:${mgn.right}mm` : `left:${mgn.left}mm`}">` +
      `<img src="${esc(page.listen.qrDataUri)}" alt="">` +
      `<span class="listen-label">${esc(page.listen.label)}</span></div>`
    : "";

  const reversed = page.archetype === "chapter_opener" ? " opener-page" : "";
  return `<div class="page${reversed}" data-page="${page.pageNumber}" data-side="${right ? "right" : "left"}">${inner}${folio}${listen}</div>`;
}
