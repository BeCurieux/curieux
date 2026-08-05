// Server-side PDF rendering.
//
// Architecture: HTML template → headless Chromium → press-ready PDF. Chosen
// over a PDF library because the same HTML/CSS drives on-screen preview,
// giving exact parity between what the parent approves and what is printed.
//
// One file per book, in Prodigi's page order: front cover, interior, back
// cover. Pages are supplied at exact trim — Prodigi generates its own bleed.

import { chromium } from "playwright-core";
import { renderBookHtml, type RenderBook, type RenderTarget } from "./html";
import { FORMAT } from "@/lib/book/format";

/**
 * Read the MediaBox back out of the produced PDF.
 *
 * Preflight used to be handed the page size as a literal, which meant it was
 * checking an assumption rather than the artefact. Chromium routes @page
 * through CSS pixels, so an A4 page lands at 209.89 x 297.01mm however the
 * size is expressed — 0.11mm under, which no press will notice but which the
 * checker should state honestly rather than paper over.
 */
export function readPageSizeMm(pdf: Buffer): { widthMm: number; heightMm: number } | null {
  const m = pdf.toString("latin1").match(/\/MediaBox\s*\[([^\]]+)\]/);
  if (!m) return null;
  const v = m[1].trim().split(/\s+/).map(Number);
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) return null;
  return {
    widthMm: ((v[2] - v[0]) / 72) * 25.4,
    heightMm: ((v[3] - v[1]) / 72) * 25.4,
  };
}

export interface RenderResult {
  pdf: Buffer;
  /** Interior pages only — covers excluded. */
  interiorPages: number;
  /** Total PDF pages, including both covers. */
  totalPdfPages: number;
  overflowPages: number[];
  safeAreaViolations: number[];
  blankPages: number[];
  /** Measured from the produced file, not assumed. */
  pageWidthMm: number | null;
  pageHeightMm: number | null;
}

export async function renderBookPdf(book: RenderBook, target: RenderTarget): Promise<RenderResult> {
  const html = renderBookHtml(book, target);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    // Layout inspection runs in the browser against real rendered boxes — the
    // only honest way to catch overflow and safe-area breaches.
    const audit = await page.evaluate((safeMm: number) => {
      const overflow: number[] = [];
      const unsafe: number[] = [];
      const blank: number[] = [];
      const safePx = safeMm * (96 / 25.4);

      document.querySelectorAll<HTMLElement>(".page[data-page]").forEach((pageEl) => {
        const n = Number(pageEl.dataset.page);
        const pageBox = pageEl.getBoundingClientRect();

        const content = pageEl.querySelector<HTMLElement>(".content");
        if (content &&
            (content.scrollHeight > content.clientHeight + 1 ||
             content.scrollWidth > content.clientWidth + 1)) {
          overflow.push(n);
        }

        // Everything carrying ink must clear the safe area — except a hero
        // photograph, which is meant to reach the trim edge.
        const fullBleed = pageEl.querySelector(".full-bleed");
        if (!fullBleed) {
          pageEl.querySelectorAll<HTMLElement>(".content *").forEach((el) => {
            if (!el.textContent?.trim() && el.tagName !== "IMG") return;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) return;
            if (b.left - pageBox.left < safePx - 0.5 ||
                b.top - pageBox.top < safePx - 0.5 ||
                pageBox.right - b.right < safePx - 0.5 ||
                pageBox.bottom - b.bottom < safePx - 0.5) {
              if (!unsafe.includes(n)) unsafe.push(n);
            }
          });
        }

        const hasInk =
          !!fullBleed ||
          !!pageEl.querySelector(".content img") ||
          (content?.textContent ?? "").trim().length > 0;
        if (!hasInk) blank.push(n);
      });

      return { overflow, unsafe, blank };
    }, FORMAT.safeMarginMm);

    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      scale: 1,
    });

    const buf = Buffer.from(pdf);
    const size = readPageSizeMm(buf);

    return {
      pdf: buf,
      pageWidthMm: size?.widthMm ?? null,
      pageHeightMm: size?.heightMm ?? null,
      interiorPages: book.pages.length,
      totalPdfPages: book.pages.length + 2,
      overflowPages: audit.overflow,
      safeAreaViolations: audit.unsafe,
      blankPages: audit.blank,
    };
  } finally {
    await browser.close();
  }
}
