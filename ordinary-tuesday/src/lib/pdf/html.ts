// Book → HTML for print rendering.
// The same templates drive on-screen preview and press-ready output; only
// the page geometry (bleed vs no bleed) differs. Deterministic by design.

import { BOOK_SPEC } from "@/lib/book/structure";

export interface RenderBlock {
  type: "text" | "photo" | "quote" | "heading" | "caption";
  content: string;       // text, or an image URL for photo blocks
}

/** A printed QR that resolves to a recording (see lib/listen). */
export interface ListenMark {
  qrDataUri: string;
  label: string;
}

export interface RenderPage {
  pageNumber: number;
  templateId: string;
  blocks: RenderBlock[];
  listen?: ListenMark;
}

export interface RenderBook {
  title: string;
  subtitle?: string;
  pages: RenderPage[];
}

export type RenderTarget = "digital" | "print";

/** Page geometry in inches for the given target. */
export function pageGeometry(target: RenderTarget) {
  const bleed = target === "print" ? BOOK_SPEC.bleedInches : 0;
  return {
    width: BOOK_SPEC.trimWidthInches + bleed * 2,
    height: BOOK_SPEC.trimHeightInches + bleed * 2,
    bleed,
    safeMargin: BOOK_SPEC.safeMarginInches + bleed,
  };
}

export function renderBookHtml(book: RenderBook, target: RenderTarget): string {
  const geo = pageGeometry(target);
  const pages = book.pages.map((p) => renderPage(p, geo.safeMargin)).join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${geo.width}in ${geo.height}in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1c1917; }
  .page {
    width: ${geo.width}in; height: ${geo.height}in;
    page-break-after: always; position: relative; overflow: hidden;
  }
  .content { position: absolute; inset: ${geo.safeMargin}in; }
  .full-bleed img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  h1 { font-size: 42pt; font-weight: normal; letter-spacing: -0.01em; }
  h2 { font-size: 28pt; font-weight: normal; }
  p { font-size: 11.5pt; line-height: 1.6; }
  .caption { font-size: 9pt; color: #57534e; margin-top: 0.08in;
             font-family: Helvetica, Arial, sans-serif; letter-spacing: 0.02em; }
  .quote { font-size: 22pt; line-height: 1.4; font-style: italic; }
  .photo { width: 100%; object-fit: cover; display: block; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25in; height: 100%; }
  .grid-3 { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: 0.25in; height: 100%; }
  .grid-3 > :first-child { grid-row: span 2; }
  .grid-3 img, .grid-2 img { height: 100%; }
  .centered { display: flex; flex-direction: column; justify-content: center;
              align-items: center; height: 100%; text-align: center; }
  .lt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; align-content: center; height: 100%; }
  .lt-item .lt-label { font-family: Helvetica, Arial, sans-serif; font-size: 8pt;
    text-transform: uppercase; letter-spacing: 0.12em; color: #a8552f; margin-bottom: 0.05in; }
  .lt-item .lt-value { font-size: 14pt; }
  /* Listen mark: deliberately small and quiet. A premium page can carry a
     code without becoming a leaflet. Sized at the scannable minimum from
     lib/listen/qr.ts. */
  .listen { position: absolute; right: ${geo.safeMargin}in; bottom: ${geo.safeMargin}in;
            display: flex; align-items: center; gap: 0.09in; }
  .listen img { width: 0.62in; height: 0.62in; display: block; }
  .listen .listen-label { font-family: Helvetica, Arial, sans-serif; font-size: 6.5pt;
    letter-spacing: 0.08em; text-transform: uppercase; color: #78716c;
    writing-mode: vertical-rl; transform: rotate(180deg); }
</style>
</head>
<body>
${pages}
</body>
</html>`;
}

function renderPage(page: RenderPage, safeMargin: number): string {
  const photos = page.blocks.filter((b) => b.type === "photo");
  const heading = page.blocks.find((b) => b.type === "heading");
  const texts = page.blocks.filter((b) => b.type === "text" || b.type === "caption");
  const quotes = page.blocks.filter((b) => b.type === "quote");

  let inner: string;
  switch (page.templateId) {
    case "full_bleed_photo":
      inner = photos[0]
        ? `<div class="full-bleed"><img src="${esc(photos[0].content)}"></div>`
        : "";
      break;
    case "quote_page":
      inner = `<div class="content"><div class="centered">${quotes
        .concat(texts)
        .map((q) => `<div class="quote">&ldquo;${esc(q.content)}&rdquo;</div>`)
        .join("")}</div></div>`;
      break;
    case "chapter_opener":
      inner = `<div class="content"><div class="centered">
        ${heading ? `<h2>${esc(heading.content)}</h2>` : ""}
        ${photos[0] ? `<img class="photo" style="max-height:60%;margin-top:0.4in" src="${esc(photos[0].content)}">` : ""}
        ${texts[0] ? `<p style="margin-top:0.3in;max-width:70%">${esc(texts[0].content)}</p>` : ""}
      </div></div>`;
      break;
    case "two_photo":
      inner = `<div class="content"><div class="grid-2">
        ${photos.slice(0, 2).map((p) => `<img class="photo" src="${esc(p.content)}">`).join("")}
      </div>${captionHtml(texts)}</div>`;
      break;
    case "three_photo":
      inner = `<div class="content"><div class="grid-3">
        ${photos.slice(0, 3).map((p) => `<img class="photo" src="${esc(p.content)}">`).join("")}
      </div>${captionHtml(texts)}</div>`;
      break;
    case "little_things_grid":
      inner = `<div class="content">
        ${heading ? `<h2 style="margin-bottom:0.4in">${esc(heading.content)}</h2>` : ""}
        <div class="lt-grid">${texts
          .map((t) => {
            const [label, ...rest] = t.content.split(":");
            return `<div class="lt-item"><div class="lt-label">${esc(label)}</div><div class="lt-value">${esc(rest.join(":").trim() || label)}</div></div>`;
          })
          .join("")}</div></div>`;
      break;
    case "closing_page":
      inner = `<div class="content"><div class="centered">
        ${heading ? `<h2>${esc(heading.content)}</h2>` : ""}
        ${texts[0] ? `<p style="margin-top:0.3in;max-width:65%">${esc(texts[0].content)}</p>` : ""}
      </div></div>`;
      break;
    case "portrait_plus_text":
      inner = `<div class="content"><div class="grid-2">
        ${photos[0] ? `<img class="photo" src="${esc(photos[0].content)}">` : "<div></div>"}
        <div style="display:flex;flex-direction:column;justify-content:center">
          ${texts.map((t) => `<p style="margin-bottom:0.15in">${esc(t.content)}</p>`).join("")}
        </div>
      </div></div>`;
      break;
    default: // single_photo_caption and anything unrecognised
      inner = `<div class="content">
        ${photos[0] ? `<img class="photo" style="height:80%" src="${esc(photos[0].content)}">` : ""}
        ${captionHtml(texts)}
      </div>`;
  }
  const listen = page.listen
    ? `<div class="listen"><img src="${esc(page.listen.qrDataUri)}" alt="">` +
      `<span class="listen-label">${esc(page.listen.label)}</span></div>`
    : "";
  return `<div class="page" data-page="${page.pageNumber}">${inner}${listen}</div>`;
}

function captionHtml(texts: RenderBlock[]): string {
  return texts.length ? `<div class="caption">${texts.map((t) => esc(t.content)).join(" · ")}</div>` : "";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
